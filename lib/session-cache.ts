// Short-lived in-memory cache of the normalised snapshot + computed analysis, keyed per
// authenticated session (so never shared across channels). A demo optimisation, not
// durable storage.
// - Lives on globalThis: Next.js bundles each route separately, so a module-scope Map
//   would give every API route its own empty cache.
// - Stores the in-flight promise, so parallel requests (/api/diagnose + 3× /api/plan)
//   await one computation instead of all missing at once. Failures are evicted.

type Entry = { value: Promise<unknown>; expiresAt: number };

const TTL_MS = 15 * 60 * 1000;

const globalStore = globalThis as typeof globalThis & { __creatorlensSessionCache?: Map<string, Entry> };
const store = (globalStore.__creatorlensSessionCache ??= new Map<string, Entry>());

export function getOrCompute<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const cached = store.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value as Promise<T>;
  const value = compute();
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });
  return value;
}
