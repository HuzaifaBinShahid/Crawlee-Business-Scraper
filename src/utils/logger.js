/**
 * Logger utility using Winston.
 * Provides structured logging with timestamps, log levels,
 * and both console + file output.
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log file paths
const LOG_DIR = path.join(__dirname, '..', '..', 'data');
const ERROR_LOG = path.join(LOG_DIR, 'error.log');
const COMBINED_LOG = path.join(LOG_DIR, 'combined.log');

/**
 * Custom log format with timestamp, level, and message.
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? ` | ${JSON.stringify(meta)}`
      : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }),
);

/**
 * Console format with colors for better readability.
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level}: ${message}`;
  }),
);

const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    // Write errors to error.log
    new winston.transports.File({
      filename: ERROR_LOG,
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: COMBINED_LOG,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Console output with colors
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

export default logger;
