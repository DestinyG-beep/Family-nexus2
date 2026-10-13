import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/useAppTheme';
import { radii } from '../theme/tokens';

export default function ActionCard({ icon, title, description, onPress, accent = 'primary' }: { icon: React.ComponentProps<typeof Feather>['name']; title: string; description: string; onPress: () => void; accent?: 'primary' | 'secondary' }) {
  const { colors } = useAppTheme();
  const accentColor = accent === 'secondary' ? colors.secondary : colors.primary;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
    <View style={[styles.icon, { backgroundColor: `${accentColor}18` }]}><Feather name={icon} size={20} color={accentColor} /></View>
    <View style={styles.copy}><Text style={[styles.title, { color: colors.heading }]}>{title}</Text><Text style={[styles.description, { color: colors.body }]}>{description}</Text></View>
    <Feather name="chevron-right" size={19} color={colors.muted} />
  </Pressable>;
}

const styles = StyleSheet.create({ card: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, borderWidth: 1, borderRadius: radii.md }, pressed: { opacity: 0.78 }, icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, gap: 4 }, title: { fontSize: 16, fontWeight: '800' }, description: { fontSize: 13, lineHeight: 18 } });
