import path from 'path';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');

// GroceryStore scraper (UK / FR)
const defaultScraperDir = path.join(rootDir, 'GroceryStore-script');
const defaultOutputDir = path.join(defaultScraperDir, 'data', 'output');
const defaultSamplesDir = path.join(defaultScraperDir, 'data', 'samples');

export const SCRAPER_DIR = process.env.SCRAPER_DIR || defaultScraperDir;
export const OUTPUT_DIR = process.env.OUTPUT_DIR || defaultOutputDir;
export const SAMPLES_DIR = process.env.SAMPLES_DIR || defaultSamplesDir;

// NationwideScraper (PK / SA / others)
const defaultNationwideDir = path.join(rootDir, 'NationwideScraper');
const defaultNationwideOutputDir = path.join(defaultNationwideDir, 'data', 'output');
const defaultNationwideSamplesDir = path.join(defaultNationwideDir, 'data', 'samples');

export const NATIONWIDE_DIR = process.env.NATIONWIDE_DIR || defaultNationwideDir;
export const NATIONWIDE_OUTPUT_DIR = process.env.NATIONWIDE_OUTPUT_DIR || defaultNationwideOutputDir;
export const NATIONWIDE_SAMPLES_DIR = process.env.NATIONWIDE_SAMPLES_DIR || defaultNationwideSamplesDir;

export const PORT = parseInt(process.env.PORT || '5000', 10);

// Countries are now managed at runtime via backend/data/countries.json (admin-editable
// from the Settings tab). NATIONWIDE_COUNTRIES / NATIONWIDE_CITIES were removed —
// any country with `scraper: "nationwide"` in the registry + a cities/{cc}.json file
// just works. UK and FR remain hardcoded in the GroceryStore scraper because that
// scraper has UK/FR-specific keyword expansions.

// Categories per scraper
export const CATEGORIES = [
  'Halal Groceries & Butchers',
  'Car Mechanics',
  'Car Rentals',
  'Repair Shops',
  'Doctors',
  'Lawyers',
  'Accountants',
  'Engineers',
  'Gold & Jewelry',
  'Islamic Fashion',
  'Halal Gyms',
  'Mosques',
  'Islamic Schools',
  'Halal Hotels',
  'Translation Services',
  'Shipping Services',
  'Islamic Funeral Services',
];

export const NATIONWIDE_CATEGORIES = [
  'Health & Emergency',
  'Commercial & Retail',
  'Tourism & Hospitality',
  'Food & Beverage',
  'Spiritual & Social',
  'Logistics & Finance',
  'Entertainment & Sports',
  'Gyms & Fitness',
];

// Default seed for backend/data/countries.json on first boot. Edit the file directly
// or use the Settings tab to add/remove countries — never modify this default after
// deployment, the runtime registry is the source of truth.
export const DEFAULT_COUNTRIES = [
  { code: 'UK', name: 'United Kingdom', scraper: 'grocery' },
  { code: 'FR', name: 'France',         scraper: 'grocery' },
  { code: 'PK', name: 'Pakistan',       scraper: 'nationwide' },
  { code: 'SA', name: 'Saudi Arabia',   scraper: 'nationwide' },
];

// Path inside the NationwideScraper where per-country city JSON files live.
// Backend reads + writes these directly when admin manages cities from the dashboard.
export const NATIONWIDE_CITIES_DIR = path.join(NATIONWIDE_DIR, 'src', 'config', 'cities');
