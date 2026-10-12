# Provenance

## Extraction source
- **Repo:** coda/agents-chat (Forgejo), branch `angus`
- **Commit:** c1a0162085b4244ffd07e9c8c19bf79d74e576fe (Oct 10 2026 — includes PRs #74 SDK 0.8.39 + #75 stream_lost settlement)
- **Files:** src/lib/letta/{model,toolText,echoMerge,grouping,transcriptProjection,terminal}.ts → src/
  - Verbatim copies; only test-file import paths adjusted (`./x` → `../src/x.js`) and test factory literals cast (`satisfies` → `as`) for standalone-package type contexts.
- **Tests:** the four pure-module test files travel with the modules. `terminalContract.test.ts` (ChatSession reducer integration) stays in coda/agents-chat — it exercises the app's session, not the core.
- `test/stubNativeModules.ts` NOT carried: core modules are platform-pure (verified: zero RN/expo imports in the closure).

## Tier 2 (Oct 10, second pass)
- **src/auth/**: oauthTokens.ts + oauthResult.ts verbatim from the same commit (they are pure — fetch+JSON; no storage inside).
- **src/storage/KeyValueStore.ts**: adapter contracts (KeyValueStore + SecretStore + memoryStore) — the platform seam. Android implements over AsyncStorage/SecureStore; desktop over its own store.
- **src/env/selector.ts**: ComputerSelectorField extracted from profiles.ts (the identity contract).
- **src/env/conversationEnv.ts**: adapter-threaded — AsyncStorage swapped for KeyValueStore param on load/save. Android wraps with its AsyncStorage impl; zero behavior change.
- Test adjustments documented: fetch-mock casts and one non-null assert for strict standalone tsc.

## Doctrine
Vendored/extracted copies pin the source COMMIT, not just the repo (Oct 10 2026 lesson — the theming drift). When re-syncing from agents-chat, update this file with the new commit.

## Tier 3 (Oct 11, third pass — desktop-first extraction)
- **Source repo:** coda/letta-oss-ui (Forgejo), commit `07de779` (Oct 11 2026 — main after the theming-tokens pane PR #13; the attachments pane is PR #11's lineage, the computers projection is PR #12's).
- **src/attachments.ts**: the platform-PURE intake policy — limits (MAX_EDGE 1600, JPEG_QUALITY 0.8 canonical 0–1, MAX_SOURCE_BYTES 25MB, MAX_ATTACHMENTS 4), the downscale math (`downscaleDimensions`), the size-guard decision (`overSourceLimit`), the batch cap policy (`intakeBatch`, adapter-threaded over the shell's decode), and the wire projections (`toImageContent`, `wireContent`). The desktop's decode (Electron nativeImage) and Android's (expo-image-manipulator) stay shell-side. The desktop's JPEG_QUALITY was 80 on Electron's 0–100 scale; the core carries the canonical 0.8 and the desktop shell converts.
- **src/env/computers.ts**: `ComputerSummary` + `toComputerSummary` verbatim from the desktop env pane (shape and provenance from the Android pane, agents-chat api.ts listComputers).
- **Tests:** test/attachments.test.ts + test/env/computers.test.ts mirror the app's coverage (tests/electron/attachments.test.ts decisions + the projection test in tests/electron/env.test.ts). The Electron nativeImage decode tests stay app-side — they exercise the shell, not the core.

## Sync path
Upstream of these modules is the Android app (battle-tested first). Changes flow: agents-chat → core (extraction) → desktop consumption. Eventually inverts once both shells consume the package.
