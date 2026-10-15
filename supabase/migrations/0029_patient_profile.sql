-- ============================================================================
-- Samvaad HMS — wider patient profile (registration form)
-- Personal, work, payer, identity-document and COVID details, all optional.
-- Identity documents keep only the last four characters and a keyed hash, never the full number.
-- (MongoDB needs none of this — it's schemaless.)
-- ============================================================================

alter table patients
  add column if not exists age_months        integer check (age_months between 0 and 11),
  add column if not exists referral_source   text,
  add column if not exists medico_legal      boolean not null default false,
  add column if not exists is_temporary      boolean not null default false,
  add column if not exists data_consent      boolean not null default false,
  add column if not exists alternate_phone   text,
  add column if not exists address_line2     text,
  add column if not exists title             text,
  add column if not exists guardian_name     text,
  add column if not exists care_of           text,
  add column if not exists anniversary       text,
  add column if not exists marital_status    text,
  add column if not exists religion          text,
  add column if not exists language          text,
  add column if not exists nationality       text,
  add column if not exists education         text,
  add column if not exists notes             text,
  add column if not exists occupation        text,
  add column if not exists employer          text,
  add column if not exists designation       text,
  add column if not exists work_phone        text,
  add column if not exists privilege_card_no text,
  add column if not exists payers            jsonb not null default '[]'::jsonb,
  add column if not exists identity_documents jsonb not null default '[]'::jsonb,
  add column if not exists covid_details     jsonb;
