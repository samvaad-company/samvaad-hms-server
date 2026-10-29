-- Insurance split and payouts on invoices: which contract a bill was raised under and what the payer / the patient owe, the doctor
-- the bill is in the name of, and the payout each rule earns when the bill is raised. (MongoDB needs none of this.)

alter table bills
  add column if not exists doctor_id      integer,
  add column if not exists doctor_name    text,
  add column if not exists contract_id    integer,
  add column if not exists contract_name  text,
  add column if not exists payer_share    numeric(12,2) not null default 0,
  add column if not exists patient_share  numeric(12,2);

alter table bill_items add column if not exists payer_amount numeric(12,2) not null default 0;

create table if not exists bill_payouts (
  id           serial primary key,
  hospital_id  integer not null references hospitals(id),
  bill_id      integer not null references bills(id) on delete cascade,
  bill_number  text not null,
  bill_date    text not null,
  rule_id      integer,
  rule_name    text not null,
  role         text not null,
  payee_type   text not null,
  payee_id     integer,
  payee_name   text not null,
  basis        numeric(12,2) not null default 0,
  value_kind   text not null,
  value        numeric(12,2) not null default 0,
  amount       numeric(12,2) not null default 0,
  status       text not null default 'Pending',
  paid_on      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists bill_payouts_hospital_status on bill_payouts (hospital_id, status);
create index if not exists bill_payouts_bill on bill_payouts (bill_id);
