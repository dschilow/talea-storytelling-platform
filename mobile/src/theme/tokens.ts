/**
 * Talea design tokens for React Native.
 *
 * The visual language follows Apple's current platform design (iOS 26):
 * neutral system backgrounds, borderless content cards, one clear accent, and
 * translucent "glass" for chrome that floats over content (tab bar, toolbar
 * buttons, sheets, banners). Colour comes from the content — story covers and
 * avatar portraits — not from the interface.
 *
 * Values mirror the iOS system palette (systemGroupedBackground, label,
 * secondaryLabel, separator, the system fills and colours) so the app reads as
 * native-quality rather than themed.
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

/** A `boxShadow` style fragment; spread it into a style array. */
export interface Shadow {
  boxShadow: string;
}

const DIAGONAL = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;
const VERTICAL = { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } } as const;

/** Constant brand values shared by both modes. */
export const brand = {
  /** Text and icons placed on accent fills. */
  onBrand: '#FFFFFF',
} as const;

/** iOS system colours (light / dark). */
export const system = {
  light: {
    blue: '#007AFF',
    green: '#34C759',
    indigo: '#5856D6',
    orange: '#FF9500',
    pink: '#FF2D55',
    red: '#FF3B30',
    teal: '#30B0C7',
    cyan: '#32ADE6',
    mint: '#00C7BE',
    yellow: '#FFCC00',
    brown: '#A2845E',
    gray: '#8E8E93',
  },
  dark: {
    blue: '#0A84FF',
    green: '#30D158',
    indigo: '#5E5CE6',
    orange: '#FF9F0A',
    pink: '#FF375F',
    red: '#FF453A',
    teal: '#40C8E0',
    cyan: '#64D2FF',
    mint: '#63E6E2',
    yellow: '#FFD60A',
    brown: '#AC8E68',
    gray: '#8E8E93',
  },
} as const;

/**
 * One system colour per base trait, so a trait reads the same everywhere
 * (avatar profile, growth sheet, cards). Ids match
 * backend/constants/personalityTraits.ts.
 */
export const traitHues: Record<string, string> = {
  knowledge: system.light.blue,
  creativity: system.light.pink,
  vocabulary: system.light.mint,
  courage: system.light.orange,
  curiosity: system.light.teal,
  teamwork: system.light.green,
  empathy: system.light.red,
  persistence: system.light.brown,
  logic: system.light.indigo,
};

export function traitHue(traitId: string): string {
  return traitHues[traitId.split('.')[0]] ?? system.light.blue;
}

export interface ThemePalette {
  mode: ThemeMode;

  /** The page (systemGroupedBackground). */
  pageSolid: string;

  surface: {
    /** Cards, grouped list cells, sheets. */
    primary: string;
    /** Glass tint over imagery. */
    secondary: string;
    elevated: Gradient;
    /** Fills: search fields, segmented tracks, neutral capsules. */
    inset: string;
    /** Glass tint for floating chrome (tab bar, toolbars). */
    panel: string;
    option: string;
    /** Selected row tint. */
    item: string;
  };

  border: {
    /** Hairline separators. */
    light: string;
    soft: string;
    strong: string;
    accent: string;
    /** The bright rim on glass. */
    glass: string;
  };

  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    muted: string;
    /** Text on accent fills — white in both modes. */
    inverse: string;
  };

  /** The system colour set for the current mode. */
  system: Record<keyof (typeof system)['light'], string>;

  accent: {
    rose: string;
    lavender: string;
    mint: string;
    sky: string;
    peach: string;
    gold: string;
  };

  /** Soft colour washes, used only behind illustrations and empty covers. */
  gradient: {
    primary: Gradient;
    secondary: Gradient;
    warm: Gradient;
    cool: Gradient;
    sunset: Gradient;
    ocean: Gradient;
    lavender: Gradient;
    nature: Gradient;
    action: Gradient;
    progress: Gradient;
    magic: Gradient;
    gold: Gradient;
    night: Gradient;
  };

  /** Overlay washes for imagery (card covers, reader chrome). */
  media: {
    skeleton: string;
    shimmer: string;
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
  /** Tinted fill of the accent, for secondary buttons and selections. */
  primarySoft: string;
  ring: string;

  danger: string;
  dangerBorder: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  gold: string;
  goldSoft: string;

  progressTrack: string;
  scrim: string;
  blurTint: 'light' | 'dark';

  chart: readonly [string, string, string, string, string];
}

const solid = (color: string): Gradient => ({ colors: [color, color], ...VERTICAL });
const wash = (from: string, to: string): Gradient => ({ colors: [from, to], ...DIAGONAL });

