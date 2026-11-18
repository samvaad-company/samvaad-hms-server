-- A consent can be signed with a picture of the patient's signature (uploaded by staff, background removed in the browser).
-- (MongoDB needs none of this.)
alter table signature_requests drop constraint if exists signature_requests_signed_via_check;
alter table signature_requests add constraint signature_requests_signed_via_check check (signed_via in ('phone','paper','upload'));
