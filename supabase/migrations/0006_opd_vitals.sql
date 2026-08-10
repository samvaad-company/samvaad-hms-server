-- ============================================================================
-- Samvaad HMS — OPD reason, priority and clinical vitals
-- The check-in form collected a chief complaint and priority that had nowhere
-- to go, and vitals were only a boolean flag with no actual readings.
-- ============================================================================

alter table opd_visits
  add column if not exists reason       text not null default '',
  add column if not exists priority     text not null default 'Normal',
  add column if not exists bp_systolic  integer,
  add column if not exists bp_diastolic integer,
  add column if not exists pulse        integer,
  add column if not exists temperature  numeric(4,1),
  add column if not exists spo2         integer;

alter table opd_visits drop constraint if exists opd_visits_priority_check;
alter table opd_visits add constraint opd_visits_priority_check
  check (priority in ('Normal','Urgent','Emergency'));

-- Sanity bounds on the readings, matching the application-level validation.
alter table opd_visits drop constraint if exists opd_visits_vitals_check;
alter table opd_visits add constraint opd_visits_vitals_check check (
  (bp_systolic  is null or bp_systolic  between 40 and 300) and
  (bp_diastolic is null or bp_diastolic between 20 and 200) and
  (pulse        is null or pulse        between 20 and 250) and
  (temperature  is null or temperature  between 90 and 110) and
  (spo2         is null or spo2         between 50 and 100)
);

create index if not exists idx_opd_priority on opd_visits(priority);
