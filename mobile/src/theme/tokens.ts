/**
 * Talea design tokens for React Native.
 *
 * The palette is built from the brand mark: the logo's cyan → violet → magenta
 * sweep is the "magic" accent, Tavi's lamp gold marks rewards, and deep ink
 * carries the text. Light mode is a warm watercolour-paper page (it matches the
 * pre-generated Talea illustrations); dark mode is a midnight storybook.
 *
 * Surfaces are opaque on purpose: Android draws `elevation` shadows *through*
 * translucent fills, which showed up as grey boxes behind text. Depth comes from
 * `boxShadow` (New Architecture), which also allows coloured glows.
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

/** A soft radial glow painted behind page content. Sizes are in dp. */
export interface Glow {
  color: string;
  size: number;
  top: number;
  left: number;
}

/** 135deg in CSS == top-left to bottom-right. */
const DIAGONAL = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;
/** 180deg in CSS == top to bottom. */
const VERTICAL = { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } } as const;
/** 90deg in CSS == left to right. */
const HORIZONTAL = { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } } as const;

/** Brand constants shared by both modes. */
export const brand = {
  cyan: '#19B8F2',
  violet: '#7047EB',
  magenta: '#E84A9E',
  gold: '#F4AC32',
  goldLight: '#FFD36B',
  ink: '#1D1838',
  midnight: '#100C22',
  /** Text and icons placed on brand fills. */
  onBrand: '#FFFFFF',
} as const;

/**
 * One hue per base trait, so a trait reads the same everywhere (avatar profile,
 * growth sheet, cards). Ids match backend/constants/personalityTraits.ts.
 */
export const traitHues: Record<string, string> = {
  knowledge: '#2F8FEF',
  creativity: '#E04DA3',
  vocabulary: '#7B55F0',
  courage: '#F07A2E',
  curiosity: '#14AFAE',
  teamwork: '#22A866',
  empathy: '#EE5A7E',
  persistence: '#D9971A',
  logic: '#4E62E6',
};

export function traitHue(traitId: string): string {
  return traitHues[traitId.split('.')[0]] ?? brand.violet;
}

export interface ThemePalette {
  mode: ThemeMode;

  /** Flat page colour, used behind the gradient layer and for native chrome. */
  pageSolid: string;
  /** The page wash. Rendered by <PageBackground>. */
  pageGradient: Gradient;
  /** Soft radial glows layered over the page wash. */
  glows: readonly Glow[];

