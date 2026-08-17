-- ============================================================================
-- Samvaad HMS — Radiology order routing
--
-- A study can be kept in-house (radiology_center_id null, the default — no
-- behavior change for hospitals that never link a center) or routed to a
-- linked radiology center. The referring doctor was never captured on this
-- table before; it is now, denormalized the same way patient_name is.
-- ============================================================================

alter table radiology_tests
  add column if not exists radiology_center_id integer references radiology_centers(id),
  add column if not exists doctor_id integer references doctors(id),
  add column if not exists doctor text not null default '';

create index if not exists idx_radiology_center on radiology_tests(radiology_center_id);
