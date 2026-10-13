import { useColorScheme } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { darkColors, lightColors } from './tokens';

export function useAppTheme() {
  const { themePreference } = useAuth();
  const systemScheme = useColorScheme();
  const isDark = themePreference === 'DARK' || (themePreference === 'SYSTEM' && systemScheme === 'dark');
  return { colors: isDark ? darkColors : lightColors, isDark };
}
