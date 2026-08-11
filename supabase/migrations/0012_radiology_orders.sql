-- ============================================================================
-- Samvaad HMS — Radiology orders
-- Selecting two studies created unrelated rows that read as separate patient
-- entries; studies ordered together now share one order number.
-- ============================================================================

alter table radiology_tests
  add column if not exists order_number text not null default '';

create index if not exists idx_radiology_order on radiology_tests(order_number);
