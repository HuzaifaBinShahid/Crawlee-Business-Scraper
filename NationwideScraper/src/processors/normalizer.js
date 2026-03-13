/**
 * Normalize scraped fields. Same shape as France pipeline.
 * Phone: ensure +92 (Pakistan) or +966 (Saudi) when applicable.
 */

export function toTitleCase(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().split(/\s+/).map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w)).join(' ');
}

export function normalizeName(name) {
  if (!name) return '';
  return name.replace(/\s+/g, ' ').trim();
}

export function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/[^\d+\s()-]/g, '').replace(/\s+/g, ' ').trim();
}

/** Ensure phone has correct country code for PK/SA when it looks local. */
export function normalizePhoneForCountry(phone, countryCode) {
  let p = normalizePhone(phone);
  if (!p) return '';
  const upper = (countryCode || '').toUpperCase();
  if (upper === 'PK' && p.length > 0 && !p.startsWith('+92')) {
    p = p.replace(/^0/, '');
    return '+' + (p.startsWith('92') ? p : '92' + p);
  }
  if (upper === 'SA' && p.length > 0 && !p.startsWith('+966')) {
    p = p.replace(/^0/, '');
    return '+' + (p.startsWith('966') ? p : '966' + p);
  }
  return p;
}

export function normalizeUrl(url) {
  if (!url) return '';
  let cleaned = url.trim().replace(/\/+$/, '');
  if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) cleaned = `https://${cleaned}`;
  if (cleaned.toLowerCase().startsWith('http://')) cleaned = 'https://' + cleaned.slice(7);
  return cleaned;
}

export function normalizeAddress(address) {
  if (!address) return '';
  return address.replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/^[,\s]+|[,\s]+$/g, '').trim();
}

export function validateSocialMedia(url, platform) {
  if (!url) return '';
  const cleaned = url.trim().toLowerCase();
  const patterns = { facebook: /facebook\.com/, instagram: /instagram\.com/, tiktok: /tiktok\.com/ };
  if (patterns[platform] && patterns[platform].test(cleaned)) return normalizeUrl(url);
  return '';
}

export function normalizeCoordinate(coord) {
  if (coord === null || coord === undefined || coord === '') return null;
  const parsed = parseFloat(coord);
  if (Number.isNaN(parsed)) return null;
  return Math.round(parsed * 1e7) / 1e7;
}

export function normalizeHours(hours) {
  if (!hours) return '';
  let cleaned = hours.trim();
  cleaned = cleaned.replace(/Suggest new hours|Hide open hours|Open hours|Hours might differ|See more hours|Confirm these hours/gi, '').trim();
  if (/^open\s+24\s+hours$/i.test(cleaned)) return 'Open 24 hours';
  if (/^closed$/i.test(cleaned) || !cleaned) return cleaned || '';
  return cleaned.replace(/\s+/g, ' ').replace(/\n/g, ' | ').trim();
}

export function normalizeRecord(record, countryCode = null) {
  const country = countryCode || record.country || '';
  return {
    ...record,
    businessName: normalizeName(record.businessName),
    street: normalizeAddress(record.street),
    city: normalizeName(record.city),
    zipCode: record.zipCode ? record.zipCode.trim() : '',
    state: normalizeName(record.state),
    phone: normalizePhoneForCountry(record.phone || '', country) || normalizePhone(record.phone || ''),
    website: normalizeUrl(record.website),
    googleMapsLink: (record.googleMapsLink || '').trim(),
    latitude: normalizeCoordinate(record.latitude),
    longitude: normalizeCoordinate(record.longitude),
    openingHours: normalizeHours(record.openingHours),
    rating: (() => {
      if (record.rating == null || record.rating === '') return null;
      const n = typeof record.rating === 'number' ? record.rating : parseFloat(record.rating);
      return Number.isNaN(n) ? null : n;
    })(),
    review_count: (() => {
      if (record.review_count == null || record.review_count === '') return null;
      const n = typeof record.review_count === 'number' ? record.review_count : parseInt(record.review_count, 10);
      return Number.isNaN(n) ? null : n;
    })(),
    facebook: validateSocialMedia(record.facebook, 'facebook'),
    instagram: validateSocialMedia(record.instagram, 'instagram'),
    tiktok: validateSocialMedia(record.tiktok, 'tiktok'),
  };
}

export default { toTitleCase, normalizeName, normalizePhone, normalizePhoneForCountry, normalizeUrl, normalizeAddress, validateSocialMedia, normalizeCoordinate, normalizeHours, normalizeRecord };
