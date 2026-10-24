// Operator details for Impressum, Datenschutz and AGB.
//
// Fill in every field marked "Pflicht". The legal links in the footers only
// appear once LEGAL_INFO_COMPLETE is true, so a half-finished Impressum never
// goes live. The texts in LegalPage.tsx are a carefully researched draft, not
// legal advice: have them checked (lawyer or a generator such as eRecht24 /
// IT-Recht Kanzlei) before the first paying customer.

export const LEGAL_OPERATOR = {
  /** Pflicht: full name, or company name with legal form (e.g. "Talea UG (haftungsbeschränkt)"). */
  name: '',
  /** Pflicht for companies: person(s) authorised to represent it. Leave empty for a sole trader. */
  representative: '',
  /** Pflicht: street and house number (no P.O. box). */
  street: '',
  /** Pflicht: postal code and city. */
  postalCodeCity: '',
  country: 'Deutschland',
  /** Pflicht: e-mail address that is read. */
  email: '',
  /** Pflicht: a second fast way to reach you, usually a phone number. */
  phone: '',
  /** Register court and number, if the business is registered (e.g. "Amtsgericht Köln, HRB 12345"). */
  register: '',
  /** VAT ID (§ 27a UStG), if you have one. */
  vatId: '',
  /** Person responsible for editorial content (§ 18 Abs. 2 MStV) with address; usually the operator. */
  responsibleForContent: '',
  /** Date shown under the privacy policy and terms. */
  lastUpdated: '24. Oktober 2026',
};

export const LEGAL_INFO_COMPLETE = Boolean(
  LEGAL_OPERATOR.name &&
  LEGAL_OPERATOR.street &&
  LEGAL_OPERATOR.postalCodeCity &&
  LEGAL_OPERATOR.email &&
  LEGAL_OPERATOR.phone,
);

export const LEGAL_PAGES = [
  { path: '/impressum', label: 'Impressum' },
  { path: '/datenschutz', label: 'Datenschutz' },
  { path: '/agb', label: 'AGB & Widerruf' },
] as const;

export const isLegalPath = (pathname: string) => LEGAL_PAGES.some(page => page.path === pathname);
