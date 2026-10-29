-- Wards tied to the Setup masters: the ward class (which rate plans and bed-charge service apply) and the facility area (where the
-- ward is). Nullable — an existing ward keeps working until someone sets them. (MongoDB needs none of this.)

alter table wards
  add column if not exists ward_class_id    integer,
  add column if not exists facility_area_id integer;
