import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/useAppTheme';

export default function MemberAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const { colors } = useAppTheme();
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${colors.primary}20` }]}><Text style={[styles.initials, { color: colors.primary, fontSize: size * 0.32 }]}>{initials}</Text><Feather name="user" size={size * 0.32} color={colors.primary} style={styles.icon} /></View>;
}

const styles = StyleSheet.create({ avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, initials: { fontWeight: '800' }, icon: { position: 'absolute', opacity: 0.16 } });
