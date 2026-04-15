#!/usr/bin/env bash
# Sync scraper output from the VM back to this laptop.
# Usage: bash pull-results.sh <PUBLIC_IP> <PATH_TO_SSH_KEY>
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <PUBLIC_IP> <PATH_TO_SSH_KEY>" >&2
  exit 1
fi

IP="$1"
KEY="$2"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)/data/output"

mkdir -p "$LOCAL_DIR"

echo "Syncing from ubuntu@${IP}:~/Crawlee-Business-Scraper/NationwideScraper/data/output/  ->  ${LOCAL_DIR}/"
rsync -avz --progress \
  -e "ssh -i ${KEY} -o StrictHostKeyChecking=accept-new" \
  "ubuntu@${IP}:Crawlee-Business-Scraper/NationwideScraper/data/output/" \
  "${LOCAL_DIR}/"

echo "Done. Files in ${LOCAL_DIR}:"
ls -lh "${LOCAL_DIR}"
