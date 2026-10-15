/**
 * Tests for the Redux API cache: no needless updates, ordering of responses,
 * request de-duplication, and the first-load counter behind the page loader.
 *
 *   npm run test:store
 */
import assert from "node:assert/strict";
import {
  cacheReducer as reducer,
  fetchStarted, fetchSucceeded, fetchFailed, moreStarted, moreSucceeded, moreFailed, invalidateAll, clearCache, initialCacheState, MAX_ENTRIES,
  type CacheState,
} from "../src/store/cacheSlice";

const tests: { name: string; fn: () => Promise<void> | void }[] = [];
const test = (name: string, fn: () => Promise<void> | void) => tests.push({ name, fn });

const run = (s: CacheState, ...actions: Parameters<typeof reducer>[1][]) => actions.reduce((st, a) => reducer(st, a), s);
const ok = (key: string, epoch: number, data: unknown, at = 1) => fetchSucceeded({ key, epoch, at, data, meta: null });
const err = { status: 500, code: "X", message: "boom" };

test("an identical response keeps the very same data object (so nothing re-renders)", () => {
  const rows = [{ id: 1, name: "A" }, { id: 2, name: "B" }];
  let s = run(initialCacheState, fetchStarted({ key: "/p", epoch: 0 }), ok("/p", 0, rows));
  const first = s.entries["/p"].data;
  s = run(s, fetchStarted({ key: "/p", epoch: 0 }), ok("/p", 0, JSON.parse(JSON.stringify(rows)), 2));
  assert.equal(s.entries["/p"].data, first);
});

test("a changed list keeps the identity of unchanged rows", () => {
  let s = run(initialCacheState, ok("/p", 0, [{ id: 1, n: "A" }, { id: 2, n: "B" }, { id: 3, n: "C" }]));
  const before = s.entries["/p"].data as { id: number; n: string }[];
  s = run(s, ok("/p", 0, [{ id: 1, n: "A" }, { id: 2, n: "B2" }, { id: 3, n: "C" }], 2));
  const after = s.entries["/p"].data as { id: number; n: string }[];
  assert.notEqual(after, before);
  assert.equal(after[0], before[0], "row 1 unchanged → same object");
  assert.notEqual(after[1], before[1]);
  assert.equal(after[2], before[2], "row 3 unchanged → same object");
  assert.equal(after[1].n, "B2");
});

test("a slow response from before a save never overwrites newer data", () => {
  let s = run(initialCacheState, fetchStarted({ key: "/p", epoch: 0 }), invalidateAll(), fetchStarted({ key: "/p", epoch: 1 }));
  assert.equal(s.epoch, 1);
  s = run(s, ok("/p", 1, ["new"]), ok("/p", 0, ["old"]));
  assert.deepEqual(s.entries["/p"].data, ["new"]);
  assert.equal(s.entries["/p"].fetchedEpoch, 1);
});

test("the first-load counter rises and falls with the first response, and isn't double counted", () => {
  let s = run(initialCacheState, fetchStarted({ key: "/a", epoch: 0 }), fetchStarted({ key: "/b", epoch: 0 }));
  assert.equal(s.pendingFirstLoads, 2);
  // a refetch of /a while its first load is still running does not count again
  s = run(s, invalidateAll(), fetchStarted({ key: "/a", epoch: 1 }));
  assert.equal(s.pendingFirstLoads, 2);
  s = run(s, ok("/a", 0, [1]));
  assert.equal(s.pendingFirstLoads, 1);
  s = run(s, ok("/a", 1, [1]), ok("/b", 0, [2]));
  assert.equal(s.pendingFirstLoads, 0);
  // already-loaded data refreshing is not a "first load"
  s = run(s, fetchStarted({ key: "/a", epoch: 1 }));
  assert.equal(s.pendingFirstLoads, 0);
});

test("a failed first load stops the loader; a later success counts and clears correctly", () => {
  let s = run(initialCacheState, fetchStarted({ key: "/p", epoch: 0 }), fetchFailed({ key: "/p", epoch: 0, error: err }));
  assert.equal(s.pendingFirstLoads, 0);
  assert.equal(s.entries["/p"].error?.message, "boom");
  assert.equal(s.entries["/p"].loadedAt, null);
  s = run(s, fetchStarted({ key: "/p", epoch: 0 }));
  assert.equal(s.pendingFirstLoads, 1);
  s = run(s, ok("/p", 0, [1]));
  assert.equal(s.pendingFirstLoads, 0);
  assert.equal(s.entries["/p"].error, null);
});

