-- H1 register: a pharmacy dispense line or sale line that is a Schedule H1 drug goes in the register.
-- (MongoDB needs none of this.)
alter table pharmacy_dispense_lines add column if not exists is_h1 boolean not null default false;
alter table pharmacy_sale_items add column if not exists is_h1 boolean not null default false;
create index if not exists idx_dispense_lines_h1 on pharmacy_dispense_lines(hospital_id) where is_h1;
alter table bill_items add column if not exists is_h1 boolean not null default false;
-- who gave the H1 drug: a name (the biller by default) and the user's id.
alter table bill_items add column if not exists given_by text;
alter table bill_items add column if not exists given_by_id bigint;
alter table pharmacy_sale_items add column if not exists given_by text;
alter table pharmacy_sale_items add column if not exists given_by_id bigint;
alter table pharmacy_dispenses add column if not exists dispensed_by_id bigint;
-- the batch a billed / sold medicine came from.
alter table bill_items add column if not exists batch_no text;
alter table pharmacy_sale_items add column if not exists batch_no text;
