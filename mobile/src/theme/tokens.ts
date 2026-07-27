/**
 * Talea design tokens for React Native.
 *
 * These are a 1:1 port of the CSS custom properties in frontend/index.css so the
 * app and the web experience stay visually identical. Web-only constructs are
 * translated to their native equivalents:
 *   - CSS gradients   -> ordered colour stops consumed by <LinearGradient>
 *   - box-shadow      -> shadow* + elevation pairs (see `shadows`)
 *   - color-mix()     -> pre-resolved literals
 */

export type ThemeMode = 'light' | 'dark';

export type GradientStops = readonly [string, string, ...string[]];

export interface Gradient {
  colors: GradientStops;
  /** 0..1 unit-square start point, matching the CSS angle. */
  start: { x: number; y: number };
  end: { x: number; y: number };
  locations?: readonly number[];
}

export interface Shadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

/** 135deg in CSS == top-left to bottom-right. */
const DIAGONAL = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;
/** 180deg in CSS == top to bottom. */
const VERTICAL = { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } } as const;
/** 90deg in CSS == left to right. */
const HORIZONTAL = { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } } as const;

export interface ThemePalette {
  mode: ThemeMode;

  /** Flat page colour, used behind the gradient layer and for native chrome. */
  pageSolid: string;
  /** The multi-stop page wash. Rendered by <PageBackground>. */
  pageGradient: Gradient;
  /** Soft radial blooms layered over the page wash. */
  pageBlooms: readonly { color: string; size: number; top: number; left: number }[];

  surface: {
    primary: string;
    secondary: string;
    elevated: Gradient;
    inset: string;
    panel: string;
    option: string;
    item: string;
  };

  border: {
    light: string;
    soft: string;
    strong: string;
    accent: string;
  };

  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    muted: string;
    inverse: string;
  };

  accent: {
    rose: string;
    lavender: string;
    mint: string;
    sky: string;
    peach: string;
    gold: string;
  };

  gradient: {
    primary: Gradient;
    secondary: Gradient;
    warm: Gradient;
    cool: Gradient;
    sunset: Gradient;
    ocean: Gradient;
    lavender: Gradient;
    nature: Gradient;
    /** The filled-button / progress-bar gradient. */
    action: Gradient;
    progress: Gradient;
  };

  /** Overlay washes for imagery (card covers, reader chrome). */
  media: {
    skeleton: string;
    foreground: string;
    overlay: GradientStops;
    overlayStrong: GradientStops;
    chromeBg: string;
    chromeBorder: string;
    controlBg: string;
    controlBorder: string;
  };

  primary: string;
  primaryForeground: string;
  ring: string;

  danger: string;
  dangerBorder: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;

  progressTrack: string;
  /** Semi-transparent scrim behind modals and sheets. */
  scrim: string;
  /** Tint used by <BlurView>. */
  blurTint: 'light' | 'dark';

  chart: readonly [string, string, string, string, string];
}

