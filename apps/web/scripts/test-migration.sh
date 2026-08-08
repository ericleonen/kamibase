#!/usr/bin/env bash
#
# Apply the social migration to a real Postgres and check it behaves.
#
# The migration is the one part of the social layer TypeScript cannot check.
# Row-level security especially: a policy that is a little too permissive is
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

echo "--- Supabase stubs (auth.users, storage.objects, auth.uid) ---"
run "$HERE/supabase/test/00-supabase-stub.sql"

echo "--- applying the migration ---"
run "$HERE/supabase/migrations/0001_social.sql"

echo "--- applying it a second time, which has to be a no-op ---"
run "$HERE/supabase/migrations/0001_social.sql"

echo "--- behaviour ---"
run "$HERE/supabase/test/01-behaviour.sql"

echo "--- a third run, now that there is data to preserve ---"
run "$HERE/supabase/migrations/0001_social.sql"
psql -v ON_ERROR_STOP=1 -tAq -d "$DB" \
  -c "select 'after re-running: ' || count(*) || ' profiles, '
             || (select count(*) from public.folds) || ' folds still here'
      from public.profiles;"

psql -q -d postgres -c "drop database if exists $DB;"
echo "migration checks passed"
