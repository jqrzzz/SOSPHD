-- ═══════════════════════════════════════════════════════════════════════
-- ResearchOS Docs Module — Schema Extension v0.3
-- Target: Supabase (PostgreSQL 15+)
-- Depends on: 001-create-tables.sql
-- DO NOT EXECUTE until Supabase integration is connected.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Docs ─────────────────────────────────────────────────────────────
create table if not exists docs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  site_id         uuid references sites(id),
  title           text not null,
  slug            text,
  folder          text not null default 'General',
  tags            text[] not null default '{}',
  content_md      text not null default '',
  status          text not null default 'draft'
                  check (status in ('draft', 'active', 'archived')),
  linked_case_id  uuid references cases(id) on delete set null
);

create index if not exists idx_docs_user on docs(user_id);
create index if not exists idx_docs_folder on docs(folder);
create index if not exists idx_docs_status on docs(status);
create index if not exists idx_docs_case on docs(linked_case_id);

-- Auto-update updated_at on modification
create or replace function update_docs_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

create trigger docs_updated_at
  before update on docs
  for each row
  execute function update_docs_updated_at();

-- ── Doc Versions ─────────────────────────────────────────────────────
create table if not exists doc_versions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  doc_id      uuid not null references docs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content_md  text not null,
  note        text
);

create index if not exists idx_doc_versions_doc on doc_versions(doc_id);

-- ── Row Level Security ──────────────────────────────────────────────

alter table docs enable row level security;
alter table doc_versions enable row level security;

-- Docs: users can only read/write their own
create policy "Users can read own docs"
  on docs for select
  using (auth.uid() = user_id);

create policy "Users can create own docs"
  on docs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own docs"
  on docs for update
  using (auth.uid() = user_id);

create policy "Users can delete own docs"
  on docs for delete
  using (auth.uid() = user_id);

-- Doc versions: users can read/write versions of their own docs
create policy "Users can read own doc versions"
  on doc_versions for select
  using (
    doc_id in (
      select id from docs where user_id = auth.uid()
    )
  );

create policy "Users can create own doc versions"
  on doc_versions for insert
  with check (
    doc_id in (
      select id from docs where user_id = auth.uid()
    )
  );
