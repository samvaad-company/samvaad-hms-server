-- Consents: a form is made first (Draft), then printed for paper signing or sent as a link to sign on a phone, in
-- English, Hindi or Gujarati. A link can be cancelled or expire and be replaced; the first time the patient opens it
-- is recorded; a form signed on paper keeps its scanned copy. Documents gain a display title and a reference number.
-- (MongoDB needs none of this.)

alter table signature_requests alter column token drop not null;
alter table signature_requests alter column expires_at drop not null;
alter table signature_requests drop constraint if exists signature_requests_status_check;
alter table signature_requests add constraint signature_requests_status_check check (status in ('Draft','Waiting','Signed','Refused','Cancelled'));

alter table signature_requests
  add column if not exists template_key       text not null default '',
  add column if not exists include_english    boolean not null default false,
  add column if not exists link_sent_at       timestamptz,
  add column if not exists delivery           text check (delivery in ('qr','email','whatsapp','device')),
  add column if not exists opened_at          timestamptz,
  add column if not exists signer_relation    text,
  add column if not exists signed_via         text check (signed_via in ('phone','paper')),
  add column if not exists signed_language    text,
  add column if not exists witness_name       text,
  add column if not exists signed_document_id bigint references documents(id) on delete set null;
create index if not exists idx_signature_requests_patient on signature_requests(patient_id, sent_at desc);

alter table documents
  add column if not exists title        text,
  add column if not exists reference_no text;
