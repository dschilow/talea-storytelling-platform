import { Platform, type TextStyle } from 'react-native';

/**
 * Typography scale.
 *
 * The web uses Fraunces (display serif) + Manrope (body sans) loaded from Google
 * Fonts. We bundle the same two families through @expo-google-fonts so the app
 * reads identically offline. `fontsReady` is false until they load; every text
 * style then falls back to the platform stack, which keeps first paint instant
 * instead of blocking on font loading.
 */

export const FONT_FAMILY = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  body: 'Manrope_500Medium',
  bodyRegular: 'Manrope_400Regular',
  bodySemibold: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  bodyExtraBold: 'Manrope_800ExtraBold',
} as const;

export type FontRole = keyof typeof FONT_FAMILY;

/** Platform serif/sans fallbacks used before the bundled fonts resolve. */
const FALLBACK = Platform.select({
  android: { display: 'serif', body: 'sans-serif' },
  ios: { display: 'Georgia', body: 'System' },
  default: { display: 'serif', body: 'System' },
})!;

let fontsReady = false;

export function setFontsReady(ready: boolean) {
  fontsReady = ready;
}

/**
 * Resolves a font role to an actual family name, falling back to the platform
 * stack while the bundled fonts are still loading (or if loading failed).
 */
export function fontFamily(role: FontRole): string {
  if (fontsReady) return FONT_FAMILY[role];
  return role.startsWith('display') ? FALLBACK.display : FALLBACK.body;
}

/**
 * Because `fontFamily()` is resolution-time, text styles are built as functions
 * rather than a frozen StyleSheet. Components read them through `useTypography()`
 * which re-evaluates once fonts finish loading.
 */
export interface TypeScale {
  displayXl: TextStyle;
  displayLg: TextStyle;
  displayMd: TextStyle;
  displaySm: TextStyle;
  headingLg: TextStyle;
  headingMd: TextStyle;
  headingSm: TextStyle;
  title: TextStyle;
  bodyLg: TextStyle;
  body: TextStyle;
  bodySm: TextStyle;
  label: TextStyle;
  labelSm: TextStyle;
  caption: TextStyle;
  overline: TextStyle;
  /** Reader body copy — larger line height for sustained reading. */
  reading: TextStyle;
  readingLg: TextStyle;
  /** Tabular numerals for counters and timers. */
  mono: TextStyle;
}

export function buildTypeScale(): TypeScale {
  const display = fontFamily('display');
  const displayBold = fontFamily('displayBold');
  const body = fontFamily('bodyRegular');
  const bodyMedium = fontFamily('body');
  const bodySemibold = fontFamily('bodySemibold');
  const bodyBold = fontFamily('bodyBold');

  return {
    displayXl: { fontFamily: displayBold, fontSize: 40, lineHeight: 46, letterSpacing: -0.6 },
    displayLg: { fontFamily: displayBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
    displayMd: { fontFamily: display, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
    displaySm: { fontFamily: display, fontSize: 23, lineHeight: 29, letterSpacing: -0.2 },

    headingLg: { fontFamily: bodyBold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
    headingMd: { fontFamily: bodyBold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
    headingSm: { fontFamily: bodySemibold, fontSize: 17, lineHeight: 23, letterSpacing: -0.1 },
    title: { fontFamily: bodySemibold, fontSize: 15.5, lineHeight: 21, letterSpacing: -0.1 },

    bodyLg: { fontFamily: body, fontSize: 16.5, lineHeight: 25 },
    body: { fontFamily: body, fontSize: 15, lineHeight: 22.5 },
    bodySm: { fontFamily: body, fontSize: 13.5, lineHeight: 20 },

    label: { fontFamily: bodySemibold, fontSize: 14, lineHeight: 19, letterSpacing: 0.1 },
    labelSm: { fontFamily: bodySemibold, fontSize: 12.5, lineHeight: 17, letterSpacing: 0.1 },
    caption: { fontFamily: bodyMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
    overline: {
      fontFamily: bodySemibold,
      fontSize: 10.5,
      lineHeight: 14,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },

    reading: { fontFamily: body, fontSize: 17, lineHeight: 29 },
    readingLg: { fontFamily: body, fontSize: 19, lineHeight: 32 },

    mono: {
      fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }),
      fontSize: 12.5,
      lineHeight: 17,
    },
  };
}
