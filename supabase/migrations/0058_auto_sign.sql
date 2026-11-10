-- ============================================================================
-- Samvaad HMS: automatic signing for doctors.
--   * signature_assets.auto_sign: on a doctor's signature row, the doctor has chosen to have pre-auth forms signed automatically
--     the moment they are sent to them. Turning it off (or removing the signature) stops it.
--   * preauth_forms.doctor_signed_auto: the doctor's signature on this form was applied automatically, not by hand.
-- ============================================================================

alter table signature_assets add column if not exists auto_sign boolean not null default false;
alter table preauth_forms    add column if not exists doctor_signed_auto boolean not null default false;
