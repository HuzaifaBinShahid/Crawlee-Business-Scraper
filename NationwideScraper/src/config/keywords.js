/**
 * Seven sectors (categories) from client. Keyword-based for reuse (e.g. lawyers, mechanics).
 * Same structure: { name, keywords } per category.
 */

const KEYWORDS = {
  PK: {
    categories: [
      {
        name: 'Health & Emergency',
        keywords: [
          'pharmacy',
          '24 hour pharmacy',
          'hospital',
          'clinic',
          'medical laboratory',
          'optician',
          'dental clinic',
          'doctor',
        ],
      },
      {
        name: 'Commercial & Retail',
        keywords: [
          'supermarket',
          'grocery store',
          'market',
          'bazaar',
          'shopping mall',
          'department store',
          'butcher',
          'bakery',
          'food shop',
        ],
      },
      {
        name: 'Tourism & Hospitality',
        keywords: [
          'hotel',
          'furnished apartment',
          'landmark',
          'museum',
          'park',
          'restaurant',
          'cafe',
        ],
      },
      {
        name: 'Food & Beverage',
        keywords: [
          'restaurant',
          'cafe',
          'coffee shop',
          'dessert shop',
          'bakery',
          'fast food',
        ],
      },
      {
        name: 'Spiritual & Social',
        keywords: [
          'mosque',
          'masjid',
          'community center',
          'wedding hall',
          'NGO',
          'university',
          'school',
          'library',
        ],
      },
      {
        name: 'Logistics & Finance',
        keywords: [
          'bank',
          'ATM',
          'currency exchange',
          'gas station',
          'charging station',
          'post office',
          'DHL',
          'Aramex',
          'courier',
        ],
      },
      {
        name: 'Entertainment & Sports',
        keywords: [
          'gym',
          'sports club',
          'stadium',
          'cinema',
          'theater',
          'kids entertainment',
          'play area',
        ],
      },
    ],
  },
  SA: {
    categories: [
      {
        name: 'Health & Emergency',
        keywords: [
          'pharmacy',
          '24 hour pharmacy',
          'hospital',
          'clinic',
          'medical laboratory',
          'optician',
          'dental clinic',
          'doctor',
        ],
      },
      {
        name: 'Commercial & Retail',
        keywords: [
          'supermarket',
          'grocery store',
          'market',
          'mall',
          'department store',
          'butcher',
          'bakery',
          'food shop',
        ],
      },
      {
        name: 'Tourism & Hospitality',
        keywords: [
          'hotel',
          'furnished apartment',
          'landmark',
          'museum',
          'park',
          'restaurant',
          'cafe',
        ],
      },
      {
        name: 'Food & Beverage',
        keywords: [
          'restaurant',
          'cafe',
          'coffee shop',
          'dessert shop',
          'bakery',
          'fast food',
        ],
      },
      {
        name: 'Spiritual & Social',
        keywords: [
          'mosque',
          'masjid',
          'community center',
          'wedding hall',
          'NGO',
          'university',
          'school',
          'library',
        ],
      },
      {
        name: 'Logistics & Finance',
        keywords: [
          'bank',
          'ATM',
          'currency exchange',
          'gas station',
          'charging station',
          'post office',
          'DHL',
          'Aramex',
          'courier',
        ],
      },
      {
        name: 'Entertainment & Sports',
        keywords: [
          'gym',
          'sports club',
          'stadium',
          'cinema',
          'theater',
          'kids entertainment',
          'play area',
        ],
      },
    ],
  },
};

/**
 * Get categories for a country. Fallback to PK if SA or generic (same sectors).
 */
export function getCategories(country) {
  const key = country && typeof country === 'string' ? country.toUpperCase() : '';
  const data = KEYWORDS[key];
  if (data && data.categories && data.categories.length > 0) {
    return data.categories;
  }
  return KEYWORDS.PK.categories;
}

export default KEYWORDS;
