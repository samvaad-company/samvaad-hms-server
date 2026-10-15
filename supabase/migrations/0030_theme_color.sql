-- The hospital's brand colour (Settings → Profile & branding): a key from src/lib/theme.ts.
-- (MongoDB needs none of this — it's schemaless.)
alter table hospitals add column if not exists theme_color text not null default 'teal';
