-- ═══════════════════════════════════════════════════════════════════════
-- ResearchOS Schema v0.1 — Decision Provenance for Tourist SOS
-- Target: Supabase (PostgreSQL 15+)
-- DO NOT EXECUTE until Supabase integration is connected.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Sites ────────────────────────────────────────────────────────────
create table if not exists sites (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  country_code char(2) not null,
  city        text not null,
  created_at  timestamptz not null default now()
);

-- ── Profiles (extends Supabase auth.users) ──────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        text not null default 'operator'
              check (role in ('operator','coordinator','supervisor','researcher')),
  site_id     uuid references sites(id),
  created_at  timestamptz not null default now()
);

-- ── Cases ────────────────────────────────────────────────────────────
create table if not exists cases (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references sites(id),
  created_at       timestamptz not null default now(),
  status           text not null default 'open'
                   check (status in ('open','active','closed')),
  severity         smallint not null check (severity between 1 and 5),
  chief_complaint  text not null,
  patient_ref      text not null,
  notes            text not null default ''
);

-- ── Events (the provenance spine) ───────────────────────────────────
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references cases(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  event_type  text not null,
  actor_id    uuid references profiles(id),
  payload     text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists idx_events_case_id on events(case_id);
create index if not exists idx_events_occurred_at on events(occurred_at);

-- ── Recommendations (AI provenance) ─────────────────────────────────
create table if not exists recommendations (
  id               uuid primary key default gen_random_uuid(),
  case_id          uuid not null references cases(id) on delete cascade,
  created_at       timestamptz not null default now(),
  engine_type      text not null check (engine_type in ('rule_based','ml_model','llm')),
  engine_version   text not null,
  confidence_type  text not null check (confidence_type in ('probability','categorical')),
  confidence_value numeric(4,3) not null check (confidence_value between 0 and 1),
  recommendation   text not null,
  explanation      text not null,
  accepted         boolean,            -- null = pending
  override_reason  text
);

create index if not exists idx_recommendations_case_id on recommendations(case_id);

-- ── Actions (human decision log, pairs with recommendations) ────────
create table if not exists actions (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references cases(id) on delete cascade,
  recommendation_id uuid references recommendations(id),
  actor_id          uuid references profiles(id),
  action_taken      text not null,
  rationale         text not null default '',
  created_at        timestamptz not null default now()
);

-- ── Audit Log (immutable, append-only) ──────────────────────────────
create table if not exists audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   uuid not null,
  action      text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  actor_id    uuid,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_record on audit_log(table_name, record_id);

-- ── Row Level Security ──────────────────────────────────────────────

alter table sites enable row level security;
alter table profiles enable row level security;
alter table cases enable row level security;
alter table events enable row level security;
alter table recommendations enable row level security;
alter table actions enable row level security;
alter table audit_log enable row level security;

-- Profiles: users can read their own profile
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

-- Cases: users can read cases from their site
create policy "Users can read site cases"
  on cases for select
  using (
    site_id in (
      select site_id from profiles where id = auth.uid()
    )
  );

-- Cases: operators and above can insert cases for their site
create policy "Operators can create site cases"
  on cases for insert
  with check (
    site_id in (
      select site_id from profiles where id = auth.uid()
    )
  );

-- Events: users can read events for their site's cases
create policy "Users can read site events"
  on events for select
  using (
    case_id in (
      select id from cases where site_id in (
        select site_id from profiles where id = auth.uid()
      )
    )
  );

-- Events: operators can insert events for their site's cases
create policy "Operators can create site events"
  on events for insert
  with check (
    case_id in (
      select id from cases where site_id in (
        select site_id from profiles where id = auth.uid()
      )
    )
  );

-- Recommendations: readable by site members
create policy "Users can read site recommendations"
  on recommendations for select
  using (
    case_id in (
      select id from cases where site_id in (
        select site_id from profiles where id = auth.uid()
      )
    )
  );

-- Audit log: only researchers and supervisors can read
create policy "Researchers can read audit log"
  on audit_log for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and role in ('researcher','supervisor')
    )
  );
