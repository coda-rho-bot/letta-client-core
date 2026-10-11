/**
 * Per-conversation environment (computer) selection.
 *
 * The SDK's `computer` option is session-scoped by design; the app's
 * environment sheet used to write the selection to the PROFILE, which
 * silently rerouted every other conversation on that profile. This module
 * stores the selection per conversation in AsyncStorage (same pattern as
 * per-conversation notification settings), with three states:
 *
 *   - "unset"  → inherit the profile's selector (its value when the
 *                conversation last touched the sheet) — behavior
 *                identical to legacy for old conversations
 *   - null     → explicitly Cloud Sandbox (overrides a profile default)
 *   - selector → a specific computer
 */
import type { KeyValueStore } from "../storage/KeyValueStore.js";
import type { ComputerSelectorField } from "./selector.js";

const KEY = (conversationId: string) => `letta.env.${conversationId}`;

export interface ConversationEnv {
  /** null = explicit Cloud Sandbox; undefined = inherit profile default. */
  selector: ComputerSelectorField | null | undefined;
}

export async function loadConversationEnv(
  store: KeyValueStore,
  conversationId: string,
): Promise<ConversationEnv> {
  const raw = await store.get(KEY(conversationId));
  if (raw === null) return { selector: undefined };
  if (raw === "sandbox") return { selector: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    // Shape-validate: garbage JSON recovers to inherit, but valid JSON that
    // isn't a selector (number, bool, …) would crash the chip render's
    // `"name" in selector` check — treat it as corrupt and inherit instead.
    if (isSelector(parsed)) return { selector: parsed };
    return { selector: undefined };
  } catch {
    return { selector: undefined };
  }
}

function isSelector(value: unknown): value is ComputerSelectorField {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.deviceId === "string" && typeof v.connectionId === "string") return true;
  if (typeof v.deviceId === "string" && v.connectionId === undefined) return true;
  if (typeof v.id === "string" && Object.keys(v).length === 1) return true;
  if (typeof v.connectionId === "string" && v.deviceId === undefined && v.id === undefined) return true;
  return false;
}

export async function saveConversationEnv(
  store: KeyValueStore,
  conversationId: string,
  selector: ComputerSelectorField | null,
): Promise<void> {
  if (selector === undefined) {
    await store.delete(KEY(conversationId));
    return;
  }
  const raw = selector === null ? "sandbox" : JSON.stringify(selector);
  await store.set(KEY(conversationId), raw);
}
