-- Enquiries: the lead status "Follow-up" is now "Contacted", so "follow-up" only ever means a patient's
-- return visit (the followups table). The call-back date column keeps its name, follow_up_on.
-- (MongoDB: the server renames the stored value itself on the next start.)

alter table enquiries drop constraint if exists enquiries_status_check;
update enquiries set status = 'Contacted' where status = 'Follow-up';
alter table enquiries add constraint enquiries_status_check
  check (status in ('Open','Contacted','Converted','Closed'));
