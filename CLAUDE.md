# Claude Context — Crawlee Business Scraper

## Project overview

Nationwide Google Maps business scraper for Pakistan (PK) and Saudi Arabia (SA). Built with Node.js + Crawlee + Playwright. Extracts business name, address, phone, website, hours, rating, review count, and social links.

**Hardware target**: 8 GB Windows laptop (Intel i7-7500U, 2 cores). All defaults are tuned for this — do NOT raise concurrency.

**Active subproject**: [NationwideScraper/](NationwideScraper/). The repo contains other scrapers (France, GroceryStore, etc.) that are inactive.

## Output

Per country, exactly **2 files** in `NationwideScraper/data/output/`:

- `businesses_{COUNTRY}_client_full.csv`
- `businesses_{COUNTRY}_client_full.json`

A temporary `.ndjson` exists during a run (streaming buffer) and is deleted after the JSON is written. If a run is interrupted (Ctrl+C), the NDJSON survives and is used as the dedup source on the next run.

**Dedup key** ([NationwideScraper/src/processors/deduplicator.js](NationwideScraper/src/processors/deduplicator.js)):
`lowercase(businessName) | lat_rounded_4dp | lon_rounded_4dp` (≈11m precision).

## Key files

| File | Purpose |
|------|---------|
| [NationwideScraper/src/main.js](NationwideScraper/src/main.js) | CLI entry, output streaming, dedup resume from prior runs |
| [NationwideScraper/src/scrapers/googleMaps.js](NationwideScraper/src/scrapers/googleMaps.js) | Crawler config, scroll logic, request handler, listing extraction |
| [NationwideScraper/src/config/cities/pk.json](NationwideScraper/src/config/cities/pk.json) | 89 PK cities with 3-letter codes |
| [NationwideScraper/src/config/cities/sa.json](NationwideScraper/src/config/cities/sa.json) | 34 SA cities with 3-letter codes |
| [NationwideScraper/src/config/keywords.js](NationwideScraper/src/config/keywords.js) | 8 categories, ~6-8 keywords each |
| [NationwideScraper/src/config/locations.js](NationwideScraper/src/config/locations.js) | Loads city JSON via `createRequire` |
| [NationwideScraper/src/config/cityCodeMap.js](NationwideScraper/src/config/cityCodeMap.js) | Derives city codes from same JSON files |
| [NationwideScraper/src/exporters/clientExport.js](NationwideScraper/src/exporters/clientExport.js) | `toClientRecord()`, client CSV/NDJSON writers |
| [NationwideScraper/src/exporters/jsonExporter.js](NationwideScraper/src/exporters/jsonExporter.js) | Streaming `finishJsonFromNdjson()` |
| [NationwideScraper/scripts/mergeOutputs.js](NationwideScraper/scripts/mergeOutputs.js) | Merges multiple per-day output files (legacy use) |
| [NationwideScraper/scripts/testLahoreGyms.js](NationwideScraper/scripts/testLahoreGyms.js) | Smoke test: ≥100 gyms in Lahore, no fatal errors |

## Non-obvious invariants

These are NOT inferable from reading the code — read this section before changing anything.

1. **`CRAWLEE_AVAILABLE_MEMORY_RATIO=0.7`** is set in [main.js](NationwideScraper/src/main.js) BEFORE any crawlee imports. Crawlee's default is 0.25, which on an 8 GB system makes it think only 2 GB is available — triggers false "memory critically overloaded" warnings. This env var must be set before the first `import` of crawlee.

2. **Concurrency MUST be 1.** Two parallel Playwright tabs scraping Google Maps reliably produces:
   - `elementHandle.evaluate: The object has been collected to prevent unbounded heap growth`
   - `Target page, context or browser has been closed`
   This is a known Playwright + Google Maps + low-RAM combination problem. The CLI `--concurrency` flag is ignored and forced to 1.

3. **Never hold a Playwright `elementHandle` across an async op > ~2 seconds.** Playwright auto-collects handles to prevent heap growth. Pattern that breaks: `const cards = await page.$$(...)` then iterate `cards[i]` while doing slow work in between (click + wait + nav). Pattern that works: snapshot all data via `page.$$eval` to plain JS strings, then iterate plain data.

