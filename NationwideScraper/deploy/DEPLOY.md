# Deploying the scraper to Oracle Cloud (Always Free)

> **Heads-up — try the Windows path first.** Oracle's free ARM VMs (the only ones with enough RAM for Playwright) are chronically out of capacity in some regions, especially Mumbai. If you're hitting "Out of host capacity" errors, use the [spare-laptop Windows setup](windows/WINDOWS-SETUP.md) instead — simpler, no signup, no capacity issues. Come back to this guide later if/when Oracle capacity frees up.

This runs the scraper on a free Oracle Cloud VM 24/7. Your laptop can be off — the scrape keeps going. When it's done (or whenever you want), you pull results back to your laptop with one command.

**Cost: $0/month forever.** Oracle asks for a card at signup for identity verification only; they do not charge it for Always Free resources.

---

## What you end up with

- A free always-on Linux VM (4 ARM cores, 24 GB RAM available — we'll use 2 cores / 12 GB).
- The scraper running as a system service — auto-restarts on crash, auto-starts on reboot.
- Results streaming to a folder on the VM (same `businesses_PK_client_full.csv` / `.json` you already get locally).
- Two scripts: one to check how it's doing, one to copy results to your laptop.

---

## Phase A — Oracle signup (one time, ~15 min)

1. Open https://www.oracle.com/cloud/free/ → **Start for free**.
2. **Home region** — pick carefully, it's permanent. Use **US West (Phoenix)**, **US East (Ashburn)**, or **Germany Central (Frankfurt)**. Avoid Mumbai and Singapore — they're usually out of free ARM capacity.
3. Enter email, verify, fill in your info, and enter a card. The page explicitly says "Your card will not be charged for Always Free resources."
4. After a couple of minutes, Oracle emails you that the account is ready. Sign in to the console.

---

## Phase B — Create the VM (~10 min)

In the Oracle console:

1. Hamburger menu (top left) → **Compute** → **Instances** → **Create instance**.
2. **Name**: `scraper-vm`.
3. **Image**: click *Edit* → change to **Canonical Ubuntu 22.04** → architecture **aarch64** (ARM).
4. **Shape**: click *Edit* → **Ampere** tab → **VM.Standard.A1.Flex** → set **OCPUs = 2**, **Memory = 12 GB**.
5. **Networking**: leave defaults. Make sure "Assign a public IPv4 address" is checked.
6. **SSH keys**: choose "Generate a key pair for me" → click **Save private key** (saves a `.key` file to your laptop). **Save this file somewhere you won't lose it** — it's the only way in.
7. Click **Create**. Wait ~1 min until status is *Running*.
8. Copy the **Public IPv4 address** from the instance details page. You'll need it.

**If you see "Out of capacity"** → change the "Availability domain" dropdown at the top and retry. If all three are full, try again in a few hours, or pick a different home region (but region is permanent, so only redo this as a last resort).

---

## Phase C — Connect and install (~10 min, mostly automated)

On your Windows laptop, open **Git-Bash** (comes with Git for Windows). If you don't have it: https://git-scm.com/download/win

```bash
# Lock down the key file so ssh accepts it
chmod 600 /path/to/your-key.key

# SSH in (replace the IP and key path)
ssh -i /path/to/your-key.key ubuntu@<PUBLIC_IP>
```

You're now on the VM. Run the one-liner installer:

```bash
curl -fsSL https://raw.githubusercontent.com/HuzaifaBinShahid/Crawlee-Business-Scraper/main/NationwideScraper/deploy/setup-vm.sh | bash
```

It installs Node 20, Playwright + chromium, clones the repo, adds a 4 GB swapfile, and starts the scraper as a systemd service. Takes ~5-8 minutes. At the end it prints the service status — you want to see **`active (running)`**.

The default target is **Pakistan / Gyms & Fitness / Lahore** — exactly the smoke run you asked for.

---

## Phase D — Watch it work

On the VM:

```bash
# Live log tail
sudo tail -f /var/log/scraper.log

# One-shot health report (service status + row counts + memory + disk)
bash ~/Crawlee-Business-Scraper/NationwideScraper/deploy/healthcheck.sh
```

You should see Google Maps page loads within a minute or two, and the CSV row count climbing above 0 within ~5 minutes. Press `Ctrl+C` to stop tailing the log (the scraper keeps running).

You can close your laptop. The VM keeps running.

A full `Lahore / Gyms & Fitness` run finishes in roughly 30-90 minutes depending on result count.

---

## Phase E — Pull results to your laptop

From your laptop's Git-Bash, inside this repo:

```bash
bash NationwideScraper/deploy/pull-results.sh <PUBLIC_IP> /path/to/your-key.key
```

It `rsync`s `data/output/` from the VM into your local `data/output/`. Safe to run anytime — only transfers what changed.

---

## Phase F — Running the next target

SSH into the VM, edit the env file, restart:

```bash
sudo nano /etc/scraper.env
# change CITY=Karachi, or delete the CITY= line to run every PK city
# change COUNTRY=SA to run Saudi Arabia
# Ctrl+O, Enter, Ctrl+X to save

sudo systemctl restart scraper
```

Dedup carries across runs automatically — already-scraped businesses are skipped.

---

## Common issues

**"Permissions 0644 for 'key.key' are too open"**
→ `chmod 600 /path/to/your-key.key`

**"Out of capacity" creating the VM**
→ Change availability domain, or retry later. Oracle's Ampere A1 is in high demand.

**Service shows `failed` in `systemctl status`**
→ `sudo journalctl -u scraper -n 50` shows the error. Most common: `npm install` failed — `cd ~/Crawlee-Business-Scraper/NationwideScraper && npm install` manually, then `sudo systemctl restart scraper`.

**Scraper starts but log says `browserType.launch: Executable doesn't exist`**
→ `cd ~/Crawlee-Business-Scraper/NationwideScraper && npx playwright install --with-deps chromium`, then `sudo systemctl restart scraper`.

**Want to stop it entirely**
→ `sudo systemctl stop scraper` (stays stopped). `sudo systemctl disable scraper` (won't restart on reboot).

---

## What's running where

| Thing | Where |
|-------|-------|
| Systemd unit | `/etc/systemd/system/scraper.service` |
| Target config | `/etc/scraper.env` |
| Logs | `/var/log/scraper.log` |
| Scraper code | `~/Crawlee-Business-Scraper/NationwideScraper/` |
| Output CSV/JSON | `~/Crawlee-Business-Scraper/NationwideScraper/data/output/` |
