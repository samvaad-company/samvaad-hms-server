-- ============================================================================
-- Samvaad HMS — Discount instead of a fixed price
--
-- A study/test's price is set by whoever performs it — in-house, or the
-- linked radiology/lab center it's routed to — not decided by this system.
-- Only a discount the referring doctor grants is captured here, expressed as
-- either a percentage or a flat rupee amount off whatever the eventual price
-- turns out to be.
-- ============================================================================

alter table radiology_tests
  add column if not exists discount      numeric(12,2) not null default 0,
  add column if not exists discount_type text not null default 'amount';

alter table radiology_tests drop constraint if exists radiology_tests_discount_type_check;
alter table radiology_tests add constraint radiology_tests_discount_type_check
  check (discount_type in ('percent', 'amount'));

alter table lab_tests
  add column if not exists discount_type text not null default 'amount';

alter table lab_tests drop constraint if exists lab_tests_discount_type_check;
alter table lab_tests add constraint lab_tests_discount_type_check
  check (discount_type in ('percent', 'amount'));
