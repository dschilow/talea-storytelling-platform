import { Platform, type TextStyle } from 'react-native';

/**
 * Typography.
 *
 * Follows the iOS text styles (Large Title 34, Title 1 28, Title 2 22,
 * Title 3 20, Headline 17, Subheadline 15, Footnote 13, Caption 12) with Inter,
 * the closest freely licensed match to SF Pro (SF may not ship on Android).
 * Large sizes get the tighter tracking SF Display uses. Literata is reserved
 * for long-form reading, the way Books uses a serif for book text.
 *
 * Fonts are bundled through @expo-google-fonts so the app reads identically
 * offline; until they load every role falls back to the platform stack.
 */

export const FONT_FAMILY = {
  display: 'Inter_700Bold',
  displaySemibold: 'Inter_600SemiBold',
  displayBlack: 'Inter_700Bold',
  displayItalic: 'Literata_400Regular_Italic',
  body: 'Inter_500Medium',
  bodyRegular: 'Inter_400Regular',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  bodyExtraBold: 'Inter_700Bold',
  reading: 'Literata_400Regular',
  readingItalic: 'Literata_400Regular_Italic',
} as const;

export type FontRole = keyof typeof FONT_FAMILY;

/** Platform fallbacks used before the bundled fonts resolve. */
const FALLBACK = Platform.select({
  android: { serif: 'serif', sans: 'sans-serif' },
  ios: { serif: 'Georgia', sans: 'System' },
  default: { serif: 'serif', sans: 'System' },
})!;

let fontsReady = false;

/**
 * Must be called before the theme is built (ThemeProvider does it during
 * render) — an effect would run after the first theme was already computed
 * with fallback families, and nothing would re-resolve it.
 */
export function setFontsReady(ready: boolean) {
  fontsReady = ready;
}

export function areFontsReady(): boolean {
  return fontsReady;
}

/** Resolves a font role, falling back to the platform stack while loading. */
export function fontFamily(role: FontRole): string {
  if (fontsReady) return FONT_FAMILY[role];
  return role.startsWith('reading') || role === 'displayItalic' ? FALLBACK.serif : FALLBACK.sans;
}

export interface TypeScale {
  /** Onboarding / welcome headlines. */
  hero: TextStyle;
  /** iOS Large Title. */
  displayXl: TextStyle;
  /** iOS Title 1. */
  displayLg: TextStyle;
  /** iOS Title 2. */
  displayMd: TextStyle;
  /** iOS Title 3. */
  displaySm: TextStyle;
  /** Serif italic for quotes. */
  displayItalic: TextStyle;
  headingLg: TextStyle;
  headingMd: TextStyle;
  headingSm: TextStyle;
  /** iOS Headline. */
  title: TextStyle;
  bodyLg: TextStyle;
  body: TextStyle;
  /** iOS Subheadline. */
  bodySm: TextStyle;
  label: TextStyle;
  /** iOS Footnote, semibold. */
  labelSm: TextStyle;
  caption: TextStyle;
  /** Small uppercase section label (App Store "Today" style). */
  overline: TextStyle;
  /** Numbers in stat tiles. */
  stat: TextStyle;
  /** Reader body copy. */
  reading: TextStyle;
  readingLg: TextStyle;
  mono: TextStyle;
}

export function buildTypeScale(): TypeScale {
  const bold = fontFamily('display');
  const semibold = fontFamily('bodySemibold');
  const medium = fontFamily('body');
  const regular = fontFamily('bodyRegular');
  const serif = fontFamily('reading');
  const serifItalic = fontFamily('readingItalic');

  return {
    hero: { fontFamily: bold, fontSize: 36, lineHeight: 42, letterSpacing: -1 },
    displayXl: { fontFamily: bold, fontSize: 34, lineHeight: 41, letterSpacing: -0.9 },
    displayLg: { fontFamily: bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
    displayMd: { fontFamily: bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.45 },
    displaySm: { fontFamily: semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.4 },
    displayItalic: { fontFamily: serifItalic, fontSize: 18, lineHeight: 26 },

    headingLg: { fontFamily: bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.45 },
    headingMd: { fontFamily: semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.4 },
    headingSm: { fontFamily: semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.35 },
    title: { fontFamily: semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.35 },

    bodyLg: { fontFamily: regular, fontSize: 17, lineHeight: 23, letterSpacing: -0.3 },
    body: { fontFamily: regular, fontSize: 16, lineHeight: 22, letterSpacing: -0.25 },
    bodySm: { fontFamily: regular, fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },

    label: { fontFamily: semibold, fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },
    labelSm: { fontFamily: semibold, fontSize: 13, lineHeight: 18, letterSpacing: -0.08 },
    caption: { fontFamily: medium, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
    overline: {
      fontFamily: semibold,
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0.1,
      textTransform: 'uppercase',
    },
    stat: { fontFamily: bold, fontSize: 26, lineHeight: 31, letterSpacing: -0.6, fontVariant: ['tabular-nums'] },

    reading: { fontFamily: serif, fontSize: 19, lineHeight: 30 },
    readingLg: { fontFamily: serif, fontSize: 21, lineHeight: 33 },

    mono: {
      fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }),
      fontSize: 12.5,
      lineHeight: 17,
    },
  };
}
