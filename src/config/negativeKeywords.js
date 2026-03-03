const NEGATIVE_KEYWORDS = [
  'pork',
  'pig',
  'alcohol',
  'wine',
  'bar',
  'pub',
];

export function hasNegativeKeyword(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

export default NEGATIVE_KEYWORDS;
