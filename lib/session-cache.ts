// Small in-memory, module-scope cache. Exists specifically so that /dashboard/plan
// fetching all 3 paths in parallel doesn't re-pull YouTube data, re-fit the regression,
// and re-run the diagnosis LLM call three times over. Process-lifetime only — fine for
// a single dev/demo server, not a claim of durable caching.

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
const TTL_MS = 10 * 60 * 1000; // covers one dashboard session's worth of requests

export async function getOrCompute<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const cached = store.get(key) as Entry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await compute();
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}
