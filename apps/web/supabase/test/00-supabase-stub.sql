-- Enough of Supabase's own schema to run the migration against a bare Postgres.
--
-- This is a test harness. It is never run against a real project, where all of
-- this already exists and is managed by Supabase.
--
-- The one interesting substitution is `auth.uid()`. On Supabase it reads the
-- user out of the request's JWT; here it reads a session variable, so the
-- behaviour tests can act as different people and watch the row-level security
-- policies decide.

create extension if not exists pgcrypto;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(name, '/');
$$;

do $$
begin
  create role anon;
exception when duplicate_object then null;
end $$;

do $$
begin
  create role authenticated;
exception when duplicate_object then null;
end $$;

grant usage on schema public to anon, authenticated;
