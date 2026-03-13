import { hasNegativeKeyword } from '../config/negativeKeywords.js';
import logger from '../utils/logger.js';

export function filterNegativeKeywords(records) {
  if (!records || records.length === 0) return [];

  const filtered = records.filter((r) => {
    const name = r.businessName || '';
    if (hasNegativeKeyword(name)) return false;
    return true;
  });

  const removed = records.length - filtered.length;
  if (removed > 0) {
    logger.info(
      `[NegativeFilter] Excluded ${removed} records (pork/alcohol/bar/pub in name). ` +
        `Remaining: ${filtered.length}`,
    );
  }

  return filtered;
}

export default { filterNegativeKeywords };
