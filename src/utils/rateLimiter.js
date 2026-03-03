/**
 * Rate Limiter Utility.
 *
 * Introduces random delays between requests to avoid
 * detection and rate-limiting by target websites.
 * Configurable via .env variables.
 */

import dotenv from 'dotenv';
dotenv.config();

// Default delay range in milliseconds
const MIN_DELAY = parseInt(process.env.MIN_DELAY, 10) || 2000;
const MAX_DELAY = parseInt(process.env.MAX_DELAY, 10) || 5000;

/**
 * Sleep for a random duration between min and max milliseconds.
 *
 * @param {number} [min=MIN_DELAY] - Minimum delay in ms
 * @param {number} [max=MAX_DELAY] - Maximum delay in ms
 * @returns {Promise<void>}
 */
export async function randomDelay(min = MIN_DELAY, max = MAX_DELAY) {
  const delay = Math.floor(
    Math.random() * (max - min + 1) + min,
  );
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Sleep for a fixed duration.
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 *
 * @param {Function} fn - Async function to retry
 * @param {number} [maxRetries=3] - Maximum retry attempts
 * @param {number} [baseDelay=1000] - Base delay in ms
 * @returns {Promise<*>} Result of the function
 */
export async function retryWithBackoff(
  fn,
  maxRetries = parseInt(process.env.MAX_RETRIES, 10) || 3,
  baseDelay = 1000,
) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay =
          baseDelay * Math.pow(2, attempt) +
          Math.random() * 1000;
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

export default { randomDelay, sleep, retryWithBackoff };
