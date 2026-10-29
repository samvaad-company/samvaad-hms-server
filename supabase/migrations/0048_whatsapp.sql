-- A hospital's connected WhatsApp Business number (Meta Cloud API) and a log of the messages sent and received through it.
-- The access token is stored encrypted by the server. (MongoDB needs none of this.)

create table if not exists whatsapp_accounts (
  id                      serial primary key,
  hospital_id             integer not null references hospitals(id),
  waba_id                 text not null,
  phone_number_id         text not null unique,
  display_phone           text not null default '',
  verified_name           text not null default '',
  access_token_enc        text not null,
  api_version             text not null default 'v21.0',
  connected_via           text not null default 'manual',
  subscribed              boolean not null default false,
  bot_enabled             boolean not null default true,
  consent_template        text not null default '',
  consent_template_lang   text not null default 'en',
  consent_template_format text not null default 'positional',
  default_country         text not null default '91',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create unique index if not exists whatsapp_accounts_hospital on whatsapp_accounts (hospital_id);

create table if not exists whatsapp_messages (
  id            serial primary key,
  hospital_id   integer not null references hospitals(id),
  direction     text not null,
  phone         text not null,
  kind          text not null default 'bot',
  body          text not null default '',
  wa_message_id text,
  status        text not null default 'sent',
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists whatsapp_messages_hospital on whatsapp_messages (hospital_id, created_at desc);
create index if not exists whatsapp_messages_wa_id on whatsapp_messages (wa_message_id);
