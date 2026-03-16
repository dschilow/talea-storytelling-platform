type TokenGroup<T extends Record<string, string>> = T & string;

function tokenGroup<T extends Record<string, string>>(value: string, scale: T): TokenGroup<T> {
  const primitive = new String(value) as String & {
    value: string;
    toString: () => string;
    valueOf: () => string;
    [Symbol.toPrimitive]: () => string;
  };

  primitive.value = value;
  primitive.toString = () => value;
  primitive.valueOf = () => value;
  primitive[Symbol.toPrimitive] = () => value;

  return Object.assign(primitive, scale) as unknown as TokenGroup<T>;
}

const border = tokenGroup("var(--talea-border-soft)", {
  light: "var(--talea-border-light)",
  normal: "var(--talea-border-soft)",
  strong: "var(--talea-border-strong)",
  accent: "var(--talea-border-accent)",
});

const text = tokenGroup("var(--talea-text-primary)", {
  primary: "var(--talea-text-primary)",
  secondary: "var(--talea-text-secondary)",
  tertiary: "var(--talea-text-tertiary)",
  inverse: "var(--talea-text-inverse)",
  muted: "var(--talea-text-muted)",
});

const background = tokenGroup("var(--talea-page)", {
  primary: "var(--talea-page)",
  secondary: "var(--talea-surface-secondary)",
  tertiary: "var(--talea-surface-inset)",
  card: "var(--talea-surface-primary)",
});

const glass = tokenGroup("var(--talea-glass-bg)", {
  background: "var(--talea-glass-bg)",
  backgroundAlt: "var(--talea-glass-bg-alt)",
  warmBackground: "var(--talea-glass-bg-warm)",
  border: "var(--talea-glass-border)",
  shadow: "var(--talea-shadow-soft)",
  shadowStrong: "var(--talea-shadow-strong)",
});

const gradientMap = {
  primary: "var(--talea-gradient-primary)",
  secondary: "var(--talea-gradient-secondary)",
  warm: "var(--talea-gradient-warm)",
  cool: "var(--talea-gradient-cool)",
  sunset: "var(--talea-gradient-sunset)",
  ocean: "var(--talea-gradient-ocean)",
  lavender: "var(--talea-gradient-lavender)",
  background: "var(--talea-page)",
  nature: "var(--talea-gradient-nature)",
};