test("a failed refresh keeps the data on screen and records the error", () => {
  let s = run(initialCacheState, ok("/p", 0, ["kept"]), invalidateAll(), fetchStarted({ key: "/p", epoch: 1 }), fetchFailed({ key: "/p", epoch: 1, error: err }));
  assert.deepEqual(s.entries["/p"].data, ["kept"]);
  assert.equal(s.entries["/p"].error?.status, 500);
  s = run(s, invalidateAll(), ok("/p", 2, ["fresh"]));
  assert.deepEqual(s.entries["/p"].data, ["fresh"]);
  assert.equal(s.entries["/p"].error, null);
});

test("the cache stays bounded, dropping the oldest entries", () => {
  let s = initialCacheState;
  for (let i = 0; i < MAX_ENTRIES + 25; i++) s = run(s, ok(`/k${i}`, 0, [i], i + 1));
  assert.equal(Object.keys(s.entries).length, MAX_ENTRIES);
  assert.ok(!s.entries["/k0"], "oldest dropped");
  assert.ok(s.entries[`/k${MAX_ENTRIES + 24}`], "newest kept");
});

test("clearing the cache (sign-in/out) forgets everything", () => {
  const s = run(initialCacheState, ok("/p", 0, [1]), invalidateAll(), clearCache());
  assert.deepEqual(s, initialCacheState);
});

// ── Paged ("infinite scroll") lists ──────────────────────────────────────────

const meta = (page: number, total = 100) => ({ page, pageSize: 2, total, totalPages: Math.ceil(total / 2) });

test("the next page is appended after the rows already shown, and never repeats one", () => {
  let s = run(initialCacheState, fetchStarted({ key: "/p", epoch: 0 }), fetchSucceeded({ key: "/p", epoch: 0, at: 1, data: [{ id: 1 }, { id: 2 }], meta: meta(1) }));
  const first = (s.entries["/p"].data as { id: number }[])[0];
  s = run(s, moreStarted({ key: "/p" }));
  assert.equal(s.entries["/p"].loadingMore, true);
  // the server's list shifted by one, so page 2 repeats id 2
  s = run(s, moreSucceeded({ key: "/p", epoch: 0, rows: [{ id: 2 }, { id: 3 }], meta: meta(2) }));
  assert.deepEqual((s.entries["/p"].data as { id: number }[]).map(r => r.id), [1, 2, 3]);
  assert.equal((s.entries["/p"].data as { id: number }[])[0], first, "rows already on screen keep their identity");
  assert.equal(s.entries["/p"].meta?.page, 2);
  assert.equal(s.entries["/p"].loadingMore, false);
});

test("a page that arrives after something was saved is dropped (the refresh reloads everything)", () => {
  let s = run(initialCacheState, fetchStarted({ key: "/p", epoch: 0 }), fetchSucceeded({ key: "/p", epoch: 0, at: 1, data: [{ id: 1 }], meta: meta(1) }), moreStarted({ key: "/p" }), invalidateAll());
  s = run(s, moreSucceeded({ key: "/p", epoch: 0, rows: [{ id: 9 }], meta: meta(2) }));
  assert.deepEqual((s.entries["/p"].data as { id: number }[]).map(r => r.id), [1]);
  assert.equal(s.entries["/p"].loadingMore, false);
});

test("a failed next page keeps the rows and clears the loading flag", () => {
  const s = run(initialCacheState, fetchStarted({ key: "/p", epoch: 0 }), fetchSucceeded({ key: "/p", epoch: 0, at: 1, data: [{ id: 1 }], meta: meta(1) }), moreStarted({ key: "/p" }), moreFailed({ key: "/p", error: err }));
  assert.equal(s.entries["/p"].loadingMore, false);
  assert.equal(s.entries["/p"].error?.message, "boom");
  assert.equal((s.entries["/p"].data as unknown[]).length, 1);
});

// ── The thunk, against a fake network ────────────────────────────────────────

const { makeStore } = await import("../src/store/index");
const { fetchQuery, queryKey, fetchPagedQuery, fetchMorePaged } = await import("../src/store/thunks");
const { invalidateAll: inval } = await import("../src/store/cacheSlice");

