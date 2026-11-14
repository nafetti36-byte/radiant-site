#!/usr/bin/env bash
# Safety checks before migrating the EXISTING production database.
set -euo pipefail
DB="${1:-hanen-360-db}"
grep -q REPLACE_WITH_EXISTING_D1_DATABASE_ID wrangler.toml && { echo "✗ Set database_id in wrangler.toml (npx wrangler d1 list)"; exit 1; }
echo "Existing tables:"
npx wrangler d1 execute "$DB" --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
CONFLICT=$(npx wrangler d1 execute "$DB" --remote --json --command "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE 'h360_%'" | grep -o '"n": *[0-9]*' | grep -o '[0-9]*$')
echo "Existing h360_* tables: ${CONFLICT}"
echo "Migrations status:"
npx wrangler d1 migrations list DB --remote
echo "✓ Preflight done. Next: ./scripts/backup.sh $DB && npm run db:migrate:remote"