export const lightPalette: ThemePalette = {
  mode: 'light',

  pageSolid: '#fbf5ef',
  pageGradient: {
    colors: ['#fffaf4', '#faf3eb', '#f6efe8'],
    locations: [0, 0.48, 1],
    ...VERTICAL,
  },
  pageBlooms: [
    { color: 'rgba(233, 194, 199, 0.42)', size: 560, top: -180, left: -160 },
    { color: 'rgba(173, 198, 231, 0.34)', size: 520, top: -140, left: 180 },
    { color: 'rgba(200, 226, 210, 0.42)', size: 620, top: 420, left: 120 },
  ],

  surface: {
    primary: 'rgba(255, 252, 248, 0.82)',
    secondary: 'rgba(255, 248, 242, 0.60)',
    elevated: {
      colors: ['rgba(255, 255, 255, 0.94)', 'rgba(254, 248, 242, 0.84)'],
      ...VERTICAL,
    },
    inset: 'rgba(250, 243, 236, 0.78)',
    panel: 'rgba(255, 251, 247, 0.86)',
    option: 'rgba(255, 249, 244, 0.84)',
    item: 'rgba(255, 255, 255, 0.80)',
  },

  border: {
    light: 'rgba(76, 60, 48, 0.08)',
    soft: 'rgba(76, 60, 48, 0.12)',
    strong: 'rgba(76, 60, 48, 0.18)',
    accent: 'rgba(123, 168, 156, 0.34)',
  },

  text: {
    primary: '#233248',
    secondary: '#5f7186',
    tertiary: '#8491a4',
    muted: '#a8b2bf',
    inverse: '#ffffff',
  },

  accent: {
    rose: '#dca5aa',
    lavender: '#b5b8dc',
    mint: '#7ba89c',
    sky: '#a4bedf',
    peach: '#e0af92',
    gold: '#d8bf8f',
  },

  gradient: {
    primary: { colors: ['#f5dfdf', '#e7efe8', '#e3ebf7'], locations: [0, 0.46, 1], ...DIAGONAL },
    secondary: { colors: ['#e4f0e8', '#e6eff8'], ...DIAGONAL },
    warm: { colors: ['#f7e5de', '#f5ede0'], ...DIAGONAL },
    cool: { colors: ['#e7edf9', '#edf3fa'], ...DIAGONAL },
    sunset: { colors: ['#f6e1dd', '#f3ebde', '#e6efe8'], locations: [0, 0.45, 1], ...DIAGONAL },
    ocean: { colors: ['#e5f1eb', '#e5eef9'], ...DIAGONAL },
    lavender: { colors: ['#ece8fb', '#e6edf9'], ...DIAGONAL },
    nature: { colors: ['#e8f1e7', '#e0f0ea'], ...DIAGONAL },
    action: { colors: ['#7ba89c', '#b6cde6'], ...DIAGONAL },
    progress: { colors: ['#7ba89c', '#a4bedf', '#e0af92'], locations: [0, 0.55, 1], ...HORIZONTAL },
  },

  media: {
    skeleton: '#ece7de',
    foreground: '#ffffff',
    overlay: ['rgba(10, 16, 24, 0)', 'rgba(10, 16, 24, 0.14)', 'rgba(10, 16, 24, 0.52)'],
    overlayStrong: ['rgba(8, 14, 22, 0)', 'rgba(8, 14, 22, 0.18)', 'rgba(8, 14, 22, 0.66)'],
    chromeBg: 'rgba(10, 16, 24, 0.34)',
    chromeBorder: 'rgba(255, 255, 255, 0.36)',
    controlBg: 'rgba(10, 16, 24, 0.30)',
    controlBorder: 'rgba(255, 255, 255, 0.34)',
  },

  primary: '#7ba89c',
  primaryForeground: '#ffffff',
  ring: '#7ba89c',

  danger: '#b35b5b',
  dangerBorder: '#d8a3a3',
  dangerSoft: 'rgba(205, 123, 123, 0.14)',
  success: '#6f9c8f',
  successSoft: 'rgba(123, 168, 156, 0.18)',
  warning: '#b98552',
  warningSoft: 'rgba(198, 148, 92, 0.18)',

  progressTrack: 'rgba(147, 155, 168, 0.25)',
  scrim: 'rgba(28, 24, 20, 0.42)',
  blurTint: 'light',

  chart: ['#7ba89c', '#e0af92', '#a4bedf', '#d8bf8f', '#dca5aa'],
};

