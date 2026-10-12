import type { ImageContent, SendMessage } from "@letta-ai/letta-agent-sdk/client";

/**
 * Image attachment intake policy — the shared home for both shells.
 *
 * Downscaled and re-encoded AT INTAKE rather than at send: a modern phone
 * photo is ~4000px of base64 that would bloat every turn's context for no
 * visual gain in a chat transcript. This module carries the platform-PURE
 * policy: the limits, the downscale math, the batch cap, and the wire
 * projections. The decode/resize itself is platform code and stays
 * shell-side (Electron nativeImage on desktop, expo-image-manipulator on
 * Android) — adapter-threaded through these helpers, same doctrine as
 * env/conversationEnv.
 *
 * Extracted from coda/letta-oss-ui @ 07de779 (the desktop attachments pane,
 * which mirrors the Android pane's constants). See PROVENANCE.md.
 */

/** Longest edge kept after downscaling. */
export const MAX_EDGE = 1600;
/** JPEG re-encode quality on the canonical 0–1 scale; shells convert (Electron wants 0–100). */
export const JPEG_QUALITY = 0.8;
/** Source files above this are refused before decoding. */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
/** Per-message attachment cap. */
export const MAX_ATTACHMENTS = 4;

/** What the wire projections need from an attachment: payload + media type. */
export interface AttachmentPayload {
  /** Base64 payload, ready for the SDK's multimodal content array. */
  data: string;
  mediaType: ImageContent["source"]["media_type"];
}

/**
 * Downscale target for a source image, or null when it already fits
 * MAX_EDGE. Animated formats decode to their first frame — consistent with
 * the re-encode-to-JPEG doctrine.
 */
export function downscaleDimensions(
  width: number,
  height: number,
): { width: number; height: number } | null {
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE) return null;
  const scale = MAX_EDGE / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Whether a source file is over the intake size guard. */
export function overSourceLimit(size: number): boolean {
  return size > MAX_SOURCE_BYTES;
}

/** Attachment payloads as SDK image content parts (base64, no data: prefix). */
export function toImageContent(attachments: readonly AttachmentPayload[]): ImageContent[] {
  return attachments.map((attachment) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: attachment.mediaType, data: attachment.data },
  }));
}

/**
 * The wire payload for a send: images LEAD the content array so the model
 * reads them as context for the instruction (Android order); plain text
 * stays a plain string.
 */
export function wireContent(
  text: string,
  attachments: readonly AttachmentPayload[],
): SendMessage {
  if (attachments.length === 0) return text;
  return [
    ...toImageContent(attachments),
    ...(text ? [{ type: "text" as const, text }] : []),
  ];
}

/**
 * Batch intake policy: the first MAX_ATTACHMENTS land, the rest come back as
 * human-readable skips so the shell can say why a pick did not land.
 * Adapter-threaded — intakeOne is the shell's decode (it throws to skip),
 * label names a path in skip messages (basename on desktop).
 */
export function intakeBatch<T>(
  paths: readonly string[],
  intakeOne: (path: string) => T,
  label: (path: string) => string,
): { attachments: T[]; skipped: string[] } {
  const attachments: T[] = [];
  const skipped: string[] = [];
  for (const path of paths) {
    if (attachments.length >= MAX_ATTACHMENTS) {
      skipped.push(`${label(path)} — over the ${MAX_ATTACHMENTS}-image limit`);
      continue;
    }
    try {
      attachments.push(intakeOne(path));
    } catch (error) {
      skipped.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { attachments, skipped };
}
