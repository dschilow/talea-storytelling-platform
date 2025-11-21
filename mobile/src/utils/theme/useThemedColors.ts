import { useTheme } from './ThemeContext';
import { colors as lightColors } from '@/utils/constants/colors';
import { darkColors } from './colors.dark';

/**
 * Hook to get themed colors based on current theme mode
 */
export const useThemedColors = () => {
  const { isDark } = useTheme();
  return isDark ? darkColors : lightColors;
};
