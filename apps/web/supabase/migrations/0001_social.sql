-- Kamibase social layer: profiles, follows, folds, comments.
--
-- Run this once in your Supabase project (SQL Editor -> New query -> paste ->
-- Run). It is safe to run twice: every object is created with a guard.
--
-- The shape follows DESIGN.md §7. The distinction the whole thing turns on is
-- pattern vs fold: a pattern is the design, a fold is somebody's execution of
-- it. One pattern has many folds, which is what makes the site generative
-- rather than an archive.
--
-- Patterns themselves are NOT in here. They are still seeded `.kami` files on
-- disk (see src/lib/patterns), so a fold references a pattern by its route
-- slug as plain text rather than by a foreign key. When patterns move to
-- Postgres, `folds.pattern_id` and `comments.pattern_id` become real
-- references and nothing else about this schema changes.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Lowercase, URL-safe, and the thing /u/:handle resolves. Enforced here as
  -- well as in the app, because the database is the only place a constraint
  -- cannot be skipped.
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '' check (char_length(display_name) <= 60),
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 300),
  website text check (website is null or char_length(website) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile for an auth user. One row per account, created by trigger on signup.';

-- ---------------------------------------------------------------------------
-- Follows
-- ---------------------------------------------------------------------------

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  -- Following yourself is not a feature.
  constraint follows_not_self check (follower_id <> following_id)
);

