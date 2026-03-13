# Grocery & Muslim Community Business Directory Scraper

A comprehensive web scraping tool built with **Crawlee** + **Playwright** (Chromium) to extract business listings for the Muslim community across **UK** and **France**.

---

## Table of Contents

- [Overview](#overview)
- [Data Sources](#data-sources)
- [Categories Covered](#categories-covered)
- [Data Fields](#data-fields)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [How to Run](#how-to-run)
- [How to Update Keywords](#how-to-update-keywords)
- [Output Format](#output-format)
- [Configuration](#configuration)
- [Unique ID Format](#unique-id-format)
- [Technical Notes](#technical-notes)

---

## Overview

This scraper builds a 360-degree directory targeting businesses run by or serving the Muslim community, including:

- Independent groceries & halal butchers
- Car mechanics, rentals & repair shops
- Doctors, lawyers, accountants & engineers
- Gold/jewelry, Islamic fashion & halal gyms
- Mosques, Islamic schools & halal hotels
- Translation, shipping & funeral services

## Data Sources

| Country | Primary Source | Secondary Source |
|---------|---------------|------------------|
| UK      | Google Maps   | Yell.co.uk       |
| France  | Google Maps   | PagesJaunes.fr   |

Records from both sources are **deduplicated** and **merged** to ensure the most complete data with zero duplicates.

## Categories Covered

1. Halal Groceries & Butchers
2. Car Mechanics (High Priority)
3. Car Rentals
4. Repair Shops (Phone, Laptop, Electronics)
5. Doctors
6. Lawyers
7. Accountants
8. Engineers
9. Gold & Jewelry
10. Islamic Fashion
11. Halal Gyms
12. Mosques
13. Islamic Schools
14. Halal Hotels
15. Translation Services
16. Shipping Services
17. Islamic Funeral Services

## Data Fields

Each record contains:

| Field | Description |
|-------|-------------|
| Unique ID | Format: `UK-LON-001`, `FR-PAR-001` |
| Business Name | Full name |
| Type | `Chain` or `Independent` |
| Category | One of the 17 categories |
| Street | Street address |
| City | City name |
| Zip Code | Postal code |
| State/Region | County or region |
| Country | `UK` or `FR` |
| Phone | Contact number |
| Website URL | Business website |
| Google Maps Link | Direct link (for GPS) |
| Latitude | GPS coordinate |
| Longitude | GPS coordinate |
| Opening Hours | If available |
| Facebook | Facebook page URL |
| Instagram | Instagram profile URL |
| TikTok | TikTok profile URL |
| Data Source | Which source(s) provided the data |

## Project Structure

```
GroceryStore-script/
├── src/
│   ├── main.js                    # Entry point / orchestrator
│   ├── config/
│   │   ├── sources.js             # Data source URLs
│   │   ├── keywords.js            # Search keywords per category
│   │   ├── chains.js              # Known chain names (for filtering)
│   │   ├── locations.js           # Cities & areas per country
│   │   └── cityCodeMap.js         # City -> 3-letter code mapping
│   ├── scrapers/
│   │   ├── googleMaps.js          # Google Maps scraper (Playwright)
│   │   ├── yellUk.js              # Yell.co.uk scraper
│   │   └── pagesJaunes.js         # PagesJaunes.fr scraper
│   ├── processors/
│   │   ├── deduplicator.js        # Cross-source deduplication
│   │   └── categorizer.js         # Chain/Independent tagging + IDs
│   ├── exporters/
│   │   ├── csvExporter.js         # CSV export (UTF-8 with BOM)
│   │   └── jsonExporter.js        # JSON export (structured)
│   └── utils/
│       ├── logger.js              # Winston logger
│       ├── idGenerator.js         # Unique ID generator
│       ├── rateLimiter.js         # Delay & retry utilities
│       └── normalizer.js          # Data cleaning & normalization
├── data/
│   ├── output/                    # Full scrape output files
│   └── samples/                   # Sample output files
├── .env                           # Environment configuration
├── package.json                   # Dependencies & scripts
└── README.md                      # This file
```

## Setup & Installation

### Prerequisites

- **Node.js** v18 or higher
- **npm** v8 or higher

### Install

```bash
# Clone or download the project
cd GroceryStore-script

# Install dependencies
npm install

# Install Playwright browsers (Chromium)
npx playwright install chromium
```

## How to Run

### Sample Mode (10-15 records for review)

```bash
# UK sample
npm run sample:uk

# France sample
npm run sample:fr
```

### Full Scrape

```bash
# Full UK scrape
npm run start:uk

# Full France scrape
npm run start:fr
```

### Advanced Options

```bash
# Scrape only Google Maps
node src/main.js --country=UK --source=google

# Scrape only Yellow Pages
node src/main.js --country=FR --source=yellow

# Custom concurrency
node src/main.js --country=UK --concurrency=5

# Custom output directory
node src/main.js --country=UK --output=./my-output
```

### CLI Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--country` | `-c` | Country code (`UK` or `FR`) | Required |
| `--sample` | `-s` | Sample mode (limited results) | `false` |
| `--source` | | `google`, `yellow`, or `all` | `all` |
| `--concurrency` | | Max browser pages | `3` |
| `--output` | `-o` | Output directory | `data/output` |
| `--help` | `-h` | Show help | |

## How to Update Keywords

Edit `src/config/keywords.js`:

```javascript
// Add a new keyword to an existing category
{
  name: 'Halal Groceries & Butchers',
  keywords: [
    'halal grocery',
    'halal butcher',
    'your new keyword here',  // <-- Add here
  ],
},

// Add a new category
{
  name: 'Your New Category',
  keywords: [
    'keyword 1',
    'keyword 2',
  ],
},
```

### Update Locations

Edit `src/config/locations.js` to add new cities or areas.

### Update Chain List

Edit `src/config/chains.js` to add new chain/franchise names.

## Output Format

### CSV

- **Encoding**: UTF-8 with BOM (Excel-compatible)
- **Quoting**: All fields quoted
- **File naming**: `businesses_{COUNTRY}_{mode}_{date}.csv`

### JSON

- **Encoding**: UTF-8
- **Structure**: `{ metadata: {...}, data: [...] }`
- **Includes**: Export date, statistics, all records
- **File naming**: `businesses_{COUNTRY}_{mode}_{date}.json`

## Configuration

Edit `.env` for runtime settings:

```env
# Run browser in headless mode (true/false)
HEADLESS=true

# Delay between requests (ms)
MIN_DELAY=2000
MAX_DELAY=5000

# Browser pages running at once
MAX_CONCURRENCY=5

# Retry failed requests
MAX_RETRIES=3

# Proxy (optional, recommended for large scrapes)
PROXY_URL=http://user:pass@host:port
```

## Unique ID Format

```
{COUNTRY}-{CITY_CODE}-{INCREMENT}

Examples:
  UK-LON-001   (1st record in London, UK)
  UK-MAN-042   (42nd record in Manchester, UK)
  FR-PAR-001   (1st record in Paris, France)
  FR-LYO-015   (15th record in Lyon, France)
```

City codes are defined in `src/config/cityCodeMap.js`. Unknown cities use the first 3 letters of the city name.

## Technical Notes

- **Browser**: Chromium via Playwright (handles JavaScript-heavy pages like Google Maps)
- **Anti-detection**: Random delays, realistic viewport, cookie consent handling
- **Deduplication**: Fuzzy string matching (name + address) across sources
- **Encoding**: UTF-8 throughout (supports German, Turkish, Arabic characters)
- **Resumability**: Crawlee's built-in RequestQueue persists state for resuming failed runs
- **Logging**: Winston logger with both console and file output
- **Error handling**: Retry with exponential backoff, graceful failure recovery

---

**Built for the Muslim Community Directory Project**