  surface: {
    /** Cards and sheets. */
    primary: string;
    /** Quiet translucent fill for chrome over imagery. */
    secondary: string;
    elevated: Gradient;
    /** Recessed fields: inputs, segmented tracks, list wells. */
    inset: string;
    /** Floating chrome (tab bar, reader bars). */
    panel: string;
    option: string;
    /** Selected / highlighted item tint. */
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
    /** Text on brand / accent fills — white in both modes. */
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
    /** Filled call-to-action. */
    action: Gradient;
    progress: Gradient;
    /** The full logo sweep: cyan → violet → magenta. */
    magic: Gradient;
    /** Rewards, levels, treasures. */
    gold: Gradient;
    /** Deep hero surfaces (home hero, generation, landing). */
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
  /** Soft tint of the primary colour for selected states. */
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
  /** Semi-transparent scrim behind modals and sheets. */
  scrim: string;
  /** Tint used by <BlurView>. */
  blurTint: 'light' | 'dark';

  chart: readonly [string, string, string, string, string];
}

const sharedGradients = {
  action: { colors: ['#8452F6', '#6A3FE6', '#C9449F'], locations: [0, 0.55, 1], ...DIAGONAL },
  magic: { colors: [brand.cyan, brand.violet, brand.magenta], locations: [0, 0.5, 1], ...DIAGONAL },
  gold: { colors: ['#FFD875', '#F4AC32'], ...DIAGONAL },
  night: { colors: ['#2A1C63', '#1A1340', '#3B1745'], locations: [0, 0.55, 1], ...DIAGONAL },
} as const satisfies Record<string, Gradient>;

export const lightPalette: ThemePalette = {
  mode: 'light',

  pageSolid: '#FBF7F1',
  pageGradient: {
    colors: ['#FFFBF6', '#FBF6EF', '#F7F0E8'],
    locations: [0, 0.5, 1],
    ...VERTICAL,
  },
  glows: [
    { color: 'rgba(140, 108, 255, 0.20)', size: 460, top: -200, left: -180 },
    { color: 'rgba(255, 168, 118, 0.20)', size: 420, top: -160, left: 170 },
    { color: 'rgba(84, 190, 255, 0.12)', size: 520, top: 430, left: -220 },
  ],

  surface: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.78)',
    elevated: { colors: ['#FFFFFF', '#FFFCF8'], ...VERTICAL },
    inset: '#F3EDE5',
    panel: 'rgba(255, 253, 250, 0.94)',
    option: '#FFFFFF',
    item: '#F3EEFF',
  },

  border: {
    light: 'rgba(43, 31, 72, 0.07)',
    soft: 'rgba(43, 31, 72, 0.11)',
    strong: 'rgba(43, 31, 72, 0.18)',
    accent: 'rgba(112, 71, 235, 0.55)',
  },

  text: {
    primary: '#1D1838',
    secondary: '#56506F',
    tertiary: '#8A849F',
    muted: '#B6B0C6',
    inverse: '#FFFFFF',
  },

  accent: {
    rose: '#EE5A7E',
    lavender: '#7B55F0',
    mint: '#18B489',
    sky: '#2F8FEF',
    peach: '#F07A2E',
    gold: '#E9A126',
  },

  gradient: {
    primary: { colors: ['#EEE6FF', '#FCE6F1', '#FFEFDD'], locations: [0, 0.5, 1], ...DIAGONAL },
    secondary: { colors: ['#E3F2FF', '#ECE6FF'], ...DIAGONAL },
    warm: { colors: ['#FFE9D6', '#FFE1EA'], ...DIAGONAL },
    cool: { colors: ['#E1F0FF', '#E8E4FF'], ...DIAGONAL },
    sunset: { colors: ['#FFE2D2', '#FBDDEE', '#E9E0FF'], locations: [0, 0.5, 1], ...DIAGONAL },
    ocean: { colors: ['#D9F4EF', '#DCEAFF'], ...DIAGONAL },
    lavender: { colors: ['#EBE4FF', '#F8E5F8'], ...DIAGONAL },
    nature: { colors: ['#DFF5E6', '#EAF4D8'], ...DIAGONAL },
    action: sharedGradients.action,
    progress: { colors: [brand.cyan, brand.violet, brand.magenta], locations: [0, 0.55, 1], ...HORIZONTAL },
    magic: sharedGradients.magic,
    gold: sharedGradients.gold,
    night: sharedGradients.night,
  },

  media: {
    skeleton: '#EEE7DE',
    shimmer: 'rgba(255, 255, 255, 0.65)',
    foreground: '#FFFFFF',
    overlay: ['rgba(18, 12, 38, 0)', 'rgba(18, 12, 38, 0.16)', 'rgba(18, 12, 38, 0.62)'],
    overlayStrong: ['rgba(14, 9, 30, 0)', 'rgba(14, 9, 30, 0.28)', 'rgba(14, 9, 30, 0.84)'],
    chromeBg: 'rgba(20, 14, 40, 0.42)',
    chromeBorder: 'rgba(255, 255, 255, 0.28)',
    controlBg: 'rgba(20, 14, 40, 0.36)',
    controlBorder: 'rgba(255, 255, 255, 0.26)',
  },

  primary: brand.violet,
  primaryForeground: brand.onBrand,
  primarySoft: '#EFE9FF',
  ring: brand.violet,

  danger: '#D8434A',
  dangerBorder: 'rgba(216, 67, 74, 0.32)',
  dangerSoft: '#FDECEC',
  success: '#12976D',
  successSoft: '#E3F6EE',
  warning: '#C97A06',
  warningSoft: '#FFF2DC',
  gold: '#E9A126',
  goldSoft: '#FFF3D9',

  progressTrack: 'rgba(43, 31, 72, 0.08)',
  scrim: 'rgba(22, 15, 44, 0.46)',
  blurTint: 'light',

  chart: [brand.violet, brand.cyan, brand.magenta, '#F4AC32', '#18B489'],
};

