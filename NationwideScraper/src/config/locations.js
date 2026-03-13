/**
 * Locations per country. Sample mode uses first city only (e.g. Karachi, Riyadh).
 */

const LOCATIONS = {
  PK: {
    major: [
      'Karachi',
      'Lahore',
      'Islamabad',
      'Rawalpindi',
      'Faisalabad',
      'Multan',
      'Peshawar',
      'Quetta',
      'Sialkot',
      'Gujranwala',
    ],
  },
  SA: {
    major: [
      'Riyadh',
      'Jeddah',
      'Mecca',
      'Medina',
      'Dammam',
      'Khobar',
      'Taif',
      'Buraidah',
      'Tabuk',
      'Abha',
    ],
  },
};

/**
 * @param {string} country - Country code (PK, SA) or generic name
 * @param {boolean} sampleOnly - If true, return only first city for sample (50 records)
 * @returns {string[]}
 */
export function getLocations(country, sampleOnly = false) {
  const key = country && typeof country === 'string' ? country.toUpperCase() : '';
  const data = LOCATIONS[key];
  if (!data) {
    // Generic country: use country name as single location
    return country ? [country.trim()] : [];
  }
  const all = [...(data.major || [])];
  if (sampleOnly) return all.length ? [all[0]] : [];
  return all;
}

export default LOCATIONS;
