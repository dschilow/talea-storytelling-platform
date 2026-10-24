import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deDE } from '@clerk/localizations/de-DE';

type ClerkLocalization = typeof deDE;

// German is the main market: its texts ship with the bundle, so sign-in and
// checkout never flash English first. Clerk's own German wording is kept, except
// for the two checkout buttons: German law (§ 312j Abs. 3 BGB) wants the button
// that closes a paid contract to say plainly that it costs money.
const germanLocalization: ClerkLocalization = {
  ...deDE,
  billing: {
    ...deDE.billing,
    pay: 'Zahlungspflichtig abonnieren ({{amount}})',
    startFreeTrial: 'Kostenlos testen, danach zahlungspflichtig',
  },
};

const otherLocales: Record<string, () => Promise<ClerkLocalization | undefined>> = {
  // English is Clerk's built-in default.
  en: async () => undefined,
  fr: () => import('@clerk/localizations/fr-FR').then(module => module.frFR as ClerkLocalization),
  es: () => import('@clerk/localizations/es-ES').then(module => module.esES as ClerkLocalization),
  it: () => import('@clerk/localizations/it-IT').then(module => module.itIT as ClerkLocalization),
  nl: () => import('@clerk/localizations/nl-NL').then(module => module.nlNL as ClerkLocalization),
  ru: () => import('@clerk/localizations/ru-RU').then(module => module.ruRU as ClerkLocalization),
};

/** Clerk texts in the app language (German unless the family picked another). */
export function useClerkLocalization(): ClerkLocalization | undefined {
  const { i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || 'de').slice(0, 2);
  const [localization, setLocalization] = useState<ClerkLocalization | undefined>(germanLocalization);

  useEffect(() => {
    const load = otherLocales[language];
    if (!load) {
      setLocalization(germanLocalization);
      return;
    }
    let active = true;
    load().then(
      result => { if (active) setLocalization(result); },
      () => { if (active) setLocalization(germanLocalization); },
    );
    return () => { active = false; };
  }, [language]);

  return localization;
}
