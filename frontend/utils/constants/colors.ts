// 🌿 Talea - Moderne Pastell-Grün Farbpalette
// Ein frisches, naturinspiriertes Design für Kinder

export const colors = {
  // 🌿 Sage (Pastell-Grün) - HAUPTFARBE
  sage: {
    50: '#F6F9F6',
    100: '#E8F3E8',
    200: '#D4E7D4',
    300: '#B8D8B8',
    400: '#9AC99A',
    500: '#7DB87D',  // Hauptfarbe
    600: '#62A662',
    700: '#4A8E4A',
    800: '#367336',
    900: '#265926',
  },

  // 🌸 Blush (Zartes Rosa) - Akzentfarbe 1
  blush: {
    50: '#FFF8FA',
    100: '#FFECF2',
    200: '#FFD9E5',
    300: '#FFC2D4',
    400: '#FFABC4',
    500: '#FF94B3',
    600: '#E67A9A',
    700: '#CC6181',
    800: '#B34968',
    900: '#99334F',
  },

  // ☀️ Honey (Warmes Gelb) - Akzentfarbe 2
  honey: {
    50: '#FFFEF5',
    100: '#FFFBE6',
    200: '#FFF7CC',
    300: '#FFF2B3',
    400: '#FFED99',
    500: '#FFE87F',
    600: '#F5D960',
    700: '#E6C740',
    800: '#CCB020',
    900: '#B39900',
  },

  // 💜 Lilac (Sanftes Lila) - Akzentfarbe 3
  lilac: {
    50: '#FAF8FF',
    100: '#F2EDFF',
    200: '#E5DBFF',
    300: '#D4C4FF',
    400: '#C4ADFF',
    500: '#B396FF',
    600: '#9D7FE6',
    700: '#8768CC',
    800: '#7152B3',
    900: '#5B3C99',
  },

  // 🌊 Ocean (Frisches Türkis) - Akzentfarbe 4
  ocean: {
    50: '#F0FBFC',
    100: '#D9F5F8',
    200: '#B3EBF0',
    300: '#8CE1E9',
    400: '#66D7E1',
    500: '#40CDDA',
    600: '#2AB8C9',
    700: '#1FA3B3',
    800: '#148E99',
    900: '#0A7980',
  },

  // 🍑 Peach (Warmes Pfirsich) - Akzentfarbe 5
  peach: {
    50: '#FFF9F5',
    100: '#FFF0E6',
    200: '#FFE1CC',
    300: '#FFD1B3',
    400: '#FFC299',
    500: '#FFB37F',
    600: '#F59F66',
    700: '#E68B4D',
    800: '#CC7733',
    900: '#B3631A',
  },

  // 🎨 Hintergrundfarben
  background: {
    primary: '#FDFFFE',      // Fast weiß mit Grün-Ton
    secondary: '#F6F9F6',     // Sehr helles Sage
    tertiary: '#E8F3E8',      // Helles Sage
    warm: '#FFFEF5',          // Warmes Honey
    soft: '#FFF8FA',          // Weiches Blush
    card: '#FFFFFF',          // Reines Weiß
  },

  // 📝 Textfarben
  text: {
    primary: '#1A3A1A',       // Dunkles Grün
    secondary: '#2D572D',     // Mittleres Grün
    tertiary: '#4A8E4A',      // Helles Grün
    muted: '#9AC99A',         // Sehr helles Grün
    inverse: '#FFFFFF',       // Weiß
  },

  // 🎭 Borders
  border: {
    light: '#E8F3E8',
    normal: '#D4E7D4',
    strong: '#B8D8B8',
    accent: '#7DB87D',
  },

  // ✨ Glassmorphismus
  glass: {
    background: 'rgba(255, 255, 255, 0.95)',
    backgroundSage: 'rgba(246, 249, 246, 0.95)',
    border: 'rgba(184, 216, 184, 0.4)',
    shadow: '0 8px 32px rgba(125, 184, 125, 0.15)',
  },

  // 🎯 Semantische Farben
  semantic: {
    success: '#7DB87D',       // Sage
    warning: '#FFE87F',       // Honey
    error: '#FF94B3',         // Blush
    info: '#40CDDA',          // Ocean
  },

  // 🌈 Gradienten
  gradients: {
    primary: 'linear-gradient(135deg, #7DB87D 0%, #9AC99A 100%)',
    nature: 'linear-gradient(135deg, #7DB87D 0%, #40CDDA 100%)',
    sunset: 'linear-gradient(135deg, #FFB37F 0%, #FFE87F 100%)',
    bloom: 'linear-gradient(135deg, #FF94B3 0%, #B396FF 100%)',
    fresh: 'linear-gradient(135deg, #40CDDA 0%, #7DB87D 100%)',
    warm: 'linear-gradient(135deg, #FFE87F 0%, #FFB37F 100%)',
    
    // Hintergrund
    background: 'linear-gradient(135deg, #FDFFFE 0%, #F6F9F6 50%, #E8F3E8 100%)',
    backgroundWarm: 'linear-gradient(135deg, #FFFEF5 0%, #FFF9F5 100%)',
    
    // Overlays
    overlay: 'linear-gradient(180deg, rgba(125, 184, 125, 0) 0%, rgba(125, 184, 125, 0.15) 100%)',
  },

  // 🎪 Effekte
  effects: {
    shadow: {
      sm: '0 2px 8px rgba(125, 184, 125, 0.08)',
      md: '0 4px 16px rgba(125, 184, 125, 0.12)',
      lg: '0 8px 32px rgba(125, 184, 125, 0.16)',
      xl: '0 12px 48px rgba(125, 184, 125, 0.20)',
      '2xl': '0 20px 60px rgba(125, 184, 125, 0.25)',
    },
    glow: {
      sage: '0 0 20px rgba(125, 184, 125, 0.5)',
      blush: '0 0 20px rgba(255, 148, 179, 0.5)',
      honey: '0 0 20px rgba(255, 232, 127, 0.5)',
      lilac: '0 0 20px rgba(179, 150, 255, 0.5)',
      ocean: '0 0 20px rgba(64, 205, 218, 0.5)',
    },
  },
};

export const gradients = colors.gradients;
