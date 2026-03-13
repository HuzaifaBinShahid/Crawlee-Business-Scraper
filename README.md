# Business Scraper

Monorepo for business/directory scrapers and the GroceryStore pipeline (UK/France): scrapers, API, and frontend.

## Repository layout

| Folder | Purpose |
|--------|--------|
| **GroceryStore-script** | UK & France scraper: Google Maps, Yell (UK), PagesJaunes (FR). Crawlee + Playwright. Muslim-community directory (halal, mosques, mechanics, etc.). See [GroceryStore-script/README.md](GroceryStore-script/README.md). |
| **NationwideScraper** | Country-agnostic scraper (Pakistan, Saudi Arabia, India, etc.). Google Maps only, same output schema as France. CLI-only, no backend/frontend. See [NationwideScraper/README.md](NationwideScraper/README.md). |
| **backend** | Express API for the GroceryStore pipeline: serves scraped data by country/category. Used by the frontend. |
| **Frontend** | React + Vite + Chakra UI app to browse and filter GroceryStore data (UK/FR). Talks to `backend`. |

## Quick start

- **UK/France directory (full pipeline):** install and run `GroceryStore-script`, then `backend`, then `Frontend`. See each folder’s README.
- **Pakistan / Saudi / other countries:** use `NationwideScraper` only; no backend or frontend needed.