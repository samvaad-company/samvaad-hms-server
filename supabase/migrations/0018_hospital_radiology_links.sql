-- ============================================================================
-- Samvaad HMS — Hospital ↔ Radiology center linking
--
-- The relationship a hospital admin requests and a radiology center admin
-- accepts. Many-to-many: a center can serve several hospitals, and (though
-- unusual) a hospital could link more than one center.
-- ============================================================================

create table if not exists hospital_radiology_links (
  id                   serial primary key,
  hospital_id          integer not null references hospitals(id),
  radiology_center_id  integer not null references radiology_centers(id),
  status               text not null default 'Pending',
  requested_by         text not null default '',
  requested_at         text not null default '',
  responded_by         text not null default '',
  responded_at         text not null default '',
  revoked_by           text not null default '',
  revoked_at           text not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_hrl_hospital on hospital_radiology_links(hospital_id);
create index if not exists idx_hrl_center on hospital_radiology_links(radiology_center_id);
create index if not exists idx_hrl_status on hospital_radiology_links(status);
