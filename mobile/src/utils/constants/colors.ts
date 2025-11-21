/**
 * Talea Color System - Matching web frontend design
 */

export const colors = {
  // Primary brand colors
  lavender: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
  },
  peach: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
  },
  coral: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c',
    800: '#9f1239',
    900: '#881337',
  },
  mint: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },

  // Semantic colors
  text: {
    primary: '#1a1a2e',
    secondary: '#6b7280',
    light: '#9ca3af',
    white: '#ffffff',
  },

  background: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    dark: '#1a1a2e',
  },

  // Glassmorphism
  glass: {
    background: 'rgba(255, 255, 255, 0.7)',
    backgroundAlt: 'rgba(255, 255, 255, 0.9)',
    border: 'rgba(255, 255, 255, 0.3)',
  },

  border: {
    light: 'rgba(255, 255, 255, 0.3)',
    medium: 'rgba(0, 0, 0, 0.1)',
  },

  // Gradients (as strings for React Native)
  gradients: {
    lavenderPeach: ['#a78bfa', '#fdba74'],
    lavenderCoral: ['#8b5cf6', '#fb7185'],
    peachCoral: ['#fb923c', '#f43f5e'],
    background: ['#f5f3ff', '#fff7ed'],
  },
} as const;
