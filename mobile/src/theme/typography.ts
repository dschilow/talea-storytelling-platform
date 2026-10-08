import { Platform, type TextStyle } from 'react-native';

/**
 * Typography.
 *
 * Three families, each with one job:
 *   - Fraunces  — the storybook voice: screen titles, story titles, big numbers.
 *   - Nunito    — the interface: rounded, friendly and very legible for children.
 *   - Literata  — sustained reading in the story and doku readers.
 *
 * All are bundled through @expo-google-fonts so the app reads identically
 * offline. Until they load, every role resolves to the platform stack so the
 * first frame is never blocked on font I/O.
 */

export const FONT_FAMILY = {
  display: 'Fraunces_700Bold',
  displaySemibold: 'Fraunces_600SemiBold',
  displayBlack: 'Fraunces_800ExtraBold',
  displayItalic: 'Fraunces_600SemiBold_Italic',
  body: 'Nunito_600SemiBold',
  bodyRegular: 'Nunito_500Medium',
  bodySemibold: 'Nunito_700Bold',
  bodyBold: 'Nunito_800ExtraBold',
  bodyExtraBold: 'Nunito_900Black',
  reading: 'Literata_400Regular',
  readingItalic: 'Literata_400Regular_Italic',
} as const;

export type FontRole = keyof typeof FONT_FAMILY;

/** Platform serif/sans fallbacks used before the bundled fonts resolve. */
const FALLBACK = Platform.select({
  android: { display: 'serif', body: 'sans-serif' },
  ios: { display: 'Georgia', body: 'System' },
  default: { display: 'serif', body: 'System' },
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
  return role.startsWith('display') || role.startsWith('reading') ? FALLBACK.display : FALLBACK.body;
}

export interface TypeScale {
  /** Hero headlines (landing, celebrations). */
  hero: TextStyle;
  displayXl: TextStyle;
  displayLg: TextStyle;
  displayMd: TextStyle;
  displaySm: TextStyle;
  /** Serif italic accent for single emphasised words. */
  displayItalic: TextStyle;
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
  /** Big tabular numbers: levels, scores, counters. */
  stat: TextStyle;
  /** Reader body copy — larger line height for sustained reading. */
  reading: TextStyle;
  readingLg: TextStyle;
  /** Tabular numerals for counters and timers. */
  mono: TextStyle;
}

export function buildTypeScale(): TypeScale {
  const display = fontFamily('display');
  const displaySemibold = fontFamily('displaySemibold');
  const displayBlack = fontFamily('displayBlack');
  const displayItalic = fontFamily('displayItalic');
  const body = fontFamily('bodyRegular');
  const bodyMedium = fontFamily('body');
  const bodySemibold = fontFamily('bodySemibold');
  const bodyBold = fontFamily('bodyBold');
  const reading = fontFamily('reading');

  return {
    hero: { fontFamily: displayBlack, fontSize: 40, lineHeight: 44, letterSpacing: -1.2 },
    displayXl: { fontFamily: displayBlack, fontSize: 34, lineHeight: 39, letterSpacing: -1 },
    displayLg: { fontFamily: display, fontSize: 30, lineHeight: 35, letterSpacing: -0.8 },
    displayMd: { fontFamily: display, fontSize: 25, lineHeight: 30, letterSpacing: -0.55 },
    displaySm: { fontFamily: display, fontSize: 21, lineHeight: 26, letterSpacing: -0.35 },
    displayItalic: { fontFamily: displayItalic, fontSize: 21, lineHeight: 26, letterSpacing: -0.3 },

    headingLg: { fontFamily: bodyBold, fontSize: 21, lineHeight: 27, letterSpacing: -0.3 },
    headingMd: { fontFamily: bodyBold, fontSize: 18.5, lineHeight: 24, letterSpacing: -0.2 },
    headingSm: { fontFamily: bodyBold, fontSize: 16.5, lineHeight: 22, letterSpacing: -0.1 },
    title: { fontFamily: bodyBold, fontSize: 15.5, lineHeight: 20.5, letterSpacing: -0.1 },

    bodyLg: { fontFamily: body, fontSize: 16.5, lineHeight: 25 },
    body: { fontFamily: body, fontSize: 15, lineHeight: 22.5 },
    bodySm: { fontFamily: body, fontSize: 13.5, lineHeight: 19.5 },

    label: { fontFamily: bodySemibold, fontSize: 14.5, lineHeight: 19 },
    labelSm: { fontFamily: bodySemibold, fontSize: 13, lineHeight: 17 },
    caption: { fontFamily: bodyMedium, fontSize: 12, lineHeight: 16 },
    overline: {
      fontFamily: bodyBold,
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    stat: { fontFamily: displaySemibold, fontSize: 24, lineHeight: 28, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },

    reading: { fontFamily: reading, fontSize: 18, lineHeight: 30.5 },
    readingLg: { fontFamily: reading, fontSize: 20, lineHeight: 33.5 },

    mono: {
      fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }),
      fontSize: 12.5,
      lineHeight: 17,
    },
  };
}
