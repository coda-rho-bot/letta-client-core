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

## Sync path
Upstream of these modules is the Android app (battle-tested first). Changes flow: agents-chat → core (extraction) → desktop consumption. Eventually inverts once both shells consume the package.
