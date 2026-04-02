-- ═══════════════════════════════════════════════════════════════════════
-- SOSPHD Initial Schema
-- Mirrors TypeScript types in lib/data/*-types.ts exactly.
-- Run against the Supabase SQL editor or via supabase db push.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Enums ───────────────────────────────────────────────────────────────

create type case_status    as enum ('open', 'active', 'closed');
create type severity_level as enum ('1', '2', '3', '4', '5');
create type event_type     as enum (
  'FIRST_CONTACT',
  'TRIAGE_COMPLETE',
  'TRANSPORT_ACTIVATED',
  'FACILITY_ARRIVAL',
  'GUARANTEED_PAYMENT',
  'DEFINITIVE_CARE_START',
  'DISCHARGE',
  'NOTE'
);
create type engine_type     as enum ('rule_based', 'ml_model', 'llm');
create type confidence_type as enum ('probability', 'categorical');
create type user_role       as enum ('operator', 'coordinator', 'supervisor', 'researcher');
create type doc_status      as enum ('draft', 'active', 'archived');
create type task_status     as enum ('todo', 'doing', 'done');
create type upload_category as enum ('transcript', 'pdf', 'image', 'video', 'document', 'other');
create type advisor_role    as enum ('user', 'assistant', 'system');

-- ── Sites ───────────────────────────────────────────────────────────────

create table sites (
  id           text primary key,
  name         text not null,
  country_code text not null,
  city         text not null
);

-- ── Profiles ────────────────────────────────────────────────────────────

create table profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  email     text not null,
  full_name text not null,
  role      user_role not null default 'operator',
  site_id   text references sites(id)
);

-- ── Cases ───────────────────────────────────────────────────────────────

create table cases (
  id               text primary key,
  site_id          text not null references sites(id),
  created_at       timestamptz not null default now(),
  status           case_status not null default 'open',
  severity         int not null check (severity between 1 and 5),
  chief_complaint  text not null,
  patient_ref      text not null,
  notes            text not null default ''
);

create index idx_cases_status     on cases(status);
create index idx_cases_site_id    on cases(site_id);
create index idx_cases_created_at on cases(created_at desc);

-- ── Case Events (immutable provenance spine) ────────────────────────────

create table case_events (
  id          text primary key,
  case_id     text not null references cases(id) on delete cascade,
  occurred_at timestamptz not null,
  event_type  event_type not null,
  actor_id    text not null,
  payload     text not null default ''
);

create index idx_events_case_id     on case_events(case_id);
create index idx_events_occurred_at on case_events(occurred_at);

-- ── Recommendations (AI provenance) ─────────────────────────────────────

create table recommendations (
  id               text primary key,
  case_id          text not null references cases(id) on delete cascade,
  created_at       timestamptz not null default now(),
  engine_type      engine_type not null,
  engine_version   text not null,
  confidence_type  confidence_type not null,
  confidence_value float not null check (confidence_value between 0 and 1),
  recommendation   text not null,
  explanation      text not null,
  accepted         boolean,          -- null = pending
  override_reason  text
);

create index idx_recs_case_id on recommendations(case_id);

-- ── Docs ────────────────────────────────────────────────────────────────

create table docs (
  id             text primary key default 'doc_' || substr(uuid_generate_v4()::text, 1, 8),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  site_id        text references sites(id),
  title          text not null,
  slug           text,
  folder         text not null default 'General',
  tags           text[] not null default '{}',
  content_md     text not null default '',
  status         doc_status not null default 'draft',
  linked_case_id text references cases(id)
);

create index idx_docs_user_id on docs(user_id);
create index idx_docs_folder  on docs(folder);

-- ── Doc Versions ────────────────────────────────────────────────────────

create table doc_versions (
  id         text primary key default 'dv_' || substr(uuid_generate_v4()::text, 1, 8),
  created_at timestamptz not null default now(),
  doc_id     text not null references docs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content_md text not null,
  note       text
);

create index idx_doc_versions_doc_id on doc_versions(doc_id);

-- ── Research Notes ──────────────────────────────────────────────────────

create table research_notes (
  id             text primary key default 'note_' || substr(uuid_generate_v4()::text, 1, 8),
  created_at     timestamptz not null default now(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  site_id        text references sites(id),
  title          text,
  content        text not null,
  tags           text[] not null default '{}',
  linked_case_id text references cases(id)
);

create index idx_notes_user_id on research_notes(user_id);

-- ── Research Tasks ──────────────────────────────────────────────────────

create table research_tasks (
  id             text primary key default 'task_' || substr(uuid_generate_v4()::text, 1, 8),
  created_at     timestamptz not null default now(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  site_id        text references sites(id),
  status         task_status not null default 'todo',
  priority       int not null default 2 check (priority between 1 and 3),
  due_date       date,
  title          text not null,
  description    text,
  linked_case_id text references cases(id)
);

create index idx_tasks_user_id on research_tasks(user_id);
create index idx_tasks_status  on research_tasks(status);

-- ── Advisor Sessions ────────────────────────────────────────────────────

create table advisor_sessions (
  id         text primary key default 'sess_' || substr(uuid_generate_v4()::text, 1, 8),
  created_at timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null
);

create index idx_sessions_user_id on advisor_sessions(user_id);

-- ── Advisor Messages ────────────────────────────────────────────────────

create table advisor_messages (
  id               text primary key default 'msg_' || substr(uuid_generate_v4()::text, 1, 8),
  created_at       timestamptz not null default now(),
  session_id       text not null references advisor_sessions(id) on delete cascade,
  role             advisor_role not null,
  content          text not null,
  context_snapshot jsonb
);

create index idx_messages_session_id on advisor_messages(session_id);

-- ── Uploads ─────────────────────────────────────────────────────────────

create table uploads (
  id             text primary key default 'upl_' || substr(uuid_generate_v4()::text, 1, 8),
  created_at     timestamptz not null default now(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  filename       text not null,
  mime_type      text not null,
  size_bytes     bigint not null,
  category       upload_category not null default 'other',
  url            text not null,
  tags           text[] not null default '{}',
  notes          text not null default '',
  linked_case_id text references cases(id),
  linked_doc_id  text references docs(id)
);

create index idx_uploads_user_id on uploads(user_id);

-- ── Mind Maps ───────────────────────────────────────────────────────────

create table mind_maps (
  id         text primary key default 'mm_' || substr(uuid_generate_v4()::text, 1, 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  nodes      jsonb not null default '[]',
  edges      jsonb not null default '[]'
);

create index idx_mind_maps_user_id on mind_maps(user_id);

-- ── Row Level Security (RLS) ────────────────────────────────────────────
-- Enable RLS on all user-owned tables. Policies restrict to own data.

alter table profiles        enable row level security;
alter table cases           enable row level security;
alter table case_events     enable row level security;
alter table recommendations enable row level security;
alter table docs            enable row level security;
alter table doc_versions    enable row level security;
alter table research_notes  enable row level security;
alter table research_tasks  enable row level security;
alter table advisor_sessions enable row level security;
alter table advisor_messages enable row level security;
alter table uploads         enable row level security;
alter table mind_maps       enable row level security;

-- Profile: users see only their own
create policy "Users read own profile"  on profiles for select using (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- Cases: all authenticated users at the same site can read
create policy "Authenticated users read cases" on cases for select using (true);
create policy "Authenticated users insert cases" on cases for insert with check (true);
create policy "Authenticated users update cases" on cases for update using (true);

-- Events: same as cases (shared provenance)
create policy "Authenticated users read events" on case_events for select using (true);
create policy "Authenticated users insert events" on case_events for insert with check (true);

-- Recommendations: shared
create policy "Authenticated users read recs" on recommendations for select using (true);
create policy "Authenticated users insert recs" on recommendations for insert with check (true);
create policy "Authenticated users update recs" on recommendations for update using (true);

-- Docs: user owns their docs
create policy "Users manage own docs" on docs for all using (auth.uid() = user_id);

-- Doc versions: user owns
create policy "Users manage own doc versions" on doc_versions for all using (auth.uid() = user_id);

-- Notes: user owns
create policy "Users manage own notes" on research_notes for all using (auth.uid() = user_id);

-- Tasks: user owns
create policy "Users manage own tasks" on research_tasks for all using (auth.uid() = user_id);

-- Sessions: user owns
create policy "Users manage own sessions" on advisor_sessions for all using (auth.uid() = user_id);

-- Messages: user owns via session
create policy "Users manage own messages" on advisor_messages for all
  using (session_id in (select id from advisor_sessions where user_id = auth.uid()));

-- Uploads: user owns
create policy "Users manage own uploads" on uploads for all using (auth.uid() = user_id);

-- Mind maps: user owns
create policy "Users manage own mind maps" on mind_maps for all using (auth.uid() = user_id);
