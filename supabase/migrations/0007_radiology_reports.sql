-- ============================================================================
-- Samvaad HMS — Radiology report documents
-- Adds uploaded-report storage to radiology_tests so external partner centres
-- (role "Radiology Partner") can attach PDF/image reports that surface in the
-- main hospital's Radiology panel.
-- ============================================================================

alter table radiology_tests
  add column if not exists report_file        text,
  add column if not exists report_file_name   text,
  add column if not exists report_note        text,
  add column if not exists report_uploaded_by text,
  add column if not exists report_uploaded_at text;