4. **Each listing is visited via `page.goto(href)` — no click+goBack.** This eliminates stale-handle and scroll-position-reset issues entirely.

5. **`maxRequestRetries: 0`**. Retries recycle the session pool mid-request and cause the "context closed" error. Failed searches are recovered by re-running the same command — the dedup resume picks up where it left off.

6. **Dedup is per-run AND across-run.** On startup, `main.js` reads the existing client JSON to populate the dedup `Set`. This means re-running `--country=PK` after an interrupt resumes intelligently — already-scraped businesses are skipped before clicking.

7. **Process priority**: main.js sets itself to `BELOW_NORMAL` priority on Windows so VS Code, browsers etc. stay responsive while a multi-hour scrape runs in the background.

## Common commands

```bash
# Single city / single category
cd NationwideScraper
node --max-old-space-size=2048 src/main.js --country=PK --category="Gyms & Fitness" --city=Lahore

# Watch in browser (debugging)
node --max-old-space-size=2048 src/main.js --country=PK --category="Gyms & Fitness" --city=Lahore --no-headless

# Full country, single category (slow, hours)
node --max-old-space-size=2048 src/main.js --country=PK --category="Gyms & Fitness"

# Smoke test (≥100 gyms in Lahore)
npm run test:lahore-gyms

# Merge legacy date-stamped output files into one
node scripts/mergeOutputs.js --country=PK
```

## Categories (8 total, same for PK and SA)

`Health & Emergency`, `Commercial & Retail`, `Tourism & Hospitality`, `Food & Beverage`, `Spiritual & Social`, `Logistics & Finance`, `Entertainment & Sports`, `Gyms & Fitness`.

Each has 6-8 keywords. Total search URLs for one full country = 8 cats × ~7 kws × 89 cities ≈ 5000.

## Known failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `object has been collected to prevent unbounded heap growth` | Holding elementHandle too long | Use `page.$$eval` to snapshot to plain data, then `page.goto(href)` |
| `Target page, context or browser has been closed` | Retries recycling sessions | `maxRequestRetries: 0` + `keepAlive: true` |
| `requestHandler timed out` | Per-search budget exhausted | `requestHandlerTimeoutSecs: 3600` (60 min) |
| `Memory critically overloaded` (false) | Crawlee defaults to 25% of system RAM | `CRAWLEE_AVAILABLE_MEMORY_RATIO=0.7` |
| Sidebar doesn't render in `--no-headless` | `page.route` blocking stylesheets/fonts | Don't block CSS/fonts (currently nothing is blocked) |
| Only ~120 cards found, not all | Premature scroll exit | `scrollFullList` waits for skeleton-loader (`div.uj8Yqe`) to disappear before counting |
| Per-listing click "element not visible" | Skeleton loader covering card | Solved — direct nav now, no clicking |

## Design intent (what NOT to "improve")

- **Don't add concurrency.** It will crash on this hardware. If a future user has a beefier machine, expose it via env var, not the default.
- **Don't add retries.** Re-running the command achieves the same with cleaner state.
- **Don't re-block resources** (images/CSS/fonts). With concurrency=1, memory headroom is fine, and blocking CSS breaks the Google Maps sidebar.
- **Don't replace `page.goto(href)` with `card.click()`.** The whole point of the current architecture is to avoid elementHandles entirely.
- **Don't add date stamps to output filenames.** The single-file-per-country design is intentional — dedup carries forward across runs.

## Quick architecture sketch

```
main.js (CLI)
   │
   ├─ loads existing client JSON → dedup Set
   ├─ opens streaming writers (csv + ndjson)
   └─ scrapeGoogleMaps(...)
        │
        └─ PlaywrightCrawler (concurrency=1, no retries)
             │
             └─ requestHandler(page, request)
                  │
                  ├─ Phase A: scrollFullList(page) — scroll until end-of-list
                  ├─ Phase B: page.$$eval → plain data array
                  └─ Phase C: for each listing → page.goto(href) → extract → onRecord(record)
                                                                            │
                                                                            ├─ csv stream.write
                                                                            └─ ndjson stream.write
   │
   └─ on completion → finishJsonFromNdjson (streams ndjson → final json) → delete ndjson
```
