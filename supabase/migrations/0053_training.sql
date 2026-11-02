-- Training & tours: each person's progress through the guided lessons.

create table if not exists training_progress (
  id           serial primary key,
  hospital_id  integer not null references hospitals(id),
  user_id      integer not null,
  user_name    text not null default '',
  role         text not null default '',
  lesson_id    text not null,
  status       text not null default 'In progress',
  steps_seen   integer not null default 0,
  completions  integer not null default 0,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists training_progress_person_lesson on training_progress (hospital_id, user_id, lesson_id);
alter table training_progress enable row level security;
