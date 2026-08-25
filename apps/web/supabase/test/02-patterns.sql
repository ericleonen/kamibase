-- What the patterns schema is supposed to do, asserted against a real Postgres.
--
-- Runs after 01-behaviour.sql, on the same database, so the accounts it created
-- are already here. Same argument as that file: row-level security is the part
-- no amount of TypeScript checks, so the assertions below are the things a
-- hostile client would try.

\set ON_ERROR_STOP on
\t on

-- A minimal but real .kami document: two vertices, one border edge. Enough to
-- exercise the column, since Postgres is not asked to understand the geometry.
\set doc '{"file_spec":1.2,"kami:version":"0.1","vertices_coords":[[0,0],[1,0]],"edges_vertices":[[0,1]],"edges_assignment":["B"]}'
\set hash '0000000000000000000000000000000000000000000000000000000000000000'

-- ---------------------------------------------------------------------------
-- 1. Constraints
-- ---------------------------------------------------------------------------

insert into public.patterns
  (slug, author_id, title, license, document, content_hash, level)
values
  ('hex-twist', '11111111-1111-1111-1111-111111111111', 'Hex twist',
   'CC0-1.0', :'doc'::jsonb, :'hash', 'L1');
select 'ok: a pattern saves';

do $$
begin
  insert into public.patterns
    (slug, author_id, title, license, document, content_hash, level)
  values
    ('Hex Twist', '11111111-1111-1111-1111-111111111111', 'Hex twist',
     'CC0-1.0', '{}'::jsonb,
     '0000000000000000000000000000000000000000000000000000000000000000', 'L1');
  raise exception 'a slug with spaces and capitals was allowed';
exception when check_violation then
  raise notice 'ok: slug format enforced in the database';
end $$;

do $$
begin
  insert into public.patterns
    (slug, author_id, title, license, document, content_hash, level)
  values
    ('hex-twist', '22222222-2222-2222-2222-222222222222', 'Hex twist again',
     'CC0-1.0', '{}'::jsonb,
     '0000000000000000000000000000000000000000000000000000000000000000', 'L1');
  raise exception 'a duplicate slug was allowed';
exception when unique_violation then
  raise notice 'ok: slugs are unique';
end $$;

do $$
begin
  insert into public.patterns
    (slug, author_id, title, license, document, content_hash, level)
  values
    ('bad-hash', '11111111-1111-1111-1111-111111111111', 'Bad hash',
     'CC0-1.0', '{}'::jsonb, 'not-a-sha', 'L1');
  raise exception 'a malformed content hash was allowed';
exception when check_violation then
  raise notice 'ok: content hash format enforced';
end $$;

do $$
begin
  insert into public.patterns
    (slug, author_id, title, license, document, content_hash, level, difficulty)
  values
    ('too-hard', '11111111-1111-1111-1111-111111111111', 'Too hard',
     'CC0-1.0', '{}'::jsonb,
     '0000000000000000000000000000000000000000000000000000000000000000', 'L1', 11);
  raise exception 'difficulty 11 was allowed';
exception when check_violation then
  raise notice 'ok: difficulty is capped at 10';
end $$;

do $$
begin
  insert into public.patterns
    (slug, author_id, title, license, document, content_hash, level)
  values
    ('unknown-level', '11111111-1111-1111-1111-111111111111', 'Unknown level',
     'CC0-1.0', '{}'::jsonb,
     '0000000000000000000000000000000000000000000000000000000000000000', 'L9');
  raise exception 'an invented validation level was allowed';
exception when check_violation then
  raise notice 'ok: level is one of the grades core assigns';
end $$;

-- ---------------------------------------------------------------------------
-- 2. updated_at moves on an edit
-- ---------------------------------------------------------------------------

update public.patterns set updated_at = now() - interval '1 day' where slug = 'hex-twist';
update public.patterns set title = 'Hex twist, revised' where slug = 'hex-twist';
select 'ok: updated_at is touched on edit'
from public.patterns
where slug = 'hex-twist' and updated_at > now() - interval '1 minute';

-- ---------------------------------------------------------------------------
-- 3. Row-level security
-- ---------------------------------------------------------------------------

set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';

insert into public.patterns
  (slug, author_id, title, license, document, content_hash, level)
values
  ('waterbomb-variant', '11111111-1111-1111-1111-111111111111', 'Waterbomb variant',
   'CC-BY-4.0', :'doc'::jsonb, :'hash', 'L2');
select 'ok: a user saves a pattern as themselves';

do $$
begin
  insert into public.patterns
    (slug, author_id, title, license, document, content_hash, level)
  values
    ('not-mine', '22222222-2222-2222-2222-222222222222', 'Not mine',
     'CC0-1.0', '{}'::jsonb,
     '0000000000000000000000000000000000000000000000000000000000000000', 'L1');
  raise exception 'saving a pattern as another user was allowed';
exception when insufficient_privilege then
  raise notice 'ok: cannot save a pattern as somebody else';
end $$;

-- Somebody else's pattern is readable and not writable.
reset role;
insert into public.patterns
  (slug, author_id, title, license, document, content_hash, level)
values
  ('someone-elses', '22222222-2222-2222-2222-222222222222', 'Someone elses',
   'CC0-1.0', :'doc'::jsonb, :'hash', 'L1');

set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';
update public.patterns set title = 'stolen' where slug = 'someone-elses';
select 'ok: editing another user''s pattern changed nothing'
from public.patterns
where slug = 'someone-elses' and title = 'Someone elses';

delete from public.patterns where slug = 'someone-elses';
select 'ok: deleting another user''s pattern removed ' || count(*)::text || ' rows'
from public.patterns where slug = 'someone-elses' having count(*) = 1;

-- A logged-out visitor reads every pattern and writes none.
set role anon;
set test.uid = '';
select 'ok: anon reads ' || count(*)::text || ' patterns' from public.patterns;

do $$
begin
  insert into public.patterns
    (slug, author_id, title, license, document, content_hash, level)
  values
    ('anon-pattern', '11111111-1111-1111-1111-111111111111', 'Anon',
     'CC0-1.0', '{}'::jsonb,
     '0000000000000000000000000000000000000000000000000000000000000000', 'L1');
  raise exception 'an anonymous save was allowed';
exception when insufficient_privilege then
  raise notice 'ok: anon cannot save a pattern';
end $$;

-- ---------------------------------------------------------------------------
-- 4. A pattern belongs to its author
-- ---------------------------------------------------------------------------

reset role;
delete from public.profiles where id = '22222222-2222-2222-2222-222222222222';
select 'ok: deleting an author took ' || count(*)::text || ' of their patterns with them'
from public.patterns where slug = 'someone-elses' having count(*) = 0;

select 'ALL PATTERN CHECKS PASSED';
