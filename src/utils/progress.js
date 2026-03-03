/**
 * Progress persistence for pause/resume of full UK scrape.
 *
 * Saves completed search keys and ID generator state so the run
 * can resume from where it left off (e.g. after Ctrl+C).
 */

import fs from 'fs';
import path from 'path';
import logger from './logger.js';

/**
 * Build a unique key for one search (category + keyword + location).
 *
 * @param {Object} userData - request.userData from crawler
 * @returns {string}
 */
export function searchKey(userData) {
  const { categoryName, keyword, location } = userData;
  return `${categoryName}|${keyword}|${location}`;
}

/**
 * Load progress from file if it exists.
 *
 * @param {string} progressPath - Full path to progress JSON file
 * @returns {Object|null} { runKey, csvPath, jsonlPath, completedSearches, idGeneratorState } or null
 */
export function loadProgress(progressPath) {
  if (!progressPath || !fs.existsSync(progressPath)) return null;
  try {
    const raw = fs.readFileSync(progressPath, 'utf-8');
    const data = JSON.parse(raw);
    if (
      !Array.isArray(data.completedSearches) ||
      typeof data.idGeneratorState !== 'object'
    ) {
      return null;
    }
    return data;
  } catch (e) {
    logger.warn(`Could not load progress file: ${e.message}`);
    return null;
  }
}

/**
 * Save progress to file (overwrites).
 *
 * @param {string} progressPath - Full path to progress JSON file
 * @param {Object} data - { runKey, csvPath, jsonlPath, completedSearches, idGeneratorState }
 */
export function saveProgress(progressPath, data) {
  if (!progressPath) return;
  const dir = path.dirname(progressPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(progressPath, JSON.stringify(data, null, 0), 'utf-8');
}

export default { searchKey, loadProgress, saveProgress };
