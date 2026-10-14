import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/useAppTheme';

export default function MemberAvatar({ name, size = 44, imageUrl }: { name: string; size?: number; imageUrl?: string | null }) {
  const { colors } = useAppTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  const showImage = !!imageUrl && !imageFailed;
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${colors.primary}20` }]}>
    {showImage ? <Image key={imageUrl} source={{ uri: imageUrl }} onError={() => setImageFailed(true)} style={styles.image} /> : <><Text style={[styles.initials, { color: colors.primary, fontSize: size * 0.32 }]}>{initials}</Text><Feather name="user" size={size * 0.32} color={colors.primary} style={styles.icon} /></>}
  </View>;
}

const styles = StyleSheet.create({ avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, image: { width: '100%', height: '100%' }, initials: { fontWeight: '800' }, icon: { position: 'absolute', opacity: 0.16 } });
