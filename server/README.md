# Samvaad HMS — API server

Every `/api/*` endpoint and the whole data layer (services, repositories, database adapters, auth/RBAC, payment,
Google Meet, …) live here, separate from the Next.js web app in the repo root. The web app is now a pure frontend:
it holds no database access and no secrets, and forwards `/api/*` to this server.

```
Browser ──► Next.js web app (:3005) ──/api/*──► this server (:4000) ──► MongoDB / Supabase / memory
                                                  ▲
Patient portal, attendance PWA, root-admin ───────┘  (server-to-server; can call either URL)
```

Hono on Node. Route handlers are plain Web-standard `(Request) => Response` functions, so the same code can run on
Node, Vercel, Bun or a Worker.

## Run it

```bash
cd server
cp .env.example .env        # fill in MONGODB_URI, SESSION_SECRET, …
npm install
npm run dev                 # http://localhost:4000, restarts on change
```

From the repo root: `npm run server` (same thing), and `npm run dev` for the web app. Start the server first — the
web app forwards to it. The web app finds it through `API_URL` (default `http://localhost:4000`).

| Script | What it does |
|---|---|
| `npm run dev` | watch mode |
| `npm start` | run once (uses `tsx`; no build step) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed:platform-admin` | one-off: create the Platform Admin login in an existing database |
| `npm run verify:atomicity` | proves multi-table writes roll back together |
| `npm run test:scheduling` | tests of doctor schedules: patients per hour, video vs in-person hours, rescheduling; `-- 6` repeats it |
| `npm run test:payments` | end-to-end tests of the tele-consult payment flow (fake Razorpay/Google, in-memory DB); `-- 6` repeats it |

Scripts load `server/.env` (Node's `--env-file`).

## Layout

```
server/
  src/
    index.ts          starts the HTTP server
    app.ts            Hono app: session gate + route registration
    load-routes.ts    discovers routes/**/route.ts at startup
    routes/           one folder per endpoint, e.g. routes/patients/[id]/route.ts → /api/patients/:id
    services/         business logic — the only place routes call into
    repositories/     typed access to tables + row→DTO mappers
    db/               adapters (memory, mongo, supabase), tables, indexes, seed + sample-data/
    auth/             sessions (signed cookie), RBAC matrix, patient-portal key
    http/             route helpers (withRoute, crud builders, responses, request context)
    lib/              errors, validation, logger
    config/env.ts     all environment configuration
  scripts/            one-off maintenance scripts
```

### Adding an endpoint

1. Create `src/routes/<path>/route.ts` and export `GET` / `POST` / `PUT` / `PATCH` / `DELETE` handlers — `[id]` folders
   become `:id` params. It is picked up on the next start; there is nothing to register.
2. Put the logic in `src/services/…`, wrap the handler in `withRoute`, and guard it with `requirePermission(resource,
   "read" | "write")`. Copy a neighbouring route for the pattern.
3. A route that must be reachable without a staff session (a webhook, a server-to-server API) has to be listed in
   `PUBLIC_API` / `PUBLIC_API_PREFIXES` in `src/app.ts` and must authenticate itself.

### Authentication

The login endpoint sets an httpOnly `samvaad_session` cookie holding an HMAC-signed token. `app.ts` rejects any `/api`
request without a valid one (except the public paths above) and handlers then enforce RBAC per resource. Because the web
app forwards `/api/*` as same-origin, the browser needs no CORS setup. If you ever call the server from a different
origin in a browser, add CORS handling in `app.ts`.

Behind the frontend's rewrite, `req.url` is this server's own address; use `publicOrigin(req)` from `http/web.ts`
whenever you must send a user back to the web app (it honours `x-forwarded-host` / `PUBLIC_APP_URL`).

## Shared code

A few type-only modules still live in the web app (`../src/types`, `../src/lib/report-upload-roles.ts`) because the
UI uses them too. The server reaches them through the `@shared/*` path alias (see `tsconfig.json`), and nothing else in
`src/` is imported. To fully decouple later, move those files into a shared package and repoint the alias.

## Deploying

- The web app needs `API_URL` set **at build time** (Next evaluates rewrites during `next build`).
- This server is a normal long-running Node process (`npm start`); containerise it or run it on any Node host. Set the
  variables from `.env.example` there — it is the only place that needs the database and third-party secrets.
- Next buffers the request bodies it forwards and truncates past a limit; `next.config.ts` raises it to 100 MB
  (`experimental.proxyClientMaxBodySize`) so audio and document uploads reach this server whole.
- To run on Vercel instead, export `app` from `src/app.ts` through `hono/vercel` in a function entry — the routes are
  already host-agnostic. (Not set up here.)
