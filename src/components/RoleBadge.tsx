import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/useAppTheme';
import { radii } from '../theme/tokens';

export function roleLabel(role: string) {
  if (role === 'SUPERADMIN') return 'Family Owner';
  if (role === 'ADMIN') return 'Administrator';
  return 'Member';
}

export default function RoleBadge({ role }: { role: string }) {
  const { colors } = useAppTheme();
  return <View style={[styles.badge, { backgroundColor: `${colors.secondary}18` }]}><Text style={[styles.text, { color: colors.secondary }]}>{roleLabel(role)}</Text></View>;
}

const styles = StyleSheet.create({ badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill }, text: { fontSize: 11, fontWeight: '800' } });
