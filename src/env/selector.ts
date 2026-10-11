/**
 * Computer selector shapes — shared identity contract for execution targeting.
 * Extracted from agents-chat profiles.ts (same provenance as PROVENANCE.md).
 */
export type ComputerSelectorField =
  | string
  | { name: string }
  | { deviceId: string }
  | { id: string }
  | { connectionId: string; name?: string }
  /** Preferred: stable device identity + display name; the connection lease
   *  is resolved at session-attach time (leases change on remote restarts). */
  | { deviceId: string; connectionId: string; name?: string };
