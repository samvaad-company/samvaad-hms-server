-- ============================================================================
-- Samvaad HMS — Radiology study priority
--
-- The ordering doctor marks each imaging order Routine, Urgent or STAT. The
-- radiology worklist sorts on it and shows it as a tag on every study.
-- ============================================================================

alter table radiology_tests
  add column if not exists priority text not null default 'Routine';

alter table radiology_tests drop constraint if exists radiology_tests_priority_check;
alter table radiology_tests add constraint radiology_tests_priority_check
  check (priority in ('Routine', 'Urgent', 'STAT'));
