/**
 * Rate limiter: random delays between requests.
 */

const MIN_DELAY = 2000;
const MAX_DELAY = 5000;

export async function randomDelay(min = MIN_DELAY, max = MAX_DELAY) {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default { randomDelay, sleep };
