/**
 * City name to 3-letter code for external_id: {COUNTRY}-{CITY_CODE}-{PADDED_NUM}
 * Example: PK-KHI-000001, SA-RUH-000001
 */

const CITY_CODES = {
  PK: {
    karachi: 'KHI',
    lahore: 'LHE',
    islamabad: 'ISB',
    rawalpindi: 'RWP',
    faisalabad: 'FSD',
    multan: 'MUL',
    peshawar: 'PSH',
    quetta: 'QUE',
    sialkot: 'SIA',
    gujranwala: 'GUJ',
  },
  SA: {
    riyadh: 'RUH',
    jeddah: 'JED',
    mecca: 'MEC',
    medina: 'MED',
    dammam: 'DAM',
    khobar: 'KHO',
    taif: 'TAI',
    buraidah: 'BUR',
    tabuk: 'TAB',
    abha: 'ABH',
  },
};

/**
 * @param {string} city - City name
 * @param {string} country - Country code (PK, SA, etc.)
 * @returns {string} 3-letter code
 */
export function getCityCode(city, country) {
  if (!city || !country) return 'UNK';
  const cityLower = city.toLowerCase().trim();
  const countryMap = CITY_CODES[country.toUpperCase()];
  if (countryMap && countryMap[cityLower]) return countryMap[cityLower];
  const fallback = city.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  return fallback || 'UNK';
}

export default CITY_CODES;
