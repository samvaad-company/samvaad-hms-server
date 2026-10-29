/**
 * Run work one-after-the-other per key, inside this server process. Used where two requests could otherwise both
 * read "free" and both write (two people checking out the same patient file, two dispatches of one request).
 * Keys are strings so unrelated things (a file, a request) can't collide on the same number.
 */
const chains = new Map<string, Promise<unknown>>();

export async function withKeyLocks<T>(keys: string[], fn: () => Promise<T>): Promise<T> {
  const sorted = [...new Set(keys)].sort(); // a fixed order, so two multi-key callers can't deadlock
  const prior = sorted.map((k) => chains.get(k) ?? Promise.resolve());
  const run = Promise.all(prior.map((p) => p.catch(() => undefined))).then(fn);
  const settled = run.catch(() => undefined);
  for (const k of sorted) chains.set(k, settled);
  try {
    return await run;
  } finally {
    for (const k of sorted) if (chains.get(k) === settled) chains.delete(k);
  }
}

/** Run `fn` at most once at a time per key, and give callers that arrive meanwhile the same in-flight result. */
const inflight = new Map<string, Promise<unknown>>();
export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const job = fn().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}
