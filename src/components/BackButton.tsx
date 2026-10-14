import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '../theme/useAppTheme';

export default function BackButton({ label, fallback }: { label: string; fallback: string }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback as never);
    }
  };

  return <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${label}`} onPress={goBack} style={styles.button}>
    <Feather name="arrow-left" size={18} color={colors.primary} />
    <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({ button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 4 }, label: { fontSize: 14, fontWeight: '800' } });
