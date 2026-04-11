/**
 * Pause mechanism using a flag file.
 * The scraper polls for the file's existence and blocks while it exists.
 * Works cross-platform (Windows + Linux) unlike SIGSTOP.
 */

import fs from 'fs';
import { sleep } from './rateLimiter.js';

const PAUSE_FILE = process.env.PAUSE_FILE || '';

export async function checkPause() {
  if (!PAUSE_FILE) return;
  while (fs.existsSync(PAUSE_FILE)) {
    await sleep(1000);
  }
}

export default { checkPause };
