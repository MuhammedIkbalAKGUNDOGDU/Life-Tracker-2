#!/usr/bin/env bash
# Nightly Postgres backup. Keeps the last 14 dumps.
# Cron example (every night 03:00):
#   0 3 * * * /path/to/Life-Tracker-2/deploy/backup.sh >> /path/to/Life-Tracker-2/backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
mkdir -p backups
FILE="backups/life_tracker_$(date +%Y%m%d_%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U "$DB_USER" "$DB_DATABASE" | gzip > "$FILE"
ls -1t backups/*.sql.gz | tail -n +15 | xargs -r rm --
echo "OK: $FILE"
