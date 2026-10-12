import type { Computer } from "@letta-ai/letta-agent-sdk/client";

/**
 * Cloud computers listing projection. Extracted verbatim from
 * coda/letta-oss-ui @ 07de779 (the desktop env pane), whose shape and
 * provenance note come from the Android pane (agents-chat api.ts
 * listComputers). See PROVENANCE.md.
 */

/** A computer registered with the Letta Cloud account (Android's shape). */
export type ComputerSummary = {
  /** Stable identifier for the physical device across reconnects. */
  deviceId: string;
  /** Human-readable computer name. */
  name: string;
  /** Current online connection lease (null when offline). */
  connectionId: string | null;
  status: "online" | "offline";
};

/** Display projection of the SDK's Computer record (Android's shape). */
export function toComputerSummary(record: Computer): ComputerSummary {
  return {
    deviceId: record.deviceId,
    name: record.name,
    connectionId: record.connectionId,
    status: record.status,
  };
}
