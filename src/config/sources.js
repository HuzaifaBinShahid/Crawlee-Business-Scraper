/**
 * Data source configuration for each country.
 * Defines the base URLs and search endpoints for
 * Google Maps, Yell.co.uk, and PagesJaunes.fr.
 */

const SOURCES = {
  UK: {
    googleMaps: {
      baseUrl: 'https://www.google.com/maps',
      searchUrl: 'https://www.google.com/maps/search/',
    },
    yellowPages: {
      name: 'Yell',
      baseUrl: 'https://www.yell.com',
      searchUrl: 'https://www.yell.com/ucs/UcsSearchAction.do',
      // Yell search params: keywords, location, pageNum
    },
  },

  FR: {
    googleMaps: {
      baseUrl: 'https://www.google.com/maps',
      searchUrl: 'https://www.google.fr/maps/search/',
    },
    yellowPages: {
      name: 'PagesJaunes',
      baseUrl: 'https://www.pagesjaunes.fr',
      searchUrl: 'https://www.pagesjaunes.fr/annuaire/chercherlespros',
      // PagesJaunes search params: quoiqui, ou, page
    },
    societe: {
      name: 'Societe.com',
      baseUrl: 'https://www.societe.com',
      searchUrl: 'https://www.societe.com/cgi-bin/search',
      // Optional: used for chain vs independent verification
    },
  },

  // Future countries (Germany, Italy, Sweden, etc.)
  DE: {
    googleMaps: {
      baseUrl: 'https://www.google.com/maps',
      searchUrl: 'https://www.google.de/maps/search/',
    },
    yellowPages: {
      name: 'GelbeSeiten',
      baseUrl: 'https://www.gelbeseiten.de',
      searchUrl: 'https://www.gelbeseiten.de/Suche/',
    },
  },

  IT: {
    googleMaps: {
      baseUrl: 'https://www.google.com/maps',
      searchUrl: 'https://www.google.it/maps/search/',
    },
    yellowPages: {
      name: 'PagineGialle',
      baseUrl: 'https://www.paginegialle.it',
      searchUrl: 'https://www.paginegialle.it/ricerca/',
    },
  },
};

export default SOURCES;
