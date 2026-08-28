-- Kamibase account settings: private accounts and email notifications.
--
-- Run this in your Supabase project after 0001 and 0002 (SQL Editor -> New
-- query -> paste -> Run). Safe to run twice.
--
-- Two ideas, both living on `profiles` because both are facts about an account
-- rather than about anything it has made:
--
--   * `is_private` — a profile and its folds are for followers, not for the
--     open web. Enforced here in RLS as well as in the app, because a policy is
--     the only place a rule cannot be forgotten by the next feature.
--
--   * `notify_*` — which emails this account wants. Defaults on, because the
--     point of a follow is to hear about it, and every one of them is one
--     checkbox away from off in /settings/account.

alter table public.profiles
  add column if not exists is_private boolean not null default false,
  add column if not exists notify_follows boolean not null default true,
  add column if not exists notify_folds boolean not null default true,
  add column if not exists notify_comments boolean not null default true;

comment on column public.profiles.is_private is
  'When true, only followers (and the owner) can read this profile''s folds.';

-- ---------------------------------------------------------------------------
-- Who can see a private account's work
-- ---------------------------------------------------------------------------

-- `security definer` so the check can read `follows` without needing the
-- caller to be able to. Without it, the policy below would recurse into
-- `follows`'s own policies and a private account's followers would still be
-- refused. `search_path` is pinned for the usual reason: a definer function
-- that resolves names against the caller's path is a privilege escalation
-- waiting for someone to create a table called `follows`.
create or replace function public.can_see_profile(target uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    not p.is_private
    or p.id = (select auth.uid())
    or exists (
      select 1 from public.follows f
      where f.following_id = p.id and f.follower_id = (select auth.uid())
    )
  from public.profiles p
  where p.id = target;
$$;

-- Profiles themselves stay readable: a private account still has a name, a
-- handle and a page saying it is private. Hiding the row entirely would turn
-- "this account is private" into "this account does not exist", which breaks
-- every link anybody ever shared and tells a follower nothing.
--
-- What the flag hides is the work.
drop policy if exists "folds are public" on public.folds;
drop policy if exists "folds are visible to those allowed" on public.folds;
create policy "folds are visible to those allowed"
  on public.folds for select
  using (public.can_see_profile(author_id));

drop policy if exists "comments are public" on public.comments;
drop policy if exists "comments are visible to those allowed" on public.comments;
create policy "comments are visible to those allowed"
  on public.comments for select
  using (
    -- A comment on a pattern is on a public page and stays public. A comment on
    -- a fold is only visible to whoever can see the fold.
    fold_id is null
    or exists (
      select 1 from public.folds f
      where f.id = comments.fold_id and public.can_see_profile(f.author_id)
    )
  );
