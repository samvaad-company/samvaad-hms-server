-- Ambulance dispatch: a call can be queued before it has a vehicle, moves through at scene / transporting, and carries a call number,
-- a type and the times of each step; vehicles get a board code and a type.

alter table ambulances add column if not exists code text not null default '';
alter table ambulances add column if not exists vehicle_type text not null default '';

alter table ambulance_calls add column if not exists call_no text not null default '';
alter table ambulance_calls add column if not exists call_type text not null default 'Emergency pickup';
alter table ambulance_calls add column if not exists patient_id bigint references patients(id) on delete set null;
alter table ambulance_calls add column if not exists dispatched_at timestamptz;
alter table ambulance_calls add column if not exists at_scene_at timestamptz;
alter table ambulance_calls add column if not exists closed_at timestamptz;

alter table ambulance_calls drop constraint if exists ambulance_calls_status_check;
alter table ambulance_calls add constraint ambulance_calls_status_check
  check (status in ('Queued','Dispatched','At scene','Transporting','Completed','Cancelled'));
-- A call whose patient isn't known has no name; the caller may not be a patient at all.
alter table ambulance_calls alter column patient_name set default 'Unidentified';