export const darkPalette: ThemePalette = {
  mode: 'dark',

  pageSolid: '#100C22',
  pageGradient: {
    colors: ['#171132', '#100C22', '#0B0819'],
    locations: [0, 0.5, 1],
    ...VERTICAL,
  },
  glows: [
    { color: 'rgba(118, 78, 255, 0.30)', size: 460, top: -210, left: -170 },
    { color: 'rgba(232, 74, 158, 0.16)', size: 400, top: -150, left: 190 },
    { color: 'rgba(25, 184, 242, 0.12)', size: 520, top: 440, left: -230 },
  ],

  surface: {
    primary: '#1A1534',
    secondary: 'rgba(26, 21, 52, 0.78)',
    elevated: { colors: ['#221B43', '#1A1534'], ...VERTICAL },
    inset: '#221C40',
    panel: 'rgba(23, 18, 46, 0.94)',
    option: '#1E1839',
    item: '#2A2156',
  },

  border: {
    light: 'rgba(255, 255, 255, 0.07)',
    soft: 'rgba(255, 255, 255, 0.11)',
    strong: 'rgba(255, 255, 255, 0.18)',
    accent: 'rgba(168, 140, 255, 0.62)',
  },

  text: {
    primary: '#F6F3FF',
    secondary: '#BFB8DC',
    tertiary: '#8F88B1',
    muted: '#615A86',
    inverse: '#FFFFFF',
  },

  accent: {
    rose: '#FF7FA0',
    lavender: '#A88DFF',
    mint: '#43D7AC',
    sky: '#5DB7FF',
    peach: '#FF9F66',
    gold: '#FFC75A',
  },

  gradient: {
    primary: { colors: ['#2B1F5E', '#38194D', '#3D2336'], locations: [0, 0.5, 1], ...DIAGONAL },
    secondary: { colors: ['#132E4C', '#271F57'], ...DIAGONAL },
    warm: { colors: ['#3E2430', '#3A1F42'], ...DIAGONAL },
    cool: { colors: ['#15294C', '#251F55'], ...DIAGONAL },
    sunset: { colors: ['#3F2234', '#33204F', '#1F2453'], locations: [0, 0.5, 1], ...DIAGONAL },
    ocean: { colors: ['#103638', '#132B4C'], ...DIAGONAL },
    lavender: { colors: ['#2A2156', '#3B1F4D'], ...DIAGONAL },
    nature: { colors: ['#123526', '#1C3424'], ...DIAGONAL },
    action: sharedGradients.action,
    progress: { colors: ['#3CC9FF', '#9573FF', '#FF62B1'], locations: [0, 0.55, 1], ...HORIZONTAL },
    magic: { colors: ['#3CC9FF', '#9573FF', '#FF62B1'], locations: [0, 0.5, 1], ...DIAGONAL },
    gold: sharedGradients.gold,
    night: { colors: ['#2C1E68', '#1B1442', '#40194A'], locations: [0, 0.55, 1], ...DIAGONAL },
  },

  media: {
    skeleton: '#221C40',
    shimmer: 'rgba(255, 255, 255, 0.07)',
    foreground: '#FFFFFF',
    overlay: ['rgba(8, 5, 20, 0)', 'rgba(8, 5, 20, 0.24)', 'rgba(8, 5, 20, 0.7)'],
    overlayStrong: ['rgba(6, 4, 16, 0)', 'rgba(6, 4, 16, 0.34)', 'rgba(6, 4, 16, 0.88)'],
    chromeBg: 'rgba(10, 7, 24, 0.5)',
    chromeBorder: 'rgba(255, 255, 255, 0.16)',
    controlBg: 'rgba(10, 7, 24, 0.46)',
    controlBorder: 'rgba(255, 255, 255, 0.16)',
  },

  primary: '#A88DFF',
  primaryForeground: brand.onBrand,
  primarySoft: '#2A2156',
  ring: '#A88DFF',

  danger: '#FF7B7F',
  dangerBorder: 'rgba(255, 123, 127, 0.4)',
  dangerSoft: '#3A1D2C',
  success: '#43D7AC',
  successSoft: '#13332E',
  warning: '#FFB54D',
  warningSoft: '#3A2B18',
  gold: '#FFC75A',
  goldSoft: '#3A2E17',

  progressTrack: 'rgba(255, 255, 255, 0.10)',
  scrim: 'rgba(4, 2, 12, 0.66)',
  blurTint: 'dark',

  chart: ['#A88DFF', '#3CC9FF', '#FF62B1', '#FFC75A', '#43D7AC'],
};

