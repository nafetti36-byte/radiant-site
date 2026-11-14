#!/usr/bin/env bash
# Full SQL backup of the production D1 database (run before every migration).
set -euo pipefail
DB="${1:-hanen-360-db}"
mkdir -p backups
OUT="backups/${DB}-$(date -u +%Y%m%dT%H%M%SZ).sql"
npx wrangler d1 export "$DB" --remote --output "$OUT"
echo "Backup written to $OUT ($(wc -c < "$OUT") bytes). Keep it outside the repository."
