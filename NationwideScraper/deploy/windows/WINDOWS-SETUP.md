# Running the scraper 24/7 on a spare Windows laptop

This is the **recommended** zero-cost way to run the scraper for long periods. No cloud signup, no card, no capacity issues. The tradeoff: the spare laptop must stay powered on and connected to Wi-Fi.

---

## Phase A — One-time setup (~15 min)

On the spare laptop:

### 1. Install Node.js 20 LTS
- Download from https://nodejs.org (the LTS button).
- Run the MSI installer, accept defaults. Make sure "Add to PATH" and "npm package manager" are checked.
- Verify in a new terminal: `node --version` should print `v20.x.x`.

### 2. Install Git for Windows
- Download from https://git-scm.com/download/win
- Run the installer, accept defaults. This gives you **Git Bash**, which is handy.

### 3. Clone the repo and install dependencies
Open PowerShell or Git Bash and run:
```bash
git clone https://github.com/HuzaifaBinShahid/Crawlee-Business-Scraper.git
cd Crawlee-Business-Scraper/NationwideScraper
npm install
npx playwright install chromium
```
This downloads ~300 MB of Chromium. Give it a couple of minutes.

### 4. Smoke test
```bash
npm run gyms:lahore
```
A Chromium window opens and navigates to Google Maps. Once you see listings loading, press **Ctrl+C** to stop. Confirms everything is wired up correctly.

---

## Phase B — Make the laptop stay awake

Windows will aggressively sleep the machine by default. Disable all of that:

### 1. Power & battery settings
Settings → **System** → **Power & battery** → **Screen and sleep**:
- "When plugged in, turn off my screen after" → **Never**
- "When plugged in, put my device to sleep after" → **Never**

(If it's a laptop without a battery section, just do the "plugged in" settings.)

### 2. Lid-close behavior
Control Panel → **Hardware and Sound** → **Power Options** → **Choose what closing the lid does** (on the left sidebar):
- **When I close the lid (Plugged in)** → **Do nothing**

Save changes.

### 3. Plug in the charger and keep it plugged in
Self-explanatory. Laptop must be on AC power.

### 4. (Optional but recommended) Disable Windows Update auto-restart
Settings → **Windows Update** → **Advanced options** → **Active hours** → **Manually** → set to **12:00 AM** to **11:59 PM**. This prevents Windows from rebooting mid-scrape for updates.

---

## Phase C — Start the scraper

Edit the target in [`run-forever.bat`](run-forever.bat) — the first 3 lines control what to scrape:

```bat
set COUNTRY=PK
set CATEGORY=Gyms ^& Fitness
set CITY=Lahore
```

(The `^&` is an escaped ampersand — required by Windows batch syntax. Keep it.)

To scrape the **entire country** across all categories, remove the `CATEGORY` and `CITY` lines and leave only `COUNTRY=PK`. Be warned: that's days/weeks of runtime.

**Double-click `run-forever.bat`** to start. A console window opens with live logs. If the scraper ever crashes or finishes, it waits 30 seconds and restarts automatically. Dedup ensures no duplicate work across restarts.

To stop: close the console window, or press Ctrl+C twice.

---

## Phase D — Monitor progress

**Option 1 — watch the console window.** Logs scroll by as each listing is scraped.

**Option 2 — check row count.** Open a second terminal:
```bash
cd Crawlee-Business-Scraper/NationwideScraper/data/output
# Windows:
find /c /v "" businesses_PK_client_full.csv
# Git Bash:
wc -l businesses_PK_client_full.csv
```
That number minus 1 (for the header) is how many businesses have been scraped. Steady growth = healthy.

**Option 3 — tail the file in another terminal:**
```bash
# Git Bash:
tail -f data/output/businesses_PK_client_full.csv
```

---

## Phase E — Pull results to your primary laptop

See [pull-to-primary.md](pull-to-primary.md) for three options (git push, USB stick, LAN share).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `'node' is not recognized` | Close and reopen the terminal after installing Node, or reboot. |
| `npx playwright install chromium` hangs | Bad Wi-Fi. Retry. |
| Scraper launches but closes immediately | Check the console for the error. Most common: `--max-old-space-size` not set — but `run-forever.bat` already handles this. |
| Laptop went to sleep anyway | You missed one of the power settings in Phase B. Re-check all four toggles. |
| Console window closes unexpectedly | Windows Update rebooted. See Phase B step 4. |
| `UnhandledPromiseRejection` crashes every few minutes | Out of memory. Close other programs; the scraper uses up to 2 GB heap + 0.5-1 GB for Chromium. |

---

## Switching targets later

Stop the batch file, edit the 3 variables at the top of `run-forever.bat`, double-click to restart. Dedup picks up where it left off.
