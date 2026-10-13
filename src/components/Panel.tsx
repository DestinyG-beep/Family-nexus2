import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useAppTheme } from '../theme/useAppTheme';
import { radii } from '../theme/tokens';

export default function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  return <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

const styles = StyleSheet.create({ panel: { borderWidth: 1, borderRadius: radii.md, padding: 18 } });
