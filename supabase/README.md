# Supabase setup

The application runs on an in-memory database by default. To switch to Supabase
(PostgreSQL) **no code changes are required** — only configuration.

## Steps

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run the migrations in order:
   - `migrations/0001_init.sql` — schema (tables, FKs, indexes, constraints)
   - `migrations/0002_security.sql` — enables Row Level Security
3. In your project **Settings → API**, copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY`
4. Add these to `.env.local`:

   ```bash
   DATABASE_DRIVER=supabase
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
   SUPABASE_AUTO_SEED=true   # loads sample data on first boot (empty DB only)
   SESSION_SECRET=some-long-random-string
   ```
5. Restart the app. On first boot it auto-seeds sample data (when
   `SUPABASE_AUTO_SEED=true` and the database is empty), then serves every
   module from Supabase.

## How the abstraction works

All data access goes through `DatabaseAdapter` (`server/src/db/adapter.ts`).
`server/src/db/index.ts` selects the implementation from environment variables:

- `MemoryAdapter` — in-process store, seeded from `src/data/*`.
- `SupabaseAdapter` — talks to Supabase's PostgREST API over `fetch`.

Both implement the identical interface, so repositories, services, and API
routes are unchanged when you swap backends.

## Default login

All seeded users share the password **`Samvaad@123`**. For example:

- `kevin.carter@samvaadhospital.in` — Super Admin
