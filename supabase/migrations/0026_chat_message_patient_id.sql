-- ============================================================================
-- Samvaad HMS — AI Chat: link a reply to the patient it resolved to
-- Powers a "View patient" button in the chat UI, taking the user straight to
-- that patient's full detail page instead of leaving them stuck in the chat.
-- ============================================================================

alter table chat_messages
  add column if not exists patient_id bigint references patients(id) on delete set null;

create index if not exists idx_chat_messages_patient on chat_messages(patient_id);
