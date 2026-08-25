-- Kamibase patterns: crease patterns saved from the editor.
--
-- Run this once in your Supabase project, after 0001_social.sql (SQL Editor ->
-- New query -> paste -> Run). It is safe to run twice: every object is created
-- with a guard.
--
-- This is the DESIGN.md §9 move of patterns into Postgres, and it is additive.
-- The seeded `.kami` files under content/patterns are still read from disk and
-- still resolve at /p/:slug; the app looks in both places and the database wins
-- on a tie. So a deploy with no keys keeps its whole library, and a deploy with
-- keys gains everything anyone has saved.
--
-- The row is not a second source of truth about geometry. `document` holds the
-- canonical `.kami` JSON exactly as `@kamibase/core`'s ingest produced it, and
-- every other column is either metadata a person typed or a count derived from
-- that document at save time. Anything that disagrees is the derived column
-- being stale, never the document being wrong.

-- ---------------------------------------------------------------------------
-- Patterns
-- ---------------------------------------------------------------------------

create table if not exists public.patterns (
  id uuid primary key default gen_random_uuid(),
  -- The route: /p/:slug. Same shape as folds.pattern_id, which references it
  -- by slug rather than by key because seeded patterns have no row here.
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  author_id uuid not null references public.profiles (id) on delete cascade,

  -- What a person typed in the save form.
  title text not null check (char_length(title) between 1 and 120),
  -- Who designed it, which is not always who uploaded it.
  designer text not null default '' check (char_length(designer) <= 80),
  description text not null default '' check (char_length(description) <= 2000),
  license text not null check (char_length(license) between 1 and 64),
  difficulty integer check (difficulty is null or difficulty between 1 and 10),
  tags text[] not null default '{}' check (cardinality(tags) <= 12),

  -- The canonical `.kami` document, and the hash of its geometry. The same
  -- geometry always hashes the same, whoever drew it, so this is what makes
  -- duplicates findable later.
  document jsonb not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),

  -- Derived from `document` at save time so the explore grid can rank and
  -- filter without parsing every pattern it lists.
  level text not null check (level in ('invalid', 'L0', 'L1', 'L2', 'L3')),
  flat_foldable boolean not null default false,
  paper_shape text not null default 'square',
  vertex_count integer not null default 0 check (vertex_count >= 0),
  edge_count integer not null default 0 check (edge_count >= 0),
  face_count integer not null default 0 check (face_count >= 0),
  mountain_count integer not null default 0 check (mountain_count >= 0),
  valley_count integer not null default 0 check (valley_count >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patterns_author_idx on public.patterns (author_id, created_at desc);
create index if not exists patterns_created_idx on public.patterns (created_at desc);
create index if not exists patterns_hash_idx on public.patterns (content_hash);

comment on table public.patterns is
  'A crease pattern saved from the editor. `document` is the canonical .kami '
  'JSON; every other column is metadata or a count derived from it.';

comment on column public.patterns.slug is
  'The route id, /p/:slug. Unique across the database, and the app also keeps '
  'it clear of the seeded pattern files on disk.';

drop trigger if exists patterns_touch_updated_at on public.patterns;
create trigger patterns_touch_updated_at
  before update on public.patterns
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Patterns are public to read, like everything else here: a crease pattern
-- nobody can see is not on a pattern hub (DESIGN.md §8.4). Writes are the
-- author's own rows only.
-- ---------------------------------------------------------------------------

alter table public.patterns enable row level security;

drop policy if exists "patterns are public" on public.patterns;
create policy "patterns are public"
  on public.patterns for select
  using (true);

drop policy if exists "a user saves their own patterns" on public.patterns;
create policy "a user saves their own patterns"
  on public.patterns for insert to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists "a user edits their own patterns" on public.patterns;
create policy "a user edits their own patterns"
  on public.patterns for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists "a user deletes their own patterns" on public.patterns;
create policy "a user deletes their own patterns"
  on public.patterns for delete to authenticated
  using (author_id = (select auth.uid()));

grant select on public.patterns to anon, authenticated;
grant insert, update, delete on public.patterns to authenticated;
