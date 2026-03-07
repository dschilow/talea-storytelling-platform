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
    50: "#fdf1f5",
    100: "#f8dfe8",
    200: "#efc7d5",
    300: "#e2a5bc",
    400: "#d58ea8",
    500: "#c88498",
    600: "#b36f84",
    700: "#975c6d",
    800: "#794a59",
    900: "#5c3643",
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
    50: "#f5f1fb",
    100: "#ece6f9",
    200: "#dacfef",
    300: "#c4b4e5",
    400: "#ad9dd7",
    500: "#9a8dbb",
    600: "#8374a4",
    700: "#6a5c88",
    800: "#554b6c",
    900: "#3f3950",
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
    50: "#fdf1f5",
    100: "#f8dfe7",
    200: "#efc8d3",
    300: "#e1a8bb",
    400: "#d58ea3",
    500: "#c87790",
    600: "#b2637b",
    700: "#955064",
    800: "#77404f",
    900: "#582f3b",
  },

  lilac: {
    50: "#f7f4fc",
    100: "#ede7fb",
    200: "#ddd2f4",
    300: "#cab9ea",
    400: "#b8a5de",
    500: "#a692d2",
    600: "#8f78b8",
    700: "#755f96",
    800: "#5d4c75",
    900: "#453853",
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
    50: "#fdf1f5",
    100: "#f8dde7",
    200: "#f0c4d4",
    300: "#e3a5bc",
    400: "#d58ca8",
    500: "#c87895",
    600: "#b06381",
    700: "#935067",
    800: "#74404f",
    900: "#55303b",
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
      sm: "0 8px 18px rgba(116, 95, 78, 0.08)",
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
  accentStart: "var(--talea-accent-sky)",
  accentEnd: "var(--talea-accent-lavender)",
  accentSoft: "rgba(212, 194, 227, 0.22)",
  blue: "var(--talea-accent-sky)",
  green: "var(--talea-accent-mint)",
  purple: "var(--talea-accent-lavender)",
  teal: "var(--talea-accent-mint)",
  yellow: "var(--talea-accent-gold)",
  orange: "var(--talea-accent-peach)",
};

export const gradients = colors.gradients;
