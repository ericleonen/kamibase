-- Kamibase: private crease patterns.
--
-- Run this in your Supabase project after 0001, 0002 and 0003 (SQL Editor ->
-- New query -> paste -> Run). Safe to run twice.
--
-- A pattern you have saved but do not want on the site yet. Not the same idea
-- as a private *account*, and deliberately not implemented the same way: a
-- private account is for its followers, because the point of following
-- somebody is to see their work, while a private pattern is a draft. There is
-- no audience for a draft. So this one is visible to its author and to nobody
-- else, which is the rule somebody can hold in their head.
--
-- The flag is on the row rather than in the document, because it is a fact
-- about this copy on this site and not about the crease pattern. Exporting a
-- private pattern gives you a .kami file with nothing private in it, which is
-- correct: the file is yours and the flag was never part of the geometry.

alter table public.patterns
  add column if not exists is_private boolean not null default false;

comment on column public.patterns.is_private is
  'When true, only the author can see this pattern. It is off /explore, out of '
  'search, and its page is a 404 to everybody else.';

-- Private rows should not be paid for on every public listing, and there are
-- far fewer of them than public ones, so the index carries the flag rather
-- than the planner filtering after the fact.
create index if not exists patterns_public_created_idx
  on public.patterns (created_at desc)
  where not is_private;

-- ---------------------------------------------------------------------------
-- Who can see a pattern
--
-- This replaces "patterns are public" from 0002. The write policies are
-- unchanged: a pattern was always its author's to update and delete, and
-- turning the flag on is an ordinary update of an ordinary column.
--
-- `auth.uid()` is null for the anonymous key, which is what the app reads
-- listings with, so /explore and the home page drop private rows without
-- knowing that private rows exist.
-- ---------------------------------------------------------------------------

drop policy if exists "patterns are public" on public.patterns;
drop policy if exists "patterns are visible to their author or to everyone"
  on public.patterns;
create policy "patterns are visible to their author or to everyone"
  on public.patterns for select
  using (not is_private or author_id = (select auth.uid()));
