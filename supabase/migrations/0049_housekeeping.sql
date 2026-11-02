-- Housekeeping: cleaning tasks (routine, bed turnaround, ad hoc) and the linen ledger.

create table if not exists hk_tasks (
  id               serial primary key,
  hospital_id      integer not null references hospitals(id),
  kind             text not null default 'Ad hoc',
  source           text not null default 'Manual',
  title            text not null default '',
  ward_id          integer,
  ward             text not null default '',
  bed_id           integer,
  location         text not null default '',
  assignee         text not null default '',
  notes            text not null default '',
  status           text not null default 'Pending',
  task_date        date not null default current_date,
  started_at       timestamptz,
  completed_at     timestamptz,
  completion_notes text not null default '',
  verified_by      text not null default '',
  verified_at      timestamptz,
  created_by       text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists hk_tasks_hospital on hk_tasks (hospital_id, status, task_date desc);
create index if not exists hk_tasks_bed on hk_tasks (bed_id);

create table if not exists hk_linen_categories (
  id          serial primary key,
  hospital_id integer not null references hospitals(id),
  name        text not null,
  unit        text not null default 'piece',
  reorder_at  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists hk_linen_categories_name on hk_linen_categories (hospital_id, lower(name));

create table if not exists hk_linen_moves (
  id           serial primary key,
  hospital_id  integer not null references hospitals(id),
  category_id  integer not null references hk_linen_categories(id),
  category     text not null default '',
  kind         text not null,
  quantity     integer not null check (quantity > 0),
  from_bucket  text not null default '',
  to_bucket    text not null default '',
  ward_id      integer,
  ward         text not null default '',
  notes        text not null default '',
  from_balance integer,
  to_balance   integer,
  created_by   text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists hk_linen_moves_cat on hk_linen_moves (hospital_id, category_id, created_at desc);

alter table hk_tasks enable row level security;
alter table hk_linen_categories enable row level security;
alter table hk_linen_moves enable row level security;
