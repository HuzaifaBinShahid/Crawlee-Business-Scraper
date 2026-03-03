/**
 * Search keywords for each category, per country.
 *
 * These keywords are used to query Google Maps, Yell.co.uk,
 * and PagesJaunes.fr. They cover all the client-required
 * categories and target businesses serving the Muslim community.
 *
 * HOW TO UPDATE:
 * - Add new keywords to an existing category array
 * - Add a new category object with { name, keywords }
 * - Keywords should be localized for the target country
 */

const KEYWORDS = {
  UK: {
    categories: [
      {
        name: 'Halal Groceries & Butchers',
        keywords: [
          'halal grocery',
          'halal butcher',
          'halal meat shop',
          'halal food store',
          'halal supermarket',
          'asian grocery',
          'pakistani grocery',
          'indian grocery',
          'bangladeshi grocery',
          'arabic grocery',
          'middle eastern grocery',
          'african grocery',
          'turkish grocery',
          'polish halal shop',
          'international food store',
          'halal deli',
          'halal convenience store',
        ],
      },
      {
        name: 'Car Mechanics',
        keywords: [
          'car mechanic',
          'auto repair',
          'car repair',
          'car garage',
          'mot garage',
          'vehicle repair',
          'car service centre',
          'auto mechanic',
          'mobile mechanic',
          'car body repair',
          'tyre fitting',
          'car diagnostics',
          'car mechanic Khan',
          'garage Ahmed',
          'car repair Hussain',
        ],
      },
      {
        name: 'Car Rentals',
        keywords: [
          'car rental',
          'car hire',
          'vehicle rental',
          'van hire',
          'minibus hire',
        ],
      },
      {
        name: 'Repair Shops',
        keywords: [
          'phone repair',
          'mobile phone repair',
          'laptop repair',
          'computer repair',
          'electronics repair',
          'watch repair',
        ],
      },
      {
        name: 'Doctors',
        keywords: [
          'doctor',
          'general practitioner',
          'gp surgery',
          'medical practice',
          'family doctor',
          'health clinic',
          'muslim doctor',
          'doctor Khan',
          'GP Ahmed',
          'doctor Hussain',
          'doctor Rahman',
        ],
      },
      {
        name: 'Lawyers',
        keywords: [
          'lawyer',
          'solicitor',
          'immigration lawyer',
          'family lawyer',
          'legal services',
          'law firm',
          'islamic lawyer',
          'solicitor Khan',
          'lawyer Ahmed',
          'solicitor Hussain',
        ],
      },
      {
        name: 'Accountants',
        keywords: [
          'accountant',
          'tax advisor',
          'bookkeeper',
          'chartered accountant',
          'tax consultant',
          'accounting firm',
        ],
      },
      {
        name: 'Engineers',
        keywords: [
          'engineer',
          'civil engineer',
          'structural engineer',
          'electrical engineer',
          'mechanical engineer',
          'consulting engineer',
        ],
      },
      {
        name: 'Gold & Jewelry',
        keywords: [
          'gold shop',
          'jewellery shop',
          'jewelry store',
          'asian gold',
          'islamic jewellery',
          'gold dealer',
          'pawn shop gold',
        ],
      },
      {
        name: 'Islamic Fashion',
        keywords: [
          'islamic fashion',
          'hijab shop',
          'abaya shop',
          'modest fashion',
          'muslim clothing',
          'islamic clothing',
          'thobe shop',
          'jilbab store',
        ],
      },
      {
        name: 'Halal Gyms',
        keywords: [
          'halal gym',
          'women only gym',
          'ladies gym',
          'sisters gym',
          'muslim gym',
          'female only fitness',
        ],
      },
      {
        name: 'Mosques',
        keywords: [
          'mosque',
          'masjid',
          'islamic centre',
          'islamic center',
          'prayer hall',
          'jami mosque',
          'muslim prayer room',
        ],
      },
      {
        name: 'Islamic Schools',
        keywords: [
          'islamic school',
          'muslim school',
          'madrasah',
          'quran school',
          'islamic academy',
          'islamic college',
          'hifz school',
        ],
      },
      {
        name: 'Halal Hotels',
        keywords: [
          'halal hotel',
          'halal friendly hotel',
          'muslim friendly hotel',
          'halal accommodation',
          'halal bed and breakfast',
        ],
      },
      {
        name: 'Translation Services',
        keywords: [
          'translation office',
          'translation services',
          'arabic translation',
          'urdu translation',
          'interpreter services',
          'document translation',
        ],
      },
      {
        name: 'Shipping Services',
        keywords: [
          'shipping service',
          'cargo shipping',
          'parcel delivery',
          'international shipping',
          'money transfer',
          'remittance service',
          'hawala',
        ],
      },
      {
        name: 'Islamic Funeral Services',
        keywords: [
          'islamic funeral',
          'muslim funeral',
          'muslim burial',
          'islamic burial',
          'janazah service',
          'muslim cemetery',
          'funeral director muslim',
        ],
      },
    ],
  },

  FR: {
    categories: [
      {
        name: 'Halal Groceries & Butchers',
        keywords: [
          'boucherie halal',
          'epicerie halal',
          'supermarche halal',
          'alimentation halal',
          'magasin halal',
          'epicerie orientale',
          'epicerie arabe',
          'epicerie africaine',
          'epicerie turque',
          'epicerie pakistanaise',
          'epicerie indienne',
          'alimentaire halal',
          'boucherie musulmane',
        ],
      },
      {
        name: 'Car Mechanics',
        keywords: [
          'garage automobile',
          'mecanicien auto',
          'reparation voiture',
          'garage reparation',
          'carrosserie',
          'controle technique',
          'entretien automobile',
          'mecanique auto',
        ],
      },
      {
        name: 'Car Rentals',
        keywords: [
          'location voiture',
          'location vehicule',
          'location utilitaire',
          'location auto',
        ],
      },
      {
        name: 'Repair Shops',
        keywords: [
          'reparation telephone',
          'reparation mobile',
          'reparation ordinateur',
          'reparation electronique',
          'reparation informatique',
        ],
      },
      {
        name: 'Doctors',
        keywords: [
          'medecin generaliste',
          'cabinet medical',
          'docteur',
          'clinique medicale',
          'medecin',
          'centre de sante',
        ],
      },
      {
        name: 'Lawyers',
        keywords: [
          'avocat',
          'cabinet avocat',
          'avocat immigration',
          'avocat famille',
          'conseil juridique',
        ],
      },
      {
        name: 'Accountants',
        keywords: [
          'comptable',
          'expert comptable',
          'cabinet comptable',
          'fiscaliste',
        ],
      },
      {
        name: 'Engineers',
        keywords: [
          'ingenieur',
          'bureau etudes',
          'ingenieur conseil',
          'cabinet ingenieur',
        ],
      },
      {
        name: 'Gold & Jewelry',
        keywords: [
          'bijouterie',
          'bijouterie orientale',
          'or achat vente',
          'bijouterie arabe',
          'joaillerie',
        ],
      },
      {
        name: 'Islamic Fashion',
        keywords: [
          'mode islamique',
          'hijab boutique',
          'abaya boutique',
          'mode modeste',
          'vetement musulman',
          'vetement islamique',
          'boutique hijab',
        ],
      },
      {
        name: 'Halal Gyms',
        keywords: [
          'salle de sport femmes',
          'gym femmes',
          'salle sport musulmane',
          'fitness femmes',
        ],
      },
      {
        name: 'Mosques',
        keywords: [
          'mosquee',
          'masjid',
          'centre islamique',
          'salle de priere',
          'association islamique',
          'mosquee grande',
        ],
      },
      {
        name: 'Islamic Schools',
        keywords: [
          'ecole islamique',
          'ecole musulmane',
          'ecole coranique',
          'madrassa',
          'institut islamique',
        ],
      },
      {
        name: 'Halal Hotels',
        keywords: [
          'hotel halal',
          'hebergement halal',
          'hotel musulman',
        ],
      },
      {
        name: 'Translation Services',
        keywords: [
          'bureau traduction',
          'traduction arabe',
          'traduction assermentee',
          'interprete',
          'traduction documents',
        ],
      },
      {
        name: 'Shipping Services',
        keywords: [
          'service expedition',
          'envoi colis',
          'transfert argent',
          'cargo international',
          'fret international',
        ],
      },
      {
        name: 'Islamic Funeral Services',
        keywords: [
          'pompes funebres musulmanes',
          'funerailles islamiques',
          'rapatriement corps',
          'cimetiere musulman',
          'service funeraire islamique',
        ],
      },
    ],
  },
};

export default KEYWORDS;
