-- ============================================================================
-- Samvaad HMS — Lab centers as an independent tenant type
--
-- A lab center is not owned by any one hospital — it's a third tenant kind
-- (alongside hospitals and radiology centers) that can serve many hospitals
-- once linked. Its accounts therefore can't carry a hospital_id the way every
-- other user does; they carry lab_center_id instead. Exactly one of
-- hospital_id / radiology_center_id / lab_center_id must be set, enforced by
-- a check constraint rather than trusted to application code alone.
-- ============================================================================

create table if not exists lab_centers (
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
  add column if not exists lab_center_id integer references lab_centers(id);

alter table users
  drop constraint if exists chk_users_one_tenant;

alter table users
  add constraint chk_users_one_tenant
  check (
    (case when hospital_id is not null then 1 else 0 end)
    + (case when radiology_center_id is not null then 1 else 0 end)
    + (case when lab_center_id is not null then 1 else 0 end)
    = 1
  );

create index if not exists idx_users_lab_center on users(lab_center_id);
