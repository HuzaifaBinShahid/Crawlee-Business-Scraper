#!/usr/bin/env bash
# Launcher invoked by systemd. Reads target from /etc/scraper.env.
set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
source /etc/scraper.env

ARGS=(--country="${COUNTRY:?COUNTRY not set in /etc/scraper.env}")

if [[ -n "${CATEGORY:-}" ]]; then
  ARGS+=(--category="${CATEGORY}")
fi

if [[ -n "${CITY:-}" ]]; then
  ARGS+=(--city="${CITY}")
fi

echo "[$(date -Iseconds)] Starting scraper: ${ARGS[*]}"
exec node src/main.js "${ARGS[@]}"
