/**
 * Known chain/franchise names for each country.
 * Used to tag businesses as "Chain" or "Independent".
 *
 * The client's MAIN FOCUS is Independent businesses.
 * Chains are included but must be properly tagged.
 *
 * HOW TO UPDATE:
 * - Add new chain names (lowercase) to the appropriate
 *   country array.
 * - Names are matched case-insensitively against the
 *   business name.
 */

const CHAINS = {
  UK: [
    // Major supermarkets
    'tesco', 'sainsbury', 'sainsburys', "sainsbury's",
    'asda', 'morrisons', 'waitrose', 'marks and spencer',
    'm&s', 'aldi', 'lidl', 'iceland', 'farmfoods',
    'cooperative', 'co-op', 'coop', 'costcutter',
    'spar', 'nisa', 'budgens', 'londis', 'premier',
    'one stop', 'jack\'s', 'heron foods', 'b&m',
    'home bargains', 'poundland',

    // Convenience stores
    'mccolls', 'mccoll\'s', 'best-one', 'best one',

    // Car rental chains
    'enterprise', 'hertz', 'avis', 'europcar', 'sixt',
    'budget car rental', 'national car rental',
    'thrifty', 'alamo',

    // Mechanics chains
    'kwik fit', 'halfords', 'ats euromaster',
    'national tyres', 'formula one autocentres',
    'mr clutch',

    // Pharmacy / health chains
    'boots', 'superdrug', 'lloyds pharmacy',

    // Hotel chains
    'premier inn', 'travelodge', 'holiday inn',
    'hilton', 'marriott', 'ibis', 'novotel',
    'best western', 'radisson',

    // Gym chains
    'pure gym', 'puregym', 'the gym group',
    'david lloyd', 'nuffield health', 'virgin active',
    'anytime fitness', 'jd gyms', 'fitness first',
  ],

  FR: [
    // Major supermarkets
    'carrefour', 'leclerc', 'auchan', 'intermarche',
    'intermarché', 'super u', 'hyper u', 'casino',
    'monoprix', 'franprix', 'lidl', 'aldi',
    'leader price', 'netto', 'picard', 'biocoop',
    'naturalia', 'simply market', 'match', 'cora',
    'geant casino', 'géant casino', 'dia', 'ed',
    'colruyt', 'proxy', 'vival', 'spar', 'coccinelle',
    'g20', 'petit casino', 'sherpa', '8 a huit',
    'huit à huit', 'atac',

    // Car rental chains
    'enterprise', 'hertz', 'avis', 'europcar', 'sixt',
    'budget', 'national', 'ada', 'rent a car',

    // Mechanics chains
    'norauto', 'feu vert', 'midas', 'speedy',
    'euromaster', 'point s', 'roady',

    // Hotel chains
    'ibis', 'novotel', 'mercure', 'accor',
    'premiere classe', 'b&b hotel', 'campanile',
    'kyriad', 'holiday inn', 'hilton', 'marriott',
    'best western', 'radisson',

    // Gym chains
    'basic fit', 'basic-fit', 'fitness park',
    'neoness', 'keep cool', 'CMG sports club',
    'l\'appart fitness', 'magic form',
  ],

  // Future: Germany chains
  DE: [
    'aldi', 'lidl', 'edeka', 'rewe', 'penny',
    'netto', 'kaufland', 'real', 'norma', 'aldi süd',
    'aldi nord', 'rossmann', 'dm', 'müller',
    'tegut', 'globus', 'famila', 'combi', 'hit',
    'marktkauf', 'nahkauf', 'cap', 'sky', 'v-markt',
  ],

  // Future: Italy chains
  IT: [
    'esselunga', 'coop', 'conad', 'carrefour',
    'eurospin', 'lidl', 'aldi', 'pam', 'penny',
    'despar', 'md discount', 'todis', 'simply',
    'iper', 'bennet', 'tigre', 'sigma', 'unes',
    'famila', 'decò',
  ],
};

/**
 * Check if a business name matches a known chain.
 * @param {string} businessName - The name to check
 * @param {string} country - Country code (UK, FR, DE, IT)
 * @returns {boolean} True if the business is a known chain
 */
export function isChain(businessName, country) {
  if (!businessName || !CHAINS[country]) return false;

  const nameLower = businessName.toLowerCase().trim();
  return CHAINS[country].some((chain) => {
    const chainLower = chain.toLowerCase();
    return (
      nameLower.includes(chainLower) ||
      chainLower.includes(nameLower)
    );
  });
}

export default CHAINS;
