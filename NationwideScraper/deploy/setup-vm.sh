#!/usr/bin/env bash
# One-shot provisioner for a fresh Ubuntu 22.04 ARM VM (Oracle Ampere A1).
# Run as the default 'ubuntu' user:
#   curl -fsSL https://raw.githubusercontent.com/HuzaifaBinShahid/Crawlee-Business-Scraper/main/NationwideScraper/deploy/setup-vm.sh | bash
set -euo pipefail

REPO_URL="https://github.com/HuzaifaBinShahid/Crawlee-Business-Scraper.git"
REPO_DIR="$HOME/Crawlee-Business-Scraper"
NODE_VERSION="20"

log() { echo -e "\n\033[1;32m==>\033[0m $*"; }

if [[ "$(id -u)" == "0" ]]; then
  echo "Do not run as root. Run as 'ubuntu'." >&2
  exit 1
fi

log "Updating apt and installing base packages"
sudo apt-get update -y
sudo apt-get install -y git curl ca-certificates build-essential rsync

log "Creating 4 GB swapfile (Oracle images ship with none)"
if ! swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

log "Installing nvm + Node ${NODE_VERSION}"
export NVM_DIR="$HOME/.nvm"
if [[ ! -d "$NVM_DIR" ]]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"
nvm install "$NODE_VERSION"
nvm alias default "$NODE_VERSION"
# Stable symlink so systemd PATH works:
NODE_BIN_DIR="$(dirname "$(nvm which "$NODE_VERSION")")"
mkdir -p "$HOME/.nvm/versions/node/v20/bin"
ln -sf "$NODE_BIN_DIR/node" "$HOME/.nvm/versions/node/v20/bin/node"
ln -sf "$NODE_BIN_DIR/npm"  "$HOME/.nvm/versions/node/v20/bin/npm"
ln -sf "$NODE_BIN_DIR/npx"  "$HOME/.nvm/versions/node/v20/bin/npx"

log "Cloning repo"
if [[ ! -d "$REPO_DIR" ]]; then
  git clone "$REPO_URL" "$REPO_DIR"
else
  git -C "$REPO_DIR" pull --ff-only
fi

cd "$REPO_DIR/NationwideScraper"

log "Installing npm deps"
npm install --omit=dev || npm install

log "Installing Playwright chromium + system deps (ARM64)"
npx playwright install --with-deps chromium

log "Ensuring output directory exists"
mkdir -p data/output

log "Writing /etc/scraper.env (default: PK / Gyms & Fitness / Lahore)"
if [[ ! -f /etc/scraper.env ]]; then
  sudo cp deploy/scraper.env.example /etc/scraper.env
  sudo chmod 644 /etc/scraper.env
fi

log "Installing systemd service"
sudo cp deploy/scraper.service /etc/systemd/system/scraper.service
sudo touch /var/log/scraper.log
sudo chown ubuntu:ubuntu /var/log/scraper.log
sudo chmod +x deploy/run-scraper.sh deploy/healthcheck.sh
sudo systemctl daemon-reload
sudo systemctl enable scraper.service
sudo systemctl restart scraper.service

log "Waiting 5s then showing service status"
sleep 5
sudo systemctl status scraper.service --no-pager || true

log "Done. Tail logs with: sudo tail -f /var/log/scraper.log"
log "Check health with:   bash $REPO_DIR/NationwideScraper/deploy/healthcheck.sh"
