-- The consent a patient accepts when booking a video consultation: when they accepted it and the wording they accepted.
alter table public.teleconsult_bookings
  add column if not exists consent_accepted_at timestamptz,
  add column if not exists consent_text text;
