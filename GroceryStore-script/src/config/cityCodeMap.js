/**
 * City name to 3-letter code mapping for Unique ID generation.
 *
 * Format: {COUNTRY}-{CITY_CODE}-{INCREMENT}
 * Example: UK-LON-001, FR-PAR-001
 *
 * HOW TO UPDATE:
 * - Add new city entries as: 'city name': 'CODE'
 * - Codes must be exactly 3 uppercase letters
 * - If a city is not found in the map, a code will be
 *   auto-generated from the first 3 letters of the city name
 */

const CITY_CODES = {
  UK: {
    'london': 'LON',
    'manchester': 'MAN',
    'birmingham': 'BIR',
    'leeds': 'LEE',
    'glasgow': 'GLA',
    'liverpool': 'LIV',
    'newcastle': 'NEW',
    'sheffield': 'SHE',
    'bristol': 'BRI',
    'edinburgh': 'EDI',
    'cardiff': 'CAR',
    'belfast': 'BEL',
    'nottingham': 'NOT',
    'leicester': 'LEI',
    'coventry': 'COV',
    'bradford': 'BRA',
    'stoke-on-trent': 'STO',
    'wolverhampton': 'WOL',
    'plymouth': 'PLY',
    'southampton': 'SOU',
    'reading': 'REA',
    'derby': 'DER',
    'dudley': 'DUD',
    'northampton': 'NOR',
    'portsmouth': 'POR',
    'luton': 'LUT',
    'preston': 'PRE',
    'aberdeen': 'ABE',
    'milton keynes': 'MIL',
    'sunderland': 'SUN',
    'norwich': 'NRW',
    'swansea': 'SWA',
    'oxford': 'OXF',
    'cambridge': 'CAM',
    'york': 'YOR',
    'peterborough': 'PET',
    'slough': 'SLO',
    'blackburn': 'BLK',
    'bolton': 'BOL',
    'rochdale': 'ROC',
    'oldham': 'OLD',
    'burnley': 'BUR',
    'warrington': 'WAR',
    'huddersfield': 'HUD',
    'bath': 'BAT',
    'exeter': 'EXE',
    'ipswich': 'IPS',
    'middlesbrough': 'MID',
    'wigan': 'WIG',
    'croydon': 'CRO',
    'ilford': 'ILF',
    'southall': 'STH',
    'tower hamlets': 'TOW',
    'east ham': 'EHA',
    'whitechapel': 'WHI',
    'tooting': 'TOO',
    'walthamstow': 'WAL',
    'sparkhill': 'SPK',
    'sparkbrook': 'SPB',
    'alum rock': 'ALU',
    'small heath': 'SMH',
    'rusholme': 'RUS',
    'cheetham hill': 'CHE',
    'longsight': 'LNG',
  },

  FR: {
    'paris': 'PAR',
    'marseille': 'MAR',
    'lyon': 'LYO',
    'toulouse': 'TOU',
    'nice': 'NIC',
    'nantes': 'NAN',
    'strasbourg': 'STR',
    'montpellier': 'MON',
    'bordeaux': 'BOR',
    'lille': 'LIL',
    'rennes': 'REN',
    'reims': 'REI',
    'saint-etienne': 'STE',
    'le havre': 'LEH',
    'toulon': 'TOL',
    'grenoble': 'GRE',
    'dijon': 'DIJ',
    'angers': 'ANG',
    'nimes': 'NIM',
    'clermont-ferrand': 'CLE',
    'le mans': 'LEM',
    'aix-en-provence': 'AIX',
    'brest': 'BRE',
    'tours': 'TRS',
    'amiens': 'AMI',
    'limoges': 'LIM',
    'perpignan': 'PER',
    'metz': 'MET',
    'besancon': 'BES',
    'orleans': 'ORL',
    'rouen': 'ROU',
    'mulhouse': 'MUL',
    'caen': 'CAE',
    'nancy': 'NAC',
    'argenteuil': 'ARG',
    'montreuil': 'MNT',
    'saint-denis': 'SDN',
    'aubervilliers': 'AUB',
    'creteil': 'CRE',
    'colombes': 'COL',
    'vitry-sur-seine': 'VIT',
    'bobigny': 'BOB',
    'sevran': 'SEV',
    'sarcelles': 'SAR',
    'clichy-sous-bois': 'CLI',
    'drancy': 'DRA',
    'bondy': 'BON',
    'epinay-sur-seine': 'EPI',
    'stains': 'STA',
  },

  DE: {
    'berlin': 'BER',
    'hamburg': 'HAM',
    'munich': 'MUN',
    'cologne': 'COL',
    'frankfurt': 'FRA',
    'stuttgart': 'STU',
    'dusseldorf': 'DUS',
    'dortmund': 'DOR',
    'essen': 'ESS',
    'bremen': 'BRE',
    'leipzig': 'LEI',
    'dresden': 'DRE',
    'hannover': 'HAN',
    'nuremberg': 'NUR',
  },

  IT: {
    'rome': 'ROM',
    'milan': 'MIL',
    'naples': 'NAP',
    'turin': 'TUR',
    'palermo': 'PAL',
    'genoa': 'GEN',
    'bologna': 'BOL',
    'florence': 'FLO',
    'catania': 'CAT',
    'venice': 'VEN',
    'verona': 'VER',
  },
};

/**
 * Get the 3-letter city code for a given city and country.
 * Falls back to first 3 uppercase letters if city is unknown.
 *
 * @param {string} city - City name
 * @param {string} country - Country code (UK, FR, DE, IT)
 * @returns {string} 3-letter city code
 */
export function getCityCode(city, country) {
  if (!city || !country) return 'UNK';

  const cityLower = city.toLowerCase().trim();
  const countryMap = CITY_CODES[country];

  if (countryMap && countryMap[cityLower]) {
    return countryMap[cityLower];
  }

  // Fallback: first 3 letters, uppercase
  const fallback = city
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 3)
    .toUpperCase();

  return fallback || 'UNK';
}

export default CITY_CODES;
