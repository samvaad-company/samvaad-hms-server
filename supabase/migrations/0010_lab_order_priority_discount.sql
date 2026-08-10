-- ============================================================================
-- Samvaad HMS — Lab orders, priority, discount and collection date
-- Booking several tests at once created unrelated rows that read as separate
-- patient entries; priority and discount had nowhere to be stored.
-- ============================================================================

alter table lab_tests
  add column if not exists order_number    text not null default '',
  add column if not exists requested_by    text not null default '',
  add column if not exists priority        text not null default 'Routine',
  add column if not exists collection_date text not null default '',
  add column if not exists discount        numeric(12,2) not null default 0;

alter table lab_tests drop constraint if exists lab_tests_priority_check;
alter table lab_tests add constraint lab_tests_priority_check
  check (priority in ('Routine','Urgent','STAT'));

create index if not exists idx_lab_order on lab_tests(order_number);
create index if not exists idx_lab_priority on lab_tests(priority);
