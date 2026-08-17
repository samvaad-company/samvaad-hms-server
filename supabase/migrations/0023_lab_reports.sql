-- ============================================================================
-- Samvaad HMS — Lab report documents
-- Adds uploaded-report storage to lab_tests so external partner labs (role
-- "Lab Partner") can attach PDF/image reports that surface in the main
-- hospital's Lab panel (mirrors 0007_radiology_reports.sql).
-- ============================================================================

alter table lab_tests
  add column if not exists report_file        text,
  add column if not exists report_file_name   text,
  add column if not exists report_note        text,
  add column if not exists report_uploaded_by text,
  add column if not exists report_uploaded_at text;
