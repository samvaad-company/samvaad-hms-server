-- The times of day an inpatient medicine is given ("HH:mm,HH:mm": morning, afternoon, evening and any extra); empty = the ward's usual rounds.
-- (MongoDB needs none of this.)
alter table ipd_medications add column if not exists dose_times text not null default '';
