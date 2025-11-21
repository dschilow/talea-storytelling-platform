/**
 * Dark Mode Color Palette
 */

export const darkColors = {
  // Primary brand colors (slightly adjusted for dark mode)
  lavender: {
    50: '#2d2640',
    100: '#3d3350',
    200: '#4d4060',
    300: '#6d5a90',
    400: '#8d74b0',
    500: '#a78bfa',
    600: '#b9a0ff',
    700: '#cbb5ff',
    800: '#ddcaff',
    900: '#efe0ff',
  },
  peach: {
    50: '#3d2820',
    100: '#4d3530',
    200: '#6d4a40',
    300: '#8d6050',
    400: '#ad7560',
    500: '#fb923c',
    600: '#fca55f',
    700: '#fdb882',
    800: '#fecba5',
    900: '#ffdec8',
  },
  coral: {
    50: '#3d2028',
    100: '#4d2838',
    200: '#6d3848',
    300: '#8d4858',
    400: '#ad5868',
    500: '#f43f5e',
    600: '#f65f7a',
    700: '#f87f96',
    800: '#fa9fb2',
    900: '#fcbfce',
  },
  mint: {
    50: '#1a3d38',
    100: '#2a4d48',
    200: '#3a6d58',
    300: '#4a8d68',
    400: '#5aad78',
    500: '#14b8a6',
    600: '#3cc4b4',
    700: '#64d0c2',
    800: '#8cdcd0',
    900: '#b4e8de',
  },

  // Semantic colors for dark mode
  text: {
    primary: '#f5f5f5',
    secondary: '#a1a1aa',
    light: '#71717a',
    white: '#ffffff',
  },

  background: {
    primary: '#18181b',
    secondary: '#27272a',
    dark: '#09090b',
  },

  // Glassmorphism for dark mode
  glass: {
    background: 'rgba(39, 39, 42, 0.8)',
    backgroundAlt: 'rgba(39, 39, 42, 0.95)',
    border: 'rgba(255, 255, 255, 0.1)',
  },

  border: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.15)',
  },

  // Gradients (for dark mode)
  gradients: {
    lavenderPeach: ['#a78bfa', '#fb923c'],
    lavenderCoral: ['#a78bfa', '#f43f5e'],
    peachCoral: ['#fb923c', '#f43f5e'],
    background: ['#27272a', '#18181b'],
  },
} as const;
