# State management (Redux)

The web app keeps all server data and the signed-in user in one Redux store (`src/store`).
Pages still call `useList` / `useItem` / `useMutation` from `@/lib/api/hooks` and `useAuth()` —
nothing about how pages are written changed; what's behind the hooks did.

## How data flows

```
page ── useList("/patients") ──► store.apiCache["/patients?all=true"]
                                   │  data present?  yes → render it now (no loader)
                                   │                 no  → loading = true (loader), fetch
                                   ▼
                     background fetch ──► response identical? keep the same objects (no re-render)
                                          different?        replace only what changed
```

- **First visit** – nothing cached: `loading` is true; the shell shows a progress bar and a centred
  spinner (`RouteLoader`) until the page's first data arrives.
- **Later visits** – the last data is read straight from the store; a background request refreshes it.
- **After any save** (POST/PUT/PATCH/DELETE through `api`) the cache is marked out of date and every
  query currently on screen refetches itself once. Chat and login/logout don't trigger this.
- **Returning to the tab** after 30 s away refreshes what's on screen.
- **Sign in / out** clears the cache, so one user's data is never shown to the next.

## Why it re-renders less

- Components subscribe to single fields of a cache entry (data, meta, error, "loaded"), never to the
  whole entry, and fetching flags are not subscribed to at all.
- A response equal to what's stored changes nothing. When a list changes, unchanged rows keep their
  object identity (`shareStructure`), so memoised rows can skip rendering.
- Identical requests are de-duplicated (one network call for any number of components), and a
  response that was overtaken by a newer one is dropped (epoch ordering).
- Hook results are memoised; empty results are one shared constant; `useAuth()` returns a memoised
  object. `Sidebar`/`TopBar` are `memo`-ised so toggling the sidebar doesn't re-render the page.

## Files

| File | What it is |
|---|---|
| `src/store/cacheSlice.ts` | API cache reducer (pure; tested) |
| `src/store/authSlice.ts` | signed-in user |
| `src/store/thunks.ts` | the only code that fetches for the store; keys, de-duplication |
| `src/store/StoreProvider.tsx` | creates the store, wires "refresh after a save" and tab refocus |
| `src/lib/api/hooks.ts` | `useList`, `useItem`, `useMutation` |
| `src/lib/auth-context.tsx` | `useAuth()` |
| `src/components/layout/RouteLoader.tsx` | first-visit loader |

Not persisted: the store lives in memory only, so patient data is never written to browser storage.

Tests: `npm run test:store`.
