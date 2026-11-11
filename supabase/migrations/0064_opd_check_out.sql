-- OPD queue: the time a visit was checked in and checked out, kept as exact instants (and as the hospital-local clock text the queue shows).
alter table opd_visits add column if not exists check_in_at timestamptz;
alter table opd_visits add column if not exists check_out_at timestamptz;
alter table opd_visits add column if not exists check_out_time text not null default '';