let calls: string[] = [];
let reply: (url: string) => unknown = () => ({ data: [], meta: { page: 1, pageSize: 0, total: 0, totalPages: 0 } });
let delay = 0;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  calls.push(url);
  if (delay) await new Promise((r) => setTimeout(r, delay));
  return new Response(JSON.stringify(reply(url)), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;
const list = (path: string, params?: Record<string, string | number | boolean>) => ({ key: queryKey(path, params), kind: "list" as const, path, params });

test("query keys ignore parameter order and empty values", () => {
  assert.equal(queryKey("/a", { b: 1, a: 2, c: "" }), queryKey("/a", { a: 2, b: 1 }));
  assert.equal(queryKey("/a"), "/a");
});

test("simultaneous requests for one query make one network call", async () => {
  calls = []; delay = 20;
  const store = makeStore();
  await Promise.all([store.dispatch(fetchQuery(list("/dup"))), store.dispatch(fetchQuery(list("/dup"))), store.dispatch(fetchQuery(list("/dup")))]);
  assert.equal(calls.length, 1);
  delay = 0;
});

test("a query refreshed a moment ago isn't fetched again, but reload (force) is", async () => {
  calls = [];
  const store = makeStore();
  await store.dispatch(fetchQuery(list("/fresh")));
  await store.dispatch(fetchQuery(list("/fresh")));
  assert.equal(calls.length, 1);
  await store.dispatch(fetchQuery(list("/fresh"), { force: true }));
  assert.equal(calls.length, 2);
});

test("after a save, the next fetch goes to the network and stored data stays until it arrives", async () => {
  calls = []; reply = () => ({ data: [{ id: 1 }], meta: null });
  const store = makeStore();
  await store.dispatch(fetchQuery(list("/live")));
  const shown = store.getState().apiCache.entries["/live"].data;
  store.dispatch(inval());
  delay = 15; reply = () => ({ data: [{ id: 1 }, { id: 2 }], meta: null });
  const pending = store.dispatch(fetchQuery(list("/live")));
  assert.equal(store.getState().apiCache.entries["/live"].data, shown, "old data still there while loading");
  await pending;
  delay = 0;
  assert.equal(calls.length, 2);
  assert.equal((store.getState().apiCache.entries["/live"].data as unknown[]).length, 2);
});

test("a network failure is stored as a plain error and the loader counter returns to zero", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code: "NOPE", message: "Not allowed" } }), { status: 403 })) as typeof fetch;
  const store = makeStore();
  await store.dispatch(fetchQuery(list("/denied")));
  globalThis.fetch = orig;
  const e = store.getState().apiCache.entries["/denied"];
  assert.equal(e.error?.status, 403);
  assert.equal(e.error?.message, "Not allowed");
  assert.equal(store.getState().apiCache.pendingFirstLoads, 0);
});


test("scrolling fetches the next page of the same search; a refresh reloads every page on screen at once", async () => {
  calls = [];
  const all = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));
  reply = (url) => {
    const u = new URL(url, "http://x"); const page = Number(u.searchParams.get("page")); const size = Number(u.searchParams.get("pageSize"));
    return { data: all.slice((page - 1) * size, page * size), meta: { page, pageSize: size, total: 5, totalPages: 3 } };
  };
  const store = makeStore();
  const q = { key: "paged|/pp", path: "/pp", params: { search: "x" }, pageSize: 2 };
  await store.dispatch(fetchPagedQuery(q));
  assert.equal((store.getState().apiCache.entries[q.key].data as unknown[]).length, 2);
  await store.dispatch(fetchMorePaged(q));
  await store.dispatch(fetchMorePaged(q));
  assert.deepEqual((store.getState().apiCache.entries[q.key].data as { id: number }[]).map(r => r.id), [1, 2, 3, 4, 5]);
  assert.ok(calls.every(c => c.includes("search=x")), "every page carries the search");
  await store.dispatch(fetchMorePaged(q)); // nothing left
  assert.equal(calls.length, 3);
  // a save, then a refresh: pages 1-3 come back together
  calls = [];
  store.dispatch(inval());
  await store.dispatch(fetchPagedQuery(q));
  assert.equal(calls.length, 3);
  assert.equal((store.getState().apiCache.entries[q.key].data as unknown[]).length, 5);
  assert.equal(store.getState().apiCache.entries[q.key].meta?.page, 3);
});

test("two scroll events at once fetch the next page only once", async () => {
  calls = []; delay = 20;
  const store = makeStore();
  const q = { key: "paged|/qq", path: "/qq", pageSize: 2 };
  await store.dispatch(fetchPagedQuery(q));
  calls = [];
  await Promise.all([store.dispatch(fetchMorePaged(q)), store.dispatch(fetchMorePaged(q)), store.dispatch(fetchMorePaged(q))]);
  delay = 0;
  assert.equal(calls.length, 1);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${t.name}\n        ${String((e as Error).stack ?? e).split("\n").slice(0, 6).join("\n        ")}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