export const colors = {
  primary: {
    50: "#eef8f5",
    100: "#ddf1ea",
    200: "#c3e3d7",
    300: "#a6d2c4",
    400: "#8ac0af",
    500: "#6fae9c",
    600: "#589583",
    700: "#47786a",
    800: "#385e54",
    900: "#2a4540",
  },

  gray: {
    50: "#f8fafc",
    100: "#eff3f8",
    200: "#dce4ee",
    300: "#c3cedd",
    400: "#9aa9bc",
    500: "#748396",
    600: "#586678",
    700: "#425060",
    800: "#2c3947",
    900: "#17212d",
  },

  lavender: {
    50: "#eff6fb",
    100: "#dfeaf7",
    200: "#c6d9ef",
    300: "#aac5e1",
    400: "#93b0cf",
    500: "#7f9dc0",
    600: "#6885a8",
    700: "#536b89",
    800: "#42556c",
    900: "#303f50",
  },

  mint: {
    50: "#eef8f5",
    100: "#ddf1ea",
    200: "#c3e3d7",
    300: "#a6d2c4",
    400: "#8ac0af",
    500: "#6fae9c",
    600: "#589583",
    700: "#47786a",
    800: "#385e54",
    900: "#2a4540",
  },

  peach: {
    50: "#fdf4ef",
    100: "#fae6dc",
    200: "#f3d2c1",
    300: "#e9b89c",
    400: "#deab87",
    500: "#d79a73",
    600: "#c4835c",
    700: "#a66847",
    800: "#86513a",
    900: "#643c2b",
  },

  sky: {
    50: "#eff6fb",
    100: "#dfeaf7",
    200: "#c6d9ef",
    300: "#aac5e1",
    400: "#93b0cf",
    500: "#7f9dc0",
    600: "#6885a8",
    700: "#536b89",
    800: "#42556c",
    900: "#303f50",
  },

  rose: {
    50: "#fdf4ef",
    100: "#fae6dc",
    200: "#f3d2c1",
    300: "#e9b89c",
    400: "#deab87",
    500: "#d79a73",
    600: "#c4835c",
    700: "#a66847",
    800: "#86513a",
    900: "#643c2b",
  },

  lilac: {
    50: "#eff6fb",
    100: "#dfeaf7",
    200: "#c6d9ef",
    300: "#aac5e1",
    400: "#93b0cf",
    500: "#7f9dc0",
    600: "#6885a8",
    700: "#536b89",
    800: "#42556c",
    900: "#303f50",
  },

  sage: {
    50: "#f2f8f3",
    100: "#e1eee4",
    200: "#cadecf",
    300: "#acc8b6",
    400: "#8fb39d",
    500: "#739e86",
    600: "#5c836d",
    700: "#486757",
    800: "#384f44",
    900: "#293a31",
  },

  blush: {
    50: "#fdf4ef",
    100: "#fae6dc",
    200: "#f3d2c1",
    300: "#e9b89c",
    400: "#deab87",
    500: "#d79a73",
    600: "#c4835c",
    700: "#a66847",
    800: "#86513a",
    900: "#643c2b",
  },

  ocean: {
    50: "#eef7f9",
    100: "#dceef3",
    200: "#bcdce6",
    300: "#97c7d6",
    400: "#78b2c6",
    500: "#5f9fb4",
    600: "#4b8397",
    700: "#3d6979",
    800: "#315462",
    900: "#233e48",
  },

  honey: {
    50: "#fcf8ee",
    100: "#f7eed6",
    200: "#eedcae",
    300: "#e1c883",
    400: "#d4b56d",
    500: "#c5a46e",
    600: "#ac8c4f",
    700: "#8a6f3f",
    800: "#6b5632",
    900: "#4d3e24",
  },

  bloom: gradientMap.primary,
  background,
  text,
  border,

  effects: {
    shadow: {
      sm: "0 2px 8px rgba(0, 0, 0, 0.04)",
      md: "var(--talea-shadow-soft)",
      lg: "var(--talea-shadow-medium)",
      xl: "var(--talea-shadow-strong)",
    },
  },

  glass,

  semantic: {
    success: "#6fae9c",
    warning: "#c5a46e",
    error: "#d17986",
    info: "#7f9dc0",
  },

  gradients: gradientMap,

  surface: "var(--talea-surface-primary)",
  elevatedSurface: "var(--talea-surface-elevated)",
  panel: "var(--talea-panel)",
  option: "var(--talea-option)",
  itemBg: "var(--talea-item-bg)",
  body: "var(--talea-text-secondary)",
  title: "var(--talea-text-primary)",
  sub: "var(--talea-text-secondary)",
  bg: "var(--talea-surface-primary)",
  page: "var(--talea-page)",
  appBackground: "var(--talea-page)",
  textPrimary: "var(--talea-text-primary)",
  textSecondary: "var(--talea-text-secondary)",
  textInverse: "var(--talea-text-inverse)",
  borderSoft: "var(--talea-border-light)",
  accentStart: "var(--talea-accent-mint)",
  accentEnd: "var(--talea-accent-sky)",
  accentSoft: "rgba(111, 174, 156, 0.12)",
  blue: "var(--talea-accent-sky)",
  green: "var(--talea-accent-mint)",
  purple: "var(--talea-accent-sky)",
  teal: "var(--talea-accent-mint)",
  yellow: "var(--talea-accent-gold)",
  orange: "var(--talea-accent-peach)",
};

export const gradients = colors.gradients;
