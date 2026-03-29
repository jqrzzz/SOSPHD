-- ═══════════════════════════════════════════════════════════════════════
-- ResearchOS Advisor Module — Schema Extension v0.2
-- Target: Supabase (PostgreSQL 15+)
-- Depends on: 001-create-tables.sql
-- DO NOT EXECUTE until Supabase integration is connected.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Research Notes ───────────────────────────────────────────────────
create table if not exists research_notes (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  site_id         uuid references sites(id),
  title           text,
  content         text not null,
  tags            text[] not null default '{}',
  linked_case_id  uuid references cases(id) on delete set null
);

create index if not exists idx_research_notes_user on research_notes(user_id);
create index if not exists idx_research_notes_case on research_notes(linked_case_id);

-- ── Tasks ────────────────────────────────────────────────────────────
create table if not exists tasks (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  site_id         uuid references sites(id),
  status          text not null default 'todo'
                  check (status in ('todo', 'doing', 'done')),
  priority        int not null default 2
                  check (priority between 1 and 3),
  due_date        date,
  title           text not null,
  description     text,
  linked_case_id  uuid references cases(id) on delete set null
);

create index if not exists idx_tasks_user on tasks(user_id);
create index if not exists idx_tasks_status on tasks(status);

-- ── Advisor Sessions ─────────────────────────────────────────────────
create table if not exists advisor_sessions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Advisor Session'
);

create index if not exists idx_advisor_sessions_user on advisor_sessions(user_id);

-- ── Advisor Messages ─────────────────────────────────────────────────
create table if not exists advisor_messages (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  session_id        uuid not null references advisor_sessions(id) on delete cascade,
  role              text not null check (role in ('user', 'assistant', 'system')),
  content           text not null,
  context_snapshot  jsonb
);

create index if not exists idx_advisor_messages_session on advisor_messages(session_id);

-- ── Row Level Security ──────────────────────────────────────────────

alter table research_notes enable row level security;
alter table tasks enable row level security;
alter table advisor_sessions enable row level security;
alter table advisor_messages enable row level security;

-- Research Notes: users can only read/write their own
create policy "Users can read own notes"
  on research_notes for select
  using (auth.uid() = user_id);

create policy "Users can create own notes"
  on research_notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notes"
  on research_notes for update
  using (auth.uid() = user_id);

create policy "Users can delete own notes"
  on research_notes for delete
  using (auth.uid() = user_id);

-- Tasks: users can only read/write their own
create policy "Users can read own tasks"
  on tasks for select
  using (auth.uid() = user_id);

create policy "Users can create own tasks"
  on tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete own tasks"
  on tasks for delete
  using (auth.uid() = user_id);

-- Advisor Sessions: users can only read/write their own
create policy "Users can read own sessions"
  on advisor_sessions for select
  using (auth.uid() = user_id);

create policy "Users can create own sessions"
  on advisor_sessions for insert
  with check (auth.uid() = user_id);

-- Advisor Messages: users can read messages from their sessions
create policy "Users can read own session messages"
  on advisor_messages for select
  using (
    session_id in (
      select id from advisor_sessions where user_id = auth.uid()
    )
  );

create policy "Users can create messages in own sessions"
  on advisor_messages for insert
  with check (
    session_id in (
      select id from advisor_sessions where user_id = auth.uid()
    )
  );
