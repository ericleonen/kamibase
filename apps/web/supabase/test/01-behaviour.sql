-- What the social schema is supposed to do, asserted against a real Postgres.
--
-- Run it with `apps/web/scripts/test-migration.sh`, which is also what CI runs.
-- Any assertion that fails raises, and `ON_ERROR_STOP` turns that into a
-- non-zero exit.
--
-- Row-level security is the reason this exists. A policy that is subtly too
-- permissive looks exactly like one that is correct until somebody writes a row
-- they should not be able to, and no amount of TypeScript notices the
-- difference. So the checks below try the things a hostile client would try.

\set ON_ERROR_STOP on
\t on

-- ---------------------------------------------------------------------------
-- 1. The signup trigger creates a profile with a handle derived from the email
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'Eric.Leonen@example.com', '{"name":"Eric Leonen"}');

select 'trigger creates a profile: ' ||
  (select handle || ' / ' || display_name from public.profiles
   where id = '11111111-1111-1111-1111-111111111111');

-- ---------------------------------------------------------------------------
-- 2. A second account with the same local part gets a free handle, not an error
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'ericleonen@other.example'),
  ('33333333-3333-3333-3333-333333333333', 'ericleonen@third.example');

select 'handles stay unique: ' || string_agg(handle, ', ' order by handle)
from public.profiles;

-- A short local part is padded rather than failing the length check.
insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'jo@example.com');
select 'short local part padded: ' ||
  (select handle from public.profiles where id = '44444444-4444-4444-4444-444444444444');

-- ---------------------------------------------------------------------------
-- 3. Constraints
-- ---------------------------------------------------------------------------
do $$
begin
  insert into public.follows (follower_id, following_id)
  values ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');
  raise exception 'self-follow was allowed';
exception when check_violation then
  raise notice 'ok: self-follow rejected';
end $$;

do $$
begin
  insert into public.comments (author_id, pattern_id, fold_id, body)
  values ('11111111-1111-1111-1111-111111111111', 'bird-base',
          '00000000-0000-0000-0000-000000000000', 'both targets');
  raise exception 'a comment on two things was allowed';
exception when check_violation or foreign_key_violation then
  raise notice 'ok: a comment needs exactly one target';
end $$;

do $$
begin
  insert into public.comments (author_id, body)
  values ('11111111-1111-1111-1111-111111111111', 'no target');
  raise exception 'a comment on nothing was allowed';
exception when check_violation then
  raise notice 'ok: a comment with no target rejected';
end $$;

do $$
begin
  update public.profiles set handle = 'Not A Handle'
  where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'a malformed handle was allowed';
exception when check_violation then
  raise notice 'ok: handle format enforced in the database';
end $$;

do $$
begin
  insert into public.folds (author_id, pattern_id, photo_url, photo_path, difficulty)
  values ('11111111-1111-1111-1111-111111111111', 'bird-base', 'u', 'p', 11);
  raise exception 'difficulty 11 was allowed';
exception when check_violation then
  raise notice 'ok: difficulty is capped at 10';
end $$;

-- ---------------------------------------------------------------------------
-- 4. Row-level security
-- ---------------------------------------------------------------------------
grant usage on schema auth, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant select, insert on storage.objects to authenticated;
grant select on storage.objects to anon;

-- Eric posts a fold of his own.
set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';
insert into public.folds (author_id, pattern_id, photo_url, photo_path, caption)
values ('11111111-1111-1111-1111-111111111111', 'bird-base',
        'https://example/x.jpg', '11111111-1111-1111-1111-111111111111/x.jpg', 'mine');
select 'ok: a user posts their own fold';

-- And cannot post as somebody else.
do $$
begin
  insert into public.folds (author_id, pattern_id, photo_url, photo_path)
  values ('22222222-2222-2222-2222-222222222222', 'bird-base', 'u', 'p');
  raise exception 'posting as another user was allowed';
exception when insufficient_privilege then
  raise notice 'ok: cannot post a fold as somebody else';
end $$;

-- Nor delete theirs.
reset role;
insert into public.folds (author_id, pattern_id, photo_url, photo_path)
values ('22222222-2222-2222-2222-222222222222', 'bird-base', 'u2', 'p2');
set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';
delete from public.folds where photo_path = 'p2';
select 'ok: deleting another user''s fold removed ' || count(*)::text || ' rows'
from public.folds where photo_path = 'p2' having count(*) = 1;

-- Following happens as yourself only.
do $$
begin
  insert into public.follows (follower_id, following_id)
  values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');
  raise exception 'following on behalf of another user was allowed';
exception when insufficient_privilege then
  raise notice 'ok: you can only follow as yourself';
end $$;

insert into public.follows (follower_id, following_id)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
select 'ok: following as yourself works';

-- Storage: your own folder only.
insert into storage.objects (bucket_id, name)
values ('fold-photos', '11111111-1111-1111-1111-111111111111/photo.jpg');
select 'ok: uploaded under own id';

do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('fold-photos', '22222222-2222-2222-2222-222222222222/photo.jpg');
  raise exception 'uploading into another user''s folder was allowed';
exception when insufficient_privilege then
  raise notice 'ok: cannot upload into another user''s folder';
end $$;

-- A logged-out visitor reads everything and writes nothing.
set role anon;
set test.uid = '';
select 'ok: anon reads ' || count(*)::text || ' profiles, ' ||
  (select count(*)::text from public.folds) || ' folds, ' ||
  (select count(*)::text from public.follows) || ' follows'
from public.profiles;

do $$
begin
  insert into public.comments (author_id, pattern_id, body)
  values ('11111111-1111-1111-1111-111111111111', 'bird-base', 'hi');
  raise exception 'an anonymous write was allowed';
exception when insufficient_privilege then
  raise notice 'ok: anon cannot write';
end $$;

reset role;
select 'ALL BEHAVIOUR CHECKS PASSED';
