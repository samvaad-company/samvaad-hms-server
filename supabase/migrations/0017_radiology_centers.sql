-- ============================================================================
-- Samvaad HMS — Radiology centers as an independent tenant type
--
-- A radiology center is not owned by any one hospital — it's a second tenant
-- kind that (once Phase 3's linking table exists) can serve many hospitals.
-- Its accounts therefore can't carry a hospital_id the way every other user
-- does; they carry radiology_center_id instead. Exactly one of the two must
-- be set, enforced by a check constraint rather than trusted to application
-- code alone.
-- ============================================================================

create table if not exists radiology_centers (
  id             serial primary key,
  code           text not null,
  status         text not null default 'Active',
  name           text not null,
  address        text not null default '',
  city           text not null default '',
  state          text not null default '',
  phone          text not null default '',
  contact_email  text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table users
  add column if not exists radiology_center_id integer references radiology_centers(id);

alter table users
  alter column hospital_id drop not null;

alter table users
  add constraint chk_users_one_tenant
  check ((hospital_id is not null) <> (radiology_center_id is not null));

create index if not exists idx_users_radiology_center on users(radiology_center_id);