export const lightPalette: ThemePalette = {
  mode: 'light',
  pageSolid: '#F2F2F7',

  surface: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.72)',
    elevated: solid('#FFFFFF'),
    inset: 'rgba(118, 118, 128, 0.12)',
    panel: 'rgba(250, 250, 252, 0.72)',
    option: '#FFFFFF',
    item: 'rgba(0, 122, 255, 0.08)',
  },

  border: {
    light: 'rgba(60, 60, 67, 0.12)',
    soft: 'rgba(60, 60, 67, 0.2)',
    strong: 'rgba(60, 60, 67, 0.3)',
    accent: 'rgba(0, 122, 255, 0.55)',
    glass: 'rgba(255, 255, 255, 0.85)',
  },

  text: {
    primary: '#000000',
    secondary: 'rgba(60, 60, 67, 0.62)',
    tertiary: 'rgba(60, 60, 67, 0.48)',
    muted: 'rgba(60, 60, 67, 0.3)',
    inverse: '#FFFFFF',
  },

  system: system.light,

  accent: {
    rose: system.light.pink,
    lavender: system.light.indigo,
    mint: system.light.mint,
    sky: system.light.cyan,
    peach: system.light.orange,
    gold: system.light.yellow,
  },

  gradient: {
    primary: wash('#EAF2FF', '#F4F0FF'),
    secondary: wash('#E8F4FF', '#EEF6F4'),
    warm: wash('#FFF1E3', '#FFE8EA'),
    cool: wash('#E8F1FF', '#ECEFFF'),
    sunset: wash('#FFEDE2', '#FCE8F0'),
    ocean: wash('#E3F6F5', '#E6F0FF'),
    lavender: wash('#EFEFFF', '#F7EEFA'),
    nature: wash('#E7F7EA', '#F0F6E2'),
    action: solid(system.light.blue),
    progress: solid(system.light.blue),
    magic: solid(system.light.blue),
    gold: solid(system.light.yellow),
    night: solid('#1C1C1E'),
  },

  media: {
    skeleton: '#E5E5EA',
    shimmer: 'rgba(255, 255, 255, 0.55)',
    foreground: '#FFFFFF',
    overlay: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.12)', 'rgba(0, 0, 0, 0.55)'],
    overlayStrong: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.25)', 'rgba(0, 0, 0, 0.78)'],
    chromeBg: 'rgba(30, 30, 30, 0.38)',
    chromeBorder: 'rgba(255, 255, 255, 0.3)',
    controlBg: 'rgba(30, 30, 30, 0.32)',
    controlBorder: 'rgba(255, 255, 255, 0.28)',
  },

  primary: system.light.blue,
  primaryForeground: brand.onBrand,
  primarySoft: 'rgba(0, 122, 255, 0.12)',
  ring: system.light.blue,

  danger: system.light.red,
  dangerBorder: 'rgba(255, 59, 48, 0.4)',
  dangerSoft: 'rgba(255, 59, 48, 0.12)',
  success: '#248A3D',
  successSoft: 'rgba(52, 199, 89, 0.15)',
  warning: '#C93400',
  warningSoft: 'rgba(255, 149, 0, 0.15)',
  gold: system.light.orange,
  goldSoft: 'rgba(255, 204, 0, 0.2)',

  progressTrack: 'rgba(120, 120, 128, 0.16)',
  scrim: 'rgba(0, 0, 0, 0.32)',
  blurTint: 'light',

  chart: [system.light.blue, system.light.orange, system.light.green, system.light.pink, system.light.teal],
};