create index if not exists follows_following_idx
  on public.follows (following_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Folds
-- ---------------------------------------------------------------------------

create table if not exists public.folds (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- The pattern's route slug, e.g. 'bird-base'.
  pattern_id text not null check (pattern_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  photo_url text not null check (char_length(photo_url) <= 500),
  -- Storage object path, kept so deleting a fold can also delete its photo.
  photo_path text not null check (char_length(photo_path) <= 300),
  caption text not null default '' check (char_length(caption) <= 1000),
  -- What it was folded from and how it went. All optional: a photo and a
  -- pattern is a complete post, and asking for more would suppress the
  -- beginner posts that make the site work.
  paper text check (paper is null or char_length(paper) <= 80),
  size_mm integer check (size_mm is null or size_mm between 10 and 2000),
  minutes integer check (minutes is null or minutes between 1 and 100000),
  difficulty integer check (difficulty is null or difficulty between 1 and 10),
  created_at timestamptz not null default now()
);

create index if not exists folds_pattern_idx on public.folds (pattern_id, created_at desc);
create index if not exists folds_author_idx on public.folds (author_id, created_at desc);
create index if not exists folds_created_idx on public.folds (created_at desc);

comment on column public.folds.difficulty is
  'Difficulty as experienced by this folder, 1-10. Aggregating these is the '
  'honest difficulty signal, as against the designer''s own rating.';

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- Exactly one of these is set: a comment hangs off a pattern or off a fold.
  pattern_id text check (pattern_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  fold_id uuid references public.folds (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint comments_one_target check (num_nonnulls(pattern_id, fold_id) = 1)
);

create index if not exists comments_pattern_idx on public.comments (pattern_id, created_at);
create index if not exists comments_fold_idx on public.comments (fold_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- A profile for every account
-- ---------------------------------------------------------------------------

-- Derive a free handle from a seed (usually the email's local part). Called by
-- the signup trigger and by the app when it heals a missing profile.
create or replace function public.generate_handle(seed text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  suffix integer := 0;
begin
  base := lower(regexp_replace(coalesce(seed, ''), '[^a-zA-Z0-9_]', '', 'g'));
  base := left(base, 20);
  if char_length(base) < 3 then
    base := 'folder' || base;
  end if;

  candidate := base;
  while exists (select 1 from public.profiles where handle = candidate) loop
    suffix := suffix + 1;
    candidate := left(base, 20) || suffix::text;
  end loop;

  return candidate;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    public.generate_handle(split_part(coalesce(new.email, ''), '@', 1)),
    left(
      coalesce(
        nullif(new.raw_user_meta_data ->> 'name', ''),
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      60
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Installing a trigger on `auth.users` needs a privilege the SQL editor
-- normally has but a restricted role may not, and the SQL editor runs this
-- whole file as one transaction: an error here would roll back the tables
-- above along with it. So the failure is caught and reported instead.
--
-- Losing the trigger is survivable. The app calls `ensureProfile()` before any
-- write, which creates a missing profile on the spot, so the only thing lost is
-- having one ready the instant somebody signs up.
do $$
begin
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
exception
  when insufficient_privilege or undefined_table then
    raise warning
      'Could not add the signup trigger on auth.users (%). Profiles will be '
      'created on first use instead.', sqlerrm;
end;
$$;

-- Backfill anyone who signed up before this migration ran.
insert into public.profiles (id, handle, display_name)
select
  u.id,
  public.generate_handle(split_part(coalesce(u.email, ''), '@', 1)),
  left(
    coalesce(
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(u.email, ''), '@', 1)
    ),
    60
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Everything here is public to read: a profile page, a fold and a comment
-- thread are all things a logged-out visitor should see (DESIGN.md §8.4,
-- "never gate the magic behind a signup wall"). Writes are always scoped to
-- the row's owner.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.follows  enable row level security;
alter table public.folds    enable row level security;
alter table public.comments enable row level security;

-- Profiles
drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public"
  on public.profiles for select
  using (true);

drop policy if exists "a user creates their own profile" on public.profiles;
create policy "a user creates their own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "a user edits their own profile" on public.profiles;
create policy "a user edits their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Follows
drop policy if exists "follows are public" on public.follows;
create policy "follows are public"
  on public.follows for select
  using (true);

drop policy if exists "a user follows as themselves" on public.follows;
create policy "a user follows as themselves"
  on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));

drop policy if exists "a user unfollows as themselves" on public.follows;
create policy "a user unfollows as themselves"
  on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()));

-- Folds
drop policy if exists "folds are public" on public.folds;
create policy "folds are public"
  on public.folds for select
  using (true);

drop policy if exists "a user posts their own folds" on public.folds;
create policy "a user posts their own folds"
  on public.folds for insert to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists "a user edits their own folds" on public.folds;
create policy "a user edits their own folds"
  on public.folds for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists "a user deletes their own folds" on public.folds;
create policy "a user deletes their own folds"
  on public.folds for delete to authenticated
  using (author_id = (select auth.uid()));

-- Comments
drop policy if exists "comments are public" on public.comments;
create policy "comments are public"
  on public.comments for select
  using (true);

drop policy if exists "a user posts their own comments" on public.comments;
create policy "a user posts their own comments"
  on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists "a user deletes their own comments" on public.comments;
create policy "a user deletes their own comments"
  on public.comments for delete to authenticated
  using (author_id = (select auth.uid()));

grant select on public.profiles, public.follows, public.folds, public.comments to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, delete on public.follows to authenticated;
grant insert, update, delete on public.folds to authenticated;
grant insert, delete on public.comments to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: avatars and fold photos
--
-- Both buckets are public to read and write-scoped to the uploader by path:
-- the first folder segment must be the uploader's user id. The size and MIME
-- limits are the last line of defence; the app downscales in the browser and
-- checks again in the server action before anything reaches storage.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('fold-photos', 'fold-photos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "kamibase images are public" on storage.objects;
create policy "kamibase images are public"
  on storage.objects for select
  using (bucket_id in ('avatars', 'fold-photos'));

drop policy if exists "a user uploads under their own id" on storage.objects;
create policy "a user uploads under their own id"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'fold-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "a user replaces their own images" on storage.objects;
create policy "a user replaces their own images"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('avatars', 'fold-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "a user deletes their own images" on storage.objects;
create policy "a user deletes their own images"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('avatars', 'fold-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
