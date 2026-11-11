-- The patient's (or insured's) own signature on a pre-auth form: drawn on screen or uploaded, kept on the form, and printed at each
-- "Patient / Insured signature" place on the insurer's PDF. Unlike the doctor's, it belongs to this one form, not to a person's profile.
alter table preauth_forms add column if not exists patient_signature_img text;
alter table preauth_forms add column if not exists patient_signed_at timestamptz;
alter table preauth_forms add column if not exists patient_signed_by text;
