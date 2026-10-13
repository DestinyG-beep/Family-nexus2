import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/useAppTheme';

export default function SectionHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const { colors } = useAppTheme();
  return <View style={styles.wrap}>
    {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}
    <Text style={[styles.title, { color: colors.heading }]}>{title}</Text>
    {subtitle ? <Text style={[styles.subtitle, { color: colors.body }]}>{subtitle}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({ wrap: { gap: 4 }, eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, title: { fontSize: 23, fontWeight: '800' }, subtitle: { fontSize: 14, lineHeight: 20 } });
