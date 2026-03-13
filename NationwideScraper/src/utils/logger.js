/**
 * Logger utility. Uses Winston when available; falls back to console.
 */

import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`),
);

const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({ format: winston.format.combine(winston.format.colorize(), logFormat) }),
    new winston.transports.File({ filename: path.join(LOG_DIR, 'combined.log'), maxsize: 10 * 1024 * 1024, maxFiles: 3 }),
  ],
});

export default logger;
