#!/usr/bin/env bash
#
# Apply the migrations to a real Postgres and check they behave.
#
# The schema is the one part of the app TypeScript cannot check. Row-level
# security especially: a policy that is a little too permissive is
# indistinguishable from a correct one until somebody writes a row they should
# not be able to. So this runs the real DDL against a real server and then tries
# what a hostile client would try.
#
# Needs a Postgres to talk to. In CI that is a service container; locally, set
# PGHOST/PGPORT/PGUSER/PGPASSWORD at whatever you have running. The database
# named below is dropped and recreated on every run.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${KAMIBASE_TEST_DB:-kamibase_migration_test}"

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"

psql -v ON_ERROR_STOP=1 -q -d postgres \
  -c "drop database if exists $DB;" \
  -c "create database $DB;"

run() {
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"
}

# Every migration, in the order a project applies them. Adding one here is the
# whole of wiring it into CI.
MIGRATIONS=(
  "$HERE/supabase/migrations/0001_social.sql"
  "$HERE/supabase/migrations/0002_patterns.sql"
)

apply_all() {
  for migration in "${MIGRATIONS[@]}"; do
    run "$migration"
  done
}

echo "--- Supabase stubs (auth.users, storage.objects, auth.uid) ---"
run "$HERE/supabase/test/00-supabase-stub.sql"

echo "--- applying the migrations ---"
apply_all

echo "--- applying them a second time, which has to be a no-op ---"
apply_all

echo "--- behaviour: social ---"
run "$HERE/supabase/test/01-behaviour.sql"

echo "--- behaviour: patterns ---"
run "$HERE/supabase/test/02-patterns.sql"

echo "--- a third run, now that there is data to preserve ---"
apply_all
psql -v ON_ERROR_STOP=1 -tAq -d "$DB" \
  -c "select 'after re-running: ' || count(*) || ' profiles, '
             || (select count(*) from public.folds) || ' folds, '
             || (select count(*) from public.patterns) || ' patterns still here'
      from public.profiles;"

psql -q -d postgres -c "drop database if exists $DB;"
echo "migration checks passed"
