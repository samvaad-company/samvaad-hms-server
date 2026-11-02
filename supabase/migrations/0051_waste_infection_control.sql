-- Waste & infection control: biomedical waste collection and disposal, infection events, hand hygiene audits.

create table if not exists waste_collections (
  id             serial primary key,
  hospital_id    integer not null references hospitals(id),
  collected_on   date not null,
  collected_time text not null default '',
  ward_id        integer,
  ward           text not null default '',
  category       text not null check (category in ('white', 'red', 'yellow', 'blue')),
  quantity_kg    numeric(8,2) not null check (quantity_kg > 0),
  bags           integer not null default 1 check (bags >= 0),
  notes          text not null default '',
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists waste_collections_day on waste_collections (hospital_id, collected_on desc, category);

create table if not exists waste_disposals (
  id          serial primary key,
  hospital_id integer not null references hospitals(id),
  disposed_on date not null,
  category    text not null check (category in ('white', 'red', 'yellow', 'blue')),
  quantity_kg numeric(8,2) not null check (quantity_kg > 0),
  vendor      text not null default '',
  manifest_no text not null default '',
  vehicle     text not null default '',
  notes       text not null default '',
  created_by  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists waste_disposals_day on waste_disposals (hospital_id, disposed_on desc);

create table if not exists ic_events (
  id               serial primary key,
  hospital_id      integer not null references hospitals(id),
  event_date       date not null,
  ward_id          integer,
  ward             text not null default '',
  patient_name     text not null default '',
  patient_code     text not null default '',
  infection_type   text not null,
  organism         text not null default '',
  device_procedure text not null default '',
  status           text not null default 'Open',
  resolved_on      date,
  notes            text not null default '',
  created_by       text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists ic_events_day on ic_events (hospital_id, event_date desc, status);

create table if not exists hand_hygiene_audits (
  id          serial primary key,
  hospital_id integer not null references hospitals(id),
  audit_date  date not null,
  ward_id     integer,
  ward        text not null default '',
  observed    integer not null check (observed > 0),
  compliant   integer not null check (compliant >= 0),
  auditor     text not null default '',
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (compliant <= observed)
);
create index if not exists hand_hygiene_day on hand_hygiene_audits (hospital_id, audit_date desc);

alter table waste_collections enable row level security;
alter table waste_disposals enable row level security;
alter table ic_events enable row level security;
alter table hand_hygiene_audits enable row level security;
