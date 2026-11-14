-- H1 register: a pharmacy dispense line or sale line that is a Schedule H1 drug goes in the register.
-- (MongoDB needs none of this.)
alter table pharmacy_dispense_lines add column if not exists is_h1 boolean not null default false;
alter table pharmacy_sale_items add column if not exists is_h1 boolean not null default false;
create index if not exists idx_dispense_lines_h1 on pharmacy_dispense_lines(hospital_id) where is_h1;
