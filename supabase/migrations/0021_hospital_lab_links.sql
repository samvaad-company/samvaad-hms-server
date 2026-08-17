-- ============================================================================
-- Samvaad HMS — Hospital ↔ Lab center linking
--
-- The relationship a hospital admin requests and a lab center admin accepts.
-- Many-to-many: a center can serve several hospitals, and (though unusual) a
-- hospital could link more than one lab.
-- ============================================================================

create table if not exists hospital_lab_links (
  id              serial primary key,
  hospital_id     integer not null references hospitals(id),
  lab_center_id   integer not null references lab_centers(id),
  status          text not null default 'Pending',
  requested_by    text not null default '',
  requested_at    text not null default '',
  responded_by    text not null default '',
  responded_at    text not null default '',
  revoked_by      text not null default '',
  revoked_at      text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_hll_hospital on hospital_lab_links(hospital_id);
create index if not exists idx_hll_center on hospital_lab_links(lab_center_id);
create index if not exists idx_hll_status on hospital_lab_links(status);
