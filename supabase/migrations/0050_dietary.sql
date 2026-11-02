-- Dietary & kitchen: diet types, patients' diet orders, the kitchen's daily sheets, and the canteen.

create table if not exists diet_types (
  id           serial primary key,
  hospital_id  integer not null references hospitals(id),
  name         text not null,
  instructions text not null default '',
  meals        jsonb not null default '["Breakfast","Lunch","Dinner"]',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists diet_types_name on diet_types (hospital_id, lower(name));

create table if not exists diet_orders (
  id            serial primary key,
  hospital_id   integer not null references hospitals(id),
  admission_id  integer not null,
  patient_id    integer,
  patient_name  text not null default '',
  patient_code  text not null default '',
  ward_id       integer,
  ward          text not null default '',
  bed_id        integer,
  bed           text not null default '',
  diet_type_id  integer,
  diet_name     text not null default '',
  meals         jsonb not null default '[]',
  instructions  text not null default '',
  status        text not null default 'Active',
  start_date    date not null default current_date,
  stopped_on    date,
  created_by    text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists diet_orders_hospital on diet_orders (hospital_id, status, ward_id);

create table if not exists diet_sheets (
  id            serial primary key,
  hospital_id   integer not null references hospitals(id),
  sheet_date    date not null,
  ward_id       integer,
  ward          text not null default '',
  status        text not null default 'Draft',
  generated_by  text not null default '',
  dispatched_at timestamptz,
  dispatched_by text not null default '',
  received_at   timestamptz,
  received_by   text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists diet_sheets_day on diet_sheets (hospital_id, sheet_date, coalesce(ward_id, 0));

create table if not exists diet_sheet_lines (
  id            serial primary key,
  hospital_id   integer not null references hospitals(id),
  sheet_id      integer not null references diet_sheets(id) on delete cascade,
  order_id      integer not null,
  meal          text not null,
  patient_name  text not null default '',
  patient_code  text not null default '',
  bed           text not null default '',
  diet_name     text not null default '',
  instructions  text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (sheet_id, order_id, meal)
);

create table if not exists canteen_items (
  id          serial primary key,
  hospital_id integer not null references hospitals(id),
  name        text not null,
  price       numeric(10,2) not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists canteen_items_name on canteen_items (hospital_id, lower(name));

create table if not exists canteen_sales (
  id          serial primary key,
  hospital_id integer not null references hospitals(id),
  item_id     integer not null references canteen_items(id),
  item        text not null default '',
  quantity    integer not null check (quantity > 0),
  unit_price  numeric(10,2) not null default 0,
  total       numeric(10,2) not null default 0,
  buyer_type  text not null default 'Staff',
  buyer       text not null default '',
  sale_date   date not null default current_date,
  created_by  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists canteen_sales_day on canteen_sales (hospital_id, sale_date);

alter table diet_types enable row level security;
alter table diet_orders enable row level security;
alter table diet_sheets enable row level security;
alter table diet_sheet_lines enable row level security;
alter table canteen_items enable row level security;
alter table canteen_sales enable row level security;
