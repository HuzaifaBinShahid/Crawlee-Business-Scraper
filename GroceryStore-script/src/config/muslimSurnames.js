const RELIGIOUS_KEYWORDS = [
  'halal',
  'islamic',
  'islam',
  'muslim',
  'mosque',
  'masjid',
  'musulman',
  'musulmane',
  'musulmanes',
  'halal',
  'islamique',
  'islamiques',
  'coran',
  'quran',
  'janazah',
  'sharia',
  'sunni',
  'sufi',
];

const SURNAMES_ARAB_NORTH_AFRICAN = [
  'al-masri',
  'masri',
  'mansour',
  'benali',
  'benali',
  'belkacem',
  'hamidi',
  'khelifi',
  'ouahabi',
  'bensaoud',
  'meziane',
  'amrani',
  'elamin',
  'elhassan',
  'alsayed',
  'alhassan',
  'omar',
  'hassan',
  'hussein',
  'ali',
  'ahmed',
  'mohamed',
  'mohammed',
  'ibrahim',
  'khalil',
  'youssef',
  'yusuf',
  'abbas',
  'hassan',
  'hussain',
  'hussain',
  'malek',
  'rashid',
  'saleh',
  'farouk',
  'nour',
  'karim',
  'jamal',
  'tariq',
  'bilal',
  'osman',
  'khalid',
  'saeed',
  'nasser',
  'faisal',
  'abdul',
  'el',
  'ben',
];

const SURNAMES_SOUTH_ASIAN = [
  'khan',
  'ahmed',
  'iqbal',
  'islam',
  'hussain',
  'hassan',
  'ali',
  'malik',
  'sheikh',
  'shaikh',
  'syed',
  'siddiqui',
  'qureshi',
  'pathan',
  'choudhury',
  'chowdhury',
  'rahman',
  'hossain',
  'hasan',
  'mahmood',
  'mahmud',
  'mirza',
  'mughal',
  'qureshi',
  'sultan',
  'abbasi',
  'naqvi',
  'rizvi',
  'jafri',
  'bukhari',
  'farooq',
  'azam',
  'akram',
  'aslam',
  'rehman',
  'karim',
  'halim',
  'salam',
  'rahman',
];

const SURNAMES_TURKISH_BALKAN = [
  'yilmaz',
  'kaya',
  'hoxha',
  'demir',
  'arslan',
  'ozturk',
  'celik',
  'aydin',
  'sahin',
  'kurt',
  'aslan',
  'yildirim',
  'koç',
  'koc',
  'polat',
  'ergun',
  'alkan',
  'bekir',
  'mehmet',
  'mustafa',
  'osman',
  'halil',
  'ibrahim',
  'ismail',
  'ali',
  'hassan',
  'dervish',
  'begic',
  'hodzic',
  'hasanovic',
  'mehic',
  'suljic',
];

const SURNAMES_WEST_AFRICAN = [
  'diop',
  'ndiaye',
  'sow',
  'ba',
  'diallo',
  'sall',
  'fall',
  'gueye',
  'ndoye',
  'mbaye',
  'tall',
  'ka',
  'sy',
  'traore',
  'toure',
  'cissé',
  'cisse',
  'sakho',
  'sane',
  'mane',
  'seck',
  'wade',
  'thiam',
  'sene',
];

const ALL_SURNAMES = [
  ...new Set([
    ...SURNAMES_ARAB_NORTH_AFRICAN,
    ...SURNAMES_SOUTH_ASIAN,
    ...SURNAMES_TURKISH_BALKAN,
    ...SURNAMES_WEST_AFRICAN,
  ]),
];

/**
 * Curated subset for search expansion (ethnic surname expansion).
 * Used to build "profession + surname" search queries for independent
 * professionals (Doctors, Lawyers, Mechanics, Accountants, Engineers).
 * Representative surnames from each region to keep URL count manageable.
 */
const SURNAMES_FOR_SEARCH = [
  // Arab & North African
  'al-masri',
  'masri',
  'mansour',
  'benali',
  'omar',
  'hassan',
  // South Asian
  'khan',
  'ahmed',
  'iqbal',
  'islam',
  'hussain',
  'rahman',
  'sheikh',
  'siddiqui',
  // Turkish/Balkan
  'yilmaz',
  'kaya',
  'hoxha',
  'demir',
  'ozturk',
  'arslan',
  // West African
  'diop',
  'ndiaye',
  'sow',
  'diallo',
  'ba',
  'gueye',
];

/**
 * Returns probability label. Client requirement: column must be populated.
 * Uses religious keywords → 100%, surname match → High, else → Low.
 */
export function getProbabilityOfMuslimOwnership(businessName, category) {
  if (!businessName || typeof businessName !== 'string') return 'Low';
  const name = businessName.toLowerCase().trim();

  for (const kw of RELIGIOUS_KEYWORDS) {
    if (name.includes(kw)) return '100%';
  }

  const words = name.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^a-z'-]/g, '');
    if (clean.length > 0 && ALL_SURNAMES.includes(clean)) return 'High';
  }

  return 'Low';
}

export {
  RELIGIOUS_KEYWORDS,
  ALL_SURNAMES,
  SURNAMES_FOR_SEARCH,
  SURNAMES_ARAB_NORTH_AFRICAN,
  SURNAMES_SOUTH_ASIAN,
  SURNAMES_TURKISH_BALKAN,
  SURNAMES_WEST_AFRICAN,
};
