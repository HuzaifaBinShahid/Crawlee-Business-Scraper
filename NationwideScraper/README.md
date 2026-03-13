# Nationwide Scraper

Google Maps–only scraper for Pakistan, Saudi Arabia, and any country. Output uses the **same schema as the France dataset** (external_id, name, category, address, city, postcode, country_code, phone, website, latitude, longitude, opening_hours, source, source_url; optional rating, review_count, tags).

## Requirements

- Node.js 18+
- npm

## Install

```bash
cd NationwideScraper
npm install
npx playwright install chromium
```

## Run

### Full scrape (all categories, all locations)

```bash
node src/main.js --country=PK
node src/main.js --country=SA
node src/main.js --country=Pakistan
node src/main.js --country="Saudi Arabia"
```

### Sample mode (50 records total, ~10 per category, then stop)

```bash
node src/main.js --country=PK --sample
node src/main.js --country=SA --sample
npm run sample:pk
npm run sample:sa
```

### One category only

```bash
node src/main.js --country=PK --category="Health & Emergency"
node src/main.js --country=SA --category="Food & Beverage"
```

### Other countries (e.g. India)

Search uses the country name in the query. Add cities in `src/config/locations.js` for that country, or the scraper uses the country name as a single location.

```bash
node src/main.js --country=India
node src/main.js --country=India --sample
```

### Options

| Option        | Short | Description                                      |
|---------------|-------|--------------------------------------------------|
| `--country`   | `-c`  | Required. PK, SA, Pakistan, Saudi Arabia, India, etc. |
| `--sample`    | `-s`  | Fetch 50 records total (~10 per category), then stop. |
| `--category`  | `--cat` | Optional. Restrict to one category name.         |
| `--output`    | `-o`  | Output directory (default: `data/samples` or `data/output`). |
| `--concurrency` |     | Max concurrent browser pages (default: 2).      |

## Output

- **data/output/** (full) or **data/samples/** (sample):
  - `businesses_{COUNTRY}_{full|sample}_{date}.csv` — internal shape
  - `businesses_{COUNTRY}_{full|sample}_{date}.json` — same with metadata
  - `businesses_{COUNTRY}_client_sample_50_{date}.csv` / `.ndjson` — client schema (sample)
  - `businesses_{COUNTRY}_client_full_{date}.csv` / `.ndjson` — client schema (full)

Client files match the France schema: external_id (e.g. PK-KHI-000001), name, category_raw, lat, lon, address, city, postcode, country_code, phone, website, source, source_url, opening_hours, rating, review_count, etc. UTF-8, Title Case categories, https:// URLs, phone codes +92 (Pakistan), +966 (Saudi Arabia).

## Updating keywords and cities

- **Categories / keywords**  
  Edit `src/config/keywords.js`. The seven sectors (Health & Emergency, Commercial & Retail, Tourism & Hospitality, Food & Beverage, Spiritual & Social, Logistics & Finance, Entertainment & Sports) each have a `name` and `keywords` array. Add or change keywords (e.g. lawyers, mechanics, dentists) and they will be used in Google Maps searches.

- **Cities**  
  Edit `src/config/locations.js`. Add entries under `LOCATIONS.PK.major`, `LOCATIONS.SA.major`, or a new country key. Sample mode uses only the first city.

- **City codes (for external_id)**  
  Edit `src/config/cityCodeMap.js` to add or change 3-letter city codes (e.g. Karachi → KHI, Riyadh → RUH).

- **Country display name**  
  For new countries or aliases, edit `src/config/countryNames.js` so the search query uses the correct “keyword in city, CountryName” form.

## Structure

Same layout as the France scraper (GroceryStore-script):

- `src/main.js` — CLI and pipeline
- `src/config/` — keywords, locations, sources, cityCodeMap, countryNames
- `src/scrapers/googleMaps.js` — Google Maps only (same selectors as France)
- `src/processors/` — normalizer, deduplicator
- `src/exporters/` — clientExport (France schema), csvExporter, jsonExporter
- `src/utils/` — logger, rateLimiter, idGenerator (6-digit IDs)

No backend or frontend; run from the command line only.
