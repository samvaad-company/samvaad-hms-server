-- ============================================================================
-- Samvaad HMS — QR + geofenced staff attendance
-- Staff scan a rotating QR shown at reception from the attendance PWA; the
-- server checks the signed token and that the phone is within the hospital's
-- geofence before recording the punch.
-- ============================================================================

alter table hospitals
  add column if not exists latitude          double precision,
  add column if not exists longitude         double precision,
  add column if not exists geofence_radius_m integer not null default 150
    check (geofence_radius_m between 20 and 5000);

alter table users
  add column if not exists staff_id bigint references staff(id) on delete set null;
create index if not exists idx_users_staff_id on users(staff_id);

alter table staff_attendance
  add column if not exists method          text not null default 'manual',
  add column if not exists punch_in_at     timestamptz,
  add column if not exists punch_out_at    timestamptz,
  add column if not exists in_lat          double precision,
  add column if not exists in_lng          double precision,
  add column if not exists in_distance_m   integer,
  add column if not exists out_lat         double precision,
  add column if not exists out_lng         double precision,
  add column if not exists out_distance_m  integer;
