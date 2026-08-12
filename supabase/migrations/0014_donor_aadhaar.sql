-- ============================================================================
-- Samvaad HMS — Aadhaar number on blood donors
-- Optional structured field alongside the existing ID-proof document upload,
-- so the number itself can be recorded without opening an attached scan.
-- ============================================================================

alter table blood_donors
  add column if not exists aadhaar_number text not null default '';