export const darkPalette: ThemePalette = {
  mode: 'dark',

  pageSolid: '#101722',
  pageGradient: {
    colors: ['#101722', '#0d141d', '#0b1119'],
    locations: [0, 0.5, 1],
    ...VERTICAL,
  },
  pageBlooms: [
    { color: 'rgba(177, 131, 196, 0.14)', size: 560, top: -180, left: -160 },
    { color: 'rgba(122, 170, 156, 0.16)', size: 520, top: -140, left: 180 },
    { color: 'rgba(164, 190, 223, 0.14)', size: 620, top: 420, left: 120 },
  ],

  surface: {
    primary: 'rgba(19, 27, 37, 0.78)',
    secondary: 'rgba(19, 27, 37, 0.56)',
    elevated: {
      colors: ['rgba(26, 36, 48, 0.95)', 'rgba(17, 24, 33, 0.86)'],
      ...VERTICAL,
    },
    inset: 'rgba(24, 32, 44, 0.74)',
    panel: 'rgba(19, 27, 37, 0.84)',
    option: 'rgba(24, 32, 44, 0.82)',
    item: 'rgba(25, 34, 46, 0.84)',
  },

  border: {
    light: 'rgba(255, 255, 255, 0.07)',
    soft: 'rgba(255, 255, 255, 0.10)',
    strong: 'rgba(255, 255, 255, 0.14)',
    accent: 'rgba(154, 199, 182, 0.26)',
  },

  text: {
    primary: '#eef3fb',
    secondary: '#a9b7ca',
    tertiary: '#7f8ea2',
    muted: '#58667a',
    inverse: '#0f1723',
  },

  accent: {
    rose: '#e5b0b7',
    lavender: '#b7bae0',
    mint: '#9ac7b6',
    sky: '#b0c8e7',
    peach: '#e7bc9f',
    gold: '#e0cb9d',
  },

  gradient: {
    primary: {
      colors: ['rgba(229, 176, 183, 0.14)', 'rgba(154, 199, 182, 0.18)', 'rgba(176, 200, 231, 0.16)'],
      locations: [0, 0.46, 1],
      ...DIAGONAL,
    },
    secondary: { colors: ['rgba(154, 199, 182, 0.16)', 'rgba(176, 200, 231, 0.16)'], ...DIAGONAL },
    warm: { colors: ['rgba(231, 188, 159, 0.16)', 'rgba(224, 203, 157, 0.14)'], ...DIAGONAL },
    cool: { colors: ['rgba(176, 200, 231, 0.16)', 'rgba(183, 186, 224, 0.14)'], ...DIAGONAL },
    sunset: {
      colors: ['rgba(229, 176, 183, 0.16)', 'rgba(224, 203, 157, 0.14)', 'rgba(154, 199, 182, 0.14)'],
      locations: [0, 0.45, 1],
      ...DIAGONAL,
    },
    ocean: { colors: ['rgba(154, 199, 182, 0.16)', 'rgba(176, 200, 231, 0.16)'], ...DIAGONAL },
    lavender: { colors: ['rgba(183, 186, 224, 0.18)', 'rgba(176, 200, 231, 0.14)'], ...DIAGONAL },
    nature: { colors: ['rgba(154, 199, 182, 0.18)', 'rgba(122, 170, 156, 0.14)'], ...DIAGONAL },
    action: { colors: ['#9ac7b6', '#7fa7cd'], ...DIAGONAL },
    progress: { colors: ['#9ac7b6', '#b0c8e7', '#e7bc9f'], locations: [0, 0.55, 1], ...HORIZONTAL },
  },

  media: {
    skeleton: '#1b2431',
    foreground: '#ffffff',
    overlay: ['rgba(4, 8, 14, 0)', 'rgba(4, 8, 14, 0.24)', 'rgba(4, 8, 14, 0.66)'],
    overlayStrong: ['rgba(3, 6, 11, 0)', 'rgba(3, 6, 11, 0.3)', 'rgba(3, 6, 11, 0.78)'],
    chromeBg: 'rgba(6, 11, 18, 0.5)',
    chromeBorder: 'rgba(255, 255, 255, 0.18)',
    controlBg: 'rgba(6, 11, 18, 0.46)',
    controlBorder: 'rgba(255, 255, 255, 0.16)',
  },

  primary: '#9ac7b6',
  primaryForeground: '#0f1723',
  ring: '#9ac7b6',

  danger: '#e08c8c',
  dangerBorder: 'rgba(224, 140, 140, 0.4)',
  dangerSoft: 'rgba(224, 140, 140, 0.16)',
  success: '#9ac7b6',
  successSoft: 'rgba(154, 199, 182, 0.18)',
  warning: '#dcb078',
  warningSoft: 'rgba(220, 176, 120, 0.16)',

  progressTrack: 'rgba(255, 255, 255, 0.12)',
  scrim: 'rgba(4, 8, 14, 0.62)',
  blurTint: 'dark',

  chart: ['#9ac7b6', '#e7bc9f', '#b0c8e7', '#e0cb9d', '#e5b0b7'],
};

/**
 * Elevation ramp. `shadow*` drives iOS, `elevation` drives Android — Android
 * ignores radius/offset, so the elevation values are tuned independently to
 * visually match rather than to be numerically derived.
 */
export const shadows: Record<'none' | 'soft' | 'medium' | 'strong' | 'float', Shadow> = {
  none: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  soft: { shadowColor: '#4e3c30', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 2 },
  medium: { shadowColor: '#4e3c30', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 5 },
  strong: { shadowColor: '#4e3c30', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.15, shadowRadius: 36, elevation: 9 },
  float: { shadowColor: '#4e3c30', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.18, shadowRadius: 44, elevation: 14 },
};

/** Dark mode needs a black shadow colour to read at all. */
export const darkShadows: typeof shadows = Object.fromEntries(
  Object.entries(shadows).map(([key, value]) => [
    key,
    { ...value, shadowColor: '#000000', shadowOpacity: value.shadowOpacity === 0 ? 0 : value.shadowOpacity * 2.4 },
  ])
) as typeof shadows;

/** 4pt base scale — matches the web's Tailwind spacing rhythm. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;

/** --radius: 1.25rem == 20px, with a family of derived corners. */
export const radius = {
  none: 0,
  xs: 8,
  sm: 12,
  md: 16,
  base: 20,
  lg: 24,
  xl: 28,
  xxl: 34,
  pill: 999,
} as const;

/** Durations in ms, mirroring the web's framer-motion timings. */
export const motion = {
  instant: 120,
  fast: 180,
  base: 240,
  slow: 360,
  page: 420,
  /** Spring config shared by pressables and layout transitions. */
  spring: { damping: 28, stiffness: 320, mass: 0.9 },
  springBouncy: { damping: 16, stiffness: 260, mass: 0.9 },
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  header: 40,
  bottomNav: 70,
  sheet: 80,
  modal: 90,
  toast: 100,
} as const;