export const darkPalette: ThemePalette = {
  mode: 'dark',
  pageSolid: '#000000',

  surface: {
    primary: '#1C1C1E',
    secondary: 'rgba(28, 28, 30, 0.72)',
    elevated: solid('#2C2C2E'),
    inset: 'rgba(118, 118, 128, 0.24)',
    panel: 'rgba(28, 28, 30, 0.68)',
    option: '#2C2C2E',
    item: 'rgba(10, 132, 255, 0.18)',
  },

  border: {
    light: 'rgba(84, 84, 88, 0.45)',
    soft: 'rgba(84, 84, 88, 0.65)',
    strong: 'rgba(84, 84, 88, 0.85)',
    accent: 'rgba(10, 132, 255, 0.6)',
    glass: 'rgba(255, 255, 255, 0.16)',
  },

  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(235, 235, 245, 0.62)',
    tertiary: 'rgba(235, 235, 245, 0.46)',
    muted: 'rgba(235, 235, 245, 0.3)',
    inverse: '#FFFFFF',
  },

  system: system.dark,

  accent: {
    rose: system.dark.pink,
    lavender: system.dark.indigo,
    mint: system.dark.mint,
    sky: system.dark.cyan,
    peach: system.dark.orange,
    gold: system.dark.yellow,
  },

  gradient: {
    primary: wash('#1A2433', '#221E2E'),
    secondary: wash('#16263A', '#16282A'),
    warm: wash('#2E2318', '#2E1C20'),
    cool: wash('#182233', '#1E1E33'),
    sunset: wash('#2E2018', '#2C1A24'),
    ocean: wash('#132A2A', '#152236'),
    lavender: wash('#1F1F33', '#2A1E2E'),
    nature: wash('#16291A', '#22281A'),
    action: solid(system.dark.blue),
    progress: solid(system.dark.blue),
    magic: solid(system.dark.blue),
    gold: solid(system.dark.yellow),
    night: solid('#1C1C1E'),
  },

  media: {
    skeleton: '#2C2C2E',
    shimmer: 'rgba(255, 255, 255, 0.06)',
    foreground: '#FFFFFF',
    overlay: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0.65)'],
    overlayStrong: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.32)', 'rgba(0, 0, 0, 0.85)'],
    chromeBg: 'rgba(30, 30, 30, 0.5)',
    chromeBorder: 'rgba(255, 255, 255, 0.18)',
    controlBg: 'rgba(30, 30, 30, 0.46)',
    controlBorder: 'rgba(255, 255, 255, 0.16)',
  },

  primary: system.dark.blue,
  primaryForeground: brand.onBrand,
  primarySoft: 'rgba(10, 132, 255, 0.2)',
  ring: system.dark.blue,

  danger: system.dark.red,
  dangerBorder: 'rgba(255, 69, 58, 0.45)',
  dangerSoft: 'rgba(255, 69, 58, 0.18)',
  success: system.dark.green,
  successSoft: 'rgba(48, 209, 88, 0.18)',
  warning: system.dark.orange,
  warningSoft: 'rgba(255, 159, 10, 0.18)',
  gold: system.dark.orange,
  goldSoft: 'rgba(255, 214, 10, 0.18)',

  progressTrack: 'rgba(120, 120, 128, 0.32)',
  scrim: 'rgba(0, 0, 0, 0.55)',
  blurTint: 'dark',

  chart: [system.dark.blue, system.dark.orange, system.dark.green, system.dark.pink, system.dark.teal],
};

export type ShadowKey = 'none' | 'soft' | 'medium' | 'strong' | 'float' | 'glow';

/**
 * Elevation as `boxShadow`. Grouped content sits flat on the page (iOS cards
 * have no shadow); only floating chrome and imagery get depth.
 */
export const shadows: Record<ShadowKey, Shadow> = {
  none: { boxShadow: 'none' },
  soft: { boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.04), 0px 6px 16px rgba(0, 0, 0, 0.05)' },
  medium: { boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.06), 0px 12px 28px rgba(0, 0, 0, 0.1)' },
  strong: { boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.08), 0px 18px 40px rgba(0, 0, 0, 0.14)' },
  float: { boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.08), 0px 20px 44px rgba(0, 0, 0, 0.12)' },
  glow: { boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.06), 0px 10px 24px rgba(0, 0, 0, 0.1)' },
};

export const darkShadows: Record<ShadowKey, Shadow> = {
  none: { boxShadow: 'none' },
  soft: { boxShadow: 'none' },
  medium: { boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.45)' },
  strong: { boxShadow: '0px 12px 32px rgba(0, 0, 0, 0.55)' },
  float: { boxShadow: '0px 12px 36px rgba(0, 0, 0, 0.6)' },
  glow: { boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.5)' },
};

/** Applies an alpha to a #RRGGBB colour. Other formats are returned unchanged. */
export function withAlpha(color: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 4pt base scale. */
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

/** Continuous, generous corners in the iOS 26 manner. */
export const radius = {
  none: 0,
  xs: 8,
  sm: 12,
  md: 16,
  base: 20,
  lg: 22,
  xl: 26,
  xxl: 34,
  pill: 999,
} as const;

/** Durations in ms and the shared spring configurations. */
export const motion = {
  instant: 120,
  fast: 180,
  base: 260,
  slow: 420,
  page: 520,
  spring: { damping: 24, stiffness: 360, mass: 0.8 },
  springSoft: { damping: 26, stiffness: 240, mass: 0.9 },
  springBouncy: { damping: 15, stiffness: 240, mass: 0.8 },
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
