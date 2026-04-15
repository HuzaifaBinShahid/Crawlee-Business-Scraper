# Pulling scraper results from the spare laptop to your primary laptop

The scraper writes to `NationwideScraper/data/output/` on the spare laptop. You need to get those files to your main machine. Three options, pick what's easiest.

---

## Option 1 — Git push/pull (easiest if files are small)

**On the spare laptop** (whenever you want to sync):
```bash
cd Crawlee-Business-Scraper
git checkout -b scraped-data   # first time only
git add NationwideScraper/data/output
git commit -m "data snapshot"
git push -u origin scraped-data
```

**On your primary laptop**:
```bash
cd Crawlee-Business-Scraper
git fetch origin
git checkout scraped-data
# Or to merge into your working branch:
git checkout main
git checkout scraped-data -- NationwideScraper/data/output
```

**Caveat**: GitHub's per-file limit is **100 MB**. If the JSON gets bigger than that (likely after a full country), this option fails. Switch to Option 2 or enable Git LFS.

---

## Option 2 — USB stick (most reliable for big files)

1. Plug a USB stick into the spare laptop.
2. Copy the folder `Crawlee-Business-Scraper/NationwideScraper/data/output/` onto the stick.
3. Move the stick to your primary laptop.
4. Copy the files into the same path in your primary's clone of the repo.

No size limit. Works offline. Use for final data dumps.

---

## Option 3 — LAN file share (best for live sync)

If both laptops are on the same Wi-Fi:

### On the spare laptop
1. Right-click the `NationwideScraper/data/output/` folder → **Properties** → **Sharing** → **Advanced Sharing** → check **Share this folder** → **OK**.
2. Note the spare laptop's local IP: open PowerShell, run `ipconfig`, find the **IPv4 Address** (e.g. `192.168.1.45`).
3. Allow file sharing through Windows Firewall when prompted.

### On your primary laptop
Open File Explorer and paste into the address bar:
```
\\192.168.1.45\output
```
(Replace with the actual IP.) You can now browse, copy, or drag-and-drop files. You can also right-click → **Map network drive** for a persistent drive letter.

---

## Recommendation
- **During the run**: use Option 3 to peek at progress whenever you want.
- **Final hand-off**: use Option 2 (USB) for the complete dataset.
- Option 1 only if files stay under 100 MB.
