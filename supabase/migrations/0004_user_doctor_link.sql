-- ============================================================================
-- Samvaad HMS — Link user accounts to doctor records
-- A Doctor-role login carries doctor_id so the app can personalize the
-- doctor panel (my appointments, my queue, my patients).
-- ============================================================================

alter table users
  add column if not exists doctor_id bigint references doctors(id) on delete set null;

create index if not exists idx_users_doctor on users(doctor_id);
