/**
 * Storage adapter contract — the platform seam for persisted state.
 *
 * Android implements this over AsyncStorage (metadata) + expo-secure-store
 * (secrets); the desktop implements it over Electron store / fs. Modules in
 * this package that persist state depend on this interface only.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Secret-tier variant — same contract, backed by a credential store. */
export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** In-memory implementation — tests and ephemeral sessions. */
export function memoryStore(): KeyValueStore & SecretStore {
  const m = new Map<string, string>();
  return {
    async get(k) { return m.get(k) ?? null; },
    async set(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
  };
}
