-- ============================================================================
-- Samvaad HMS — Row Level Security
-- The application accesses Postgres exclusively through the server using the
-- Supabase service-role key, which bypasses RLS. We still enable RLS on every
-- table so that, by default, the anon/public key cannot read or write data.
-- Add explicit policies here if you later expose tables to client keys.
-- ============================================================================

alter table departments        enable row level security;
alter table users              enable row level security;
alter table doctors            enable row level security;
alter table staff              enable row level security;
alter table patients           enable row level security;
alter table appointments       enable row level security;
alter table opd_visits         enable row level security;
alter table medicines          enable row level security;
alter table prescriptions      enable row level security;
alter table prescription_items enable row level security;
alter table pharmacy_items     enable row level security;
alter table lab_tests          enable row level security;
alter table bills              enable row level security;
alter table wards              enable row level security;
alter table beds               enable row level security;
alter table ipd_admissions     enable row level security;
alter table ot_schedules       enable row level security;
alter table hospital_settings  enable row level security;
alter table audit_logs         enable row level security;

-- No policies are defined intentionally: with RLS enabled and no policies,
-- only the service-role key (used by the Samvaad HMS server) can access data.
