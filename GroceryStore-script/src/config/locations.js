/**
 * Location lists for each country.
 *
 * These cities/areas are used as search locations to ensure
 * comprehensive coverage across the entire country.
 *
 * HOW TO UPDATE:
 * - Add new cities to the appropriate country array
 * - Include major cities, towns, and areas with significant
 *   Muslim communities
 * - For sample mode, only the first few cities are used
 */

const LOCATIONS = {
  UK: {
    // Major cities and areas with significant Muslim communities
    major: [
      'London',
      'Birmingham',
      'Manchester',
      'Bradford',
      'Leeds',
      'Leicester',
      'Luton',
      'Blackburn',
      'Bolton',
      'Oldham',
      'Rochdale',
      'Dewsbury',
      'Glasgow',
      'Edinburgh',
      'Cardiff',
      'Bristol',
      'Liverpool',
      'Sheffield',
      'Nottingham',
      'Newcastle',
      'Coventry',
      'Derby',
      'Middlesbrough',
      'Peterborough',
      'Slough',
      'Reading',
      'Oxford',
      'Cambridge',
      'Milton Keynes',
      'Southampton',
      'Portsmouth',
      'Preston',
      'Burnley',
      'Huddersfield',
      'Wigan',
      'Wolverhampton',
      'Stoke-on-Trent',
      'Sunderland',
      'Norwich',
      'Ipswich',
      'Plymouth',
      'Exeter',
      'York',
      'Northampton',
      'Warrington',
      'Aberdeen',
      'Dundee',
      'Swansea',
      'Belfast',
    ],

    // London boroughs / areas with Muslim communities
    londonAreas: [
      'Tower Hamlets',
      'Newham',
      'Waltham Forest',
      'Redbridge',
      'Hackney',
      'Haringey',
      'Brent',
      'Ealing',
      'Hounslow',
      'Southwark',
      'Lambeth',
      'Lewisham',
      'Greenwich',
      'Croydon',
      'Barking and Dagenham',
      'Ilford',
      'East Ham',
      'Whitechapel',
      'Tooting',
      'Southall',
      'Walthamstow',
      'Stratford London',
      'Brixton',
      'Edgware Road London',
      'Green Street London',
    ],

    // Birmingham areas
    birminghamAreas: [
      'Sparkhill Birmingham',
      'Sparkbrook Birmingham',
      'Small Heath Birmingham',
      'Alum Rock Birmingham',
      'Washwood Heath Birmingham',
      'Bordesley Green Birmingham',
      'Aston Birmingham',
      'Handsworth Birmingham',
      'Lozells Birmingham',
      'Balsall Heath Birmingham',
    ],

    // Manchester areas
    manchesterAreas: [
      'Rusholme Manchester',
      'Cheetham Hill Manchester',
      'Longsight Manchester',
      'Levenshulme Manchester',
      'Moss Side Manchester',
      'Whalley Range Manchester',
      'Gorton Manchester',
      'Crumpsall Manchester',
    ],
  },

  FR: {
    // Major French cities
    major: [
      'Paris',
      'Marseille',
      'Lyon',
      'Toulouse',
      'Nice',
      'Nantes',
      'Strasbourg',
      'Montpellier',
      'Bordeaux',
      'Lille',
      'Rennes',
      'Reims',
      'Saint-Etienne',
      'Le Havre',
      'Toulon',
      'Grenoble',
      'Dijon',
      'Angers',
      'Nimes',
      'Clermont-Ferrand',
      'Le Mans',
      'Aix-en-Provence',
      'Brest',
      'Tours',
      'Amiens',
      'Limoges',
      'Perpignan',
      'Metz',
      'Besancon',
      'Orleans',
      'Rouen',
      'Mulhouse',
      'Caen',
      'Nancy',
      'Avignon',
      'Valence',
      'Pau',
      'La Rochelle',
      'Calais',
      'Dunkerque',
      'Tourcoing',
      'Roubaix',
    ],

    // Paris suburbs (Ile-de-France) with communities
    parisSuburbs: [
      'Saint-Denis',
      'Aubervilliers',
      'Montreuil',
      'Bobigny',
      'Bondy',
      'Sevran',
      'Sarcelles',
      'Argenteuil',
      'Creteil',
      'Vitry-sur-Seine',
      'Colombes',
      'Nanterre',
      'Clichy-sous-Bois',
      'Aulnay-sous-Bois',
      'Drancy',
      'Epinay-sur-Seine',
      'Stains',
      'Pierrefitte-sur-Seine',
      'Grigny',
      'Mantes-la-Jolie',
      'Trappes',
      'Les Mureaux',
      'Gennevilliers',
      'Villepinte',
    ],

    // Marseille areas
    marseilleAreas: [
      'Marseille 1er',
      'Marseille 2eme',
      'Marseille 3eme',
      'Marseille 13eme',
      'Marseille 14eme',
      'Marseille 15eme',
      'Marseille 16eme',
    ],

    // Lyon areas
    lyonAreas: [
      'Villeurbanne',
      'Venissieux',
      'Vaulx-en-Velin',
      'Rillieux-la-Pape',
      'Bron',
      'Saint-Fons',
      'Saint-Priest',
    ],
  },
};

/**
 * Get all locations for a given country.
 * Combines major cities and specific areas into one flat list.
 *
 * @param {string} country - Country code (UK, FR)
 * @param {boolean} [sampleOnly=false] - Return only first 3 cities
 * @returns {string[]} Array of location names
 */
export function getLocations(country, sampleOnly = false) {
  const countryData = LOCATIONS[country];
  if (!countryData) return [];

  // Combine all location arrays
  const allLocations = [];
  for (const [key, value] of Object.entries(countryData)) {
    if (Array.isArray(value)) {
      allLocations.push(...value);
    }
  }

  if (sampleOnly) {
    // For sample: just 1 major city to keep results to 10-15
    return allLocations.slice(0, 1);
  }

  return allLocations;
}

export default LOCATIONS;
