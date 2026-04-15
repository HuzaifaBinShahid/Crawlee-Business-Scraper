#!/usr/bin/env bash
# Quick health report. Run on the VM.
set -u

cd "$(dirname "$0")/.."

line() { printf '\n\033[1;34m--- %s ---\033[0m\n' "$*"; }

line "systemd service status"
systemctl is-active scraper.service && systemctl status scraper.service --no-pager -n 5 || true

line "Target (/etc/scraper.env)"
cat /etc/scraper.env 2>/dev/null || echo "MISSING"

line "Last 20 log lines"
sudo tail -n 20 /var/log/scraper.log 2>/dev/null || echo "no log yet"

line "Output files"
ls -lh data/output/ 2>/dev/null || echo "no output yet"

line "CSV row count (minus header)"
for f in data/output/businesses_*_client_full.csv; do
  [[ -f "$f" ]] || continue
  n=$(($(wc -l < "$f") - 1))
  echo "  $f: $n rows"
done

line "NDJSON row count (streaming buffer)"
for f in data/output/*.ndjson; do
  [[ -f "$f" ]] || continue
  echo "  $f: $(wc -l < "$f") rows"
done

line "Memory"
free -h

line "Disk"
df -h / | tail -n 1
