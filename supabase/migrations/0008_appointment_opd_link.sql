-- ============================================================================
-- Samvaad HMS — Link OPD visits back to the appointment they came from
-- Lets a booked appointment be checked in to the OPD queue, and prevents the
-- same appointment being tokenised twice.
-- ============================================================================

alter table opd_visits
  add column if not exists appointment_id bigint references appointments(id) on delete set null;

create unique index if not exists uniq_opd_appointment
  on opd_visits(appointment_id) where appointment_id is not null;
