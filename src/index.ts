/**
 * @angus/letta-client-core — shared client core.
 *
 * Extracted from Agents Chat (coda/agents-chat, angus branch @
 * c1a0162085b4244ffd07e9c8c19bf79d74e576fe, Oct 10 2026) — the
 * battle-tested Android implementations, verbatim. Extraction provenance:
 * pin the source COMMIT, not the repo (vendoring doctrine, Oct 10).
 *
 * Modules are platform-pure: SDK types in, plain data out. No RN, no expo,
 * no DOM — safe in bun/node tests, Metro, and Electron alike.
 */
export * from "./model.js";
export * from "./toolText.js";
export * from "./echoMerge.js";
export * from "./grouping.js";
export * from "./transcriptProjection.js";
export * from "./terminal.js";
