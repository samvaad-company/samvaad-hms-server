-- ============================================================================
-- Samvaad HMS — Lab order routing
--
-- A test can be kept in-house (lab_center_id null, the default — no behavior
-- change for hospitals that never link a center) or routed to a linked lab
-- center. The requesting doctor was never captured on this table before; it
-- is now, denormalized the same way patient_name is (mirrors
-- 0019_radiology_order_routing.sql).
-- ============================================================================

alter table lab_tests
  add column if not exists lab_center_id integer references lab_centers(id),
  add column if not exists doctor_id integer references doctors(id),
  add column if not exists doctor text not null default '';

create index if not exists idx_lab_center on lab_tests(lab_center_id);
