import path from 'path';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const defaultScraperDir = path.join(rootDir, 'GroceryStore-script');
const defaultOutputDir = path.join(defaultScraperDir, 'data', 'output');
const defaultSamplesDir = path.join(defaultScraperDir, 'data', 'samples');

export const SCRAPER_DIR = process.env.SCRAPER_DIR || defaultScraperDir;
export const OUTPUT_DIR = process.env.OUTPUT_DIR || defaultOutputDir;
export const SAMPLES_DIR = process.env.SAMPLES_DIR || defaultSamplesDir;
export const PORT = parseInt(process.env.PORT || '5000', 10);

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