export type ShadowKey = 'none' | 'soft' | 'medium' | 'strong' | 'float' | 'glow';

/**
 * Elevation ramp as `boxShadow` (rendered natively on Android 9+ with the New
 * Architecture). Shadows are tinted with the ink hue rather than black, which
 * is what makes them read as soft light instead of grime.
 */
export const shadows: Record<ShadowKey, Shadow> = {
  none: { boxShadow: 'none' },
  soft: { boxShadow: '0px 2px 6px rgba(43, 28, 92, 0.05), 0px 8px 22px rgba(43, 28, 92, 0.07)' },
  medium: { boxShadow: '0px 3px 8px rgba(43, 28, 92, 0.06), 0px 14px 34px rgba(43, 28, 92, 0.11)' },
  strong: { boxShadow: '0px 6px 14px rgba(43, 28, 92, 0.08), 0px 22px 48px rgba(43, 28, 92, 0.16)' },
  float: { boxShadow: '0px 10px 24px rgba(43, 28, 92, 0.12), 0px 30px 64px rgba(43, 28, 92, 0.2)' },
  glow: { boxShadow: '0px 10px 28px rgba(112, 71, 235, 0.38)' },
};

/** Dark mode needs deeper shadows to read against the midnight page. */
export const darkShadows: Record<ShadowKey, Shadow> = {
  none: { boxShadow: 'none' },
  soft: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.28), 0px 10px 26px rgba(0, 0, 0, 0.3)' },
  medium: { boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.32), 0px 16px 38px rgba(0, 0, 0, 0.4)' },
  strong: { boxShadow: '0px 8px 18px rgba(0, 0, 0, 0.36), 0px 26px 54px rgba(0, 0, 0, 0.5)' },
  float: { boxShadow: '0px 12px 28px rgba(0, 0, 0, 0.4), 0px 34px 70px rgba(0, 0, 0, 0.55)' },
  glow: { boxShadow: '0px 10px 30px rgba(149, 115, 255, 0.45)' },
};

/** Coloured glow for an arbitrary hue (trait badges, category tiles). */
export function glowShadow(color: string, strength = 0.35, blur = 24, y = 10): Shadow {
  return { boxShadow: `0px ${y}px ${blur}px ${withAlpha(color, strength)}` };
}

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

/** Generous, soft corners — the storybook look relies on them. */
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

/** Durations in ms and the shared spring configurations. */
export const motion = {
  instant: 120,
  fast: 180,
  base: 260,
  slow: 420,
  page: 520,
  /** Pressables and small layout shifts. */
  spring: { damping: 22, stiffness: 340, mass: 0.8 },
  /** Sliding indicators and sheets. */
  springSoft: { damping: 24, stiffness: 210, mass: 0.9 },
  /** Celebrations, badges popping in. */
  springBouncy: { damping: 12, stiffness: 230, mass: 0.8 },
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
