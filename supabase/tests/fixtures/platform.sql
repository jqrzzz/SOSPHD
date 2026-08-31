\set ON_ERROR_STOP on

-- Minimal, synthetic Supabase platform surface for disposable contract DBs.
-- It models only objects referenced by repository migrations.

SET TIME ZONE 'UTC';

-- Roles are cluster-wide while fresh and upgrade databases share a cluster.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    BEGIN
      CREATE ROLE anon NOLOGIN NOBYPASSRLS;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated'
  ) THEN
    BEGIN
      CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role'
  ) THEN
    BEGIN
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS storage;

-- Tests set this GUC to a synthetic UUID; no real JWT or secret is used.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  SELECT NULLIF(
    pg_catalog.current_setting('request.jwt.claim.sub', true),
    ''
  )::uuid;
$function$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

-- Storage shim required by migration 013.
CREATE TABLE storage.buckets (
  id     text PRIMARY KEY,
  name   text NOT NULL UNIQUE,
  public boolean NOT NULL DEFAULT false
);

CREATE TABLE storage.objects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id  text NOT NULL REFERENCES storage.buckets(id) ON DELETE CASCADE,
  name       text NOT NULL,
  owner_id   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(object_name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN pg_catalog.strpos(object_name, '/') = 0 THEN ARRAY[]::text[]
    ELSE pg_catalog.string_to_array(
      pg_catalog.regexp_replace(object_name, '/[^/]*$', ''),
      '/'
    )
  END;
$function$;

GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT SELECT ON storage.buckets TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION storage.foldername(text)
  TO anon, authenticated, service_role;

-- Synthetic stand-ins for the only three sibling-owned operational tables
-- touched by the migrations. The notes columns support a no-op trigger test.
CREATE TABLE public.cases (
  id             uuid PRIMARY KEY,
  case_number    text NOT NULL UNIQUE,
  status         text NOT NULL DEFAULT 'new',
  intake_date    timestamptz,
  triage_at      timestamptz,
  closed_date    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  owner_user_id  uuid,
  notes          text NOT NULL DEFAULT ''
);

CREATE TABLE public.guarantees_of_payment (
  id                    uuid PRIMARY KEY,
  case_id               uuid NOT NULL,
  gop_number             text NOT NULL UNIQUE,
  status                 text NOT NULL DEFAULT 'pending',
  issued_date            date,
  requested_by_user_id   uuid,
  amount_guaranteed      numeric,
  currency               text NOT NULL DEFAULT 'THB',
  notes                  text NOT NULL DEFAULT ''
);

CREATE TABLE public.case_episodes (
  id            uuid PRIMARY KEY,
  case_id       uuid NOT NULL,
  status        text NOT NULL DEFAULT 'planned',
  episode_type  text NOT NULL,
  start_date    timestamptz,
  notes         text NOT NULL DEFAULT ''
);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.cases, public.guarantees_of_payment, public.case_episodes
  TO authenticated, service_role;
