import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemePreference, useAuth } from '../../src/context/AuthContext';
import { ActiveFamilyMembership, getActiveFamilyMemberships } from '../../src/lib/familyService';
import { useAppTheme } from '../../src/theme/useAppTheme';

const themeOptions: { key: ThemePreference; label: string; icon: 'smartphone' | 'sun' | 'moon' }[] = [
  { key: 'SYSTEM', label: 'System', icon: 'smartphone' },
  { key: 'LIGHT', label: 'Light', icon: 'sun' },
  { key: 'DARK', label: 'Dark', icon: 'moon' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { session, profile, themePreference, setThemePreference, signOut } = useAuth();
  const { colors } = useAppTheme();
  const [memberships, setMemberships] = useState<ActiveFamilyMembership[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  const [themeError, setThemeError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoadingFamilies(true);
      if (!session?.id) {
        setMemberships([]);
        setLoadingFamilies(false);
        return () => { active = false; };
      }
      void getActiveFamilyMemberships(session.id)
        .then((result) => { if (active) setMemberships(result); })
        .catch(() => { if (active) setMemberships([]); })
        .finally(() => { if (active) setLoadingFamilies(false); });
      return () => { active = false; };
    }, [session])
  );

  const chooseTheme = async (preference: ThemePreference) => {
    setThemeError('');
    try {
      await setThemePreference(preference);
    } catch {
      setThemeError('This theme preference could not be saved.');
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      router.replace('/');
    } catch (error) {
      Alert.alert('Logout failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>ACCOUNT</Text>
      <Text style={[styles.title, { color: colors.heading }]}>Settings</Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeading}><View style={[styles.icon, { backgroundColor: `${colors.primary}18` }]}><Feather name="user" size={18} color={colors.primary} /></View><Text style={[styles.cardTitle, { color: colors.heading }]}>Signed in as</Text></View>
        <Text style={[styles.name, { color: colors.heading }]}>{profile?.name || session?.name || 'Family member'}</Text>
        <Text style={[styles.body, { color: colors.body }]}>{session?.email || profile?.email || 'Email unavailable'}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile' as never)} style={styles.linkButton}>
          <Text style={[styles.linkText, { color: colors.primary }]}>Edit profile</Text><Feather name="arrow-up-right" size={16} color={colors.primary} />
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.heading }]}>Appearance</Text>
        <Text style={[styles.body, { color: colors.body }]}>Choose how Family Nexus follows your device.</Text>
        <View style={styles.themeRow}>
          {themeOptions.map((option) => {
            const selected = themePreference === option.key;
            return <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => void chooseTheme(option.key)} style={[styles.themeButton, selected && styles.themeButtonSelected]}>
              <Feather name={option.icon} size={16} color={selected ? colors.onPrimary : colors.primary} />
              <Text style={[styles.themeText, { color: selected ? colors.onPrimary : colors.primary }, selected && styles.themeTextSelected]}>{option.label}</Text>
            </Pressable>;
          })}
        </View>
        {themeError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{themeError}</Text> : null}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.heading }]}>Family areas</Text>
        {loadingFamilies ? <ActivityIndicator color={colors.primary} style={styles.familyLoading} /> : memberships.length === 0 ? <Text style={[styles.body, { color: colors.body }]}>Join or create a family to see its workspace here.</Text> : memberships.map((membership) => <Pressable key={membership.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/family/[id]', params: { id: membership.family_id } })} style={[styles.familyRow, { borderTopColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: `${colors.secondary}18` }]}><Feather name="users" size={18} color={colors.secondary} /></View>
          <Text style={[styles.familyName, { color: colors.heading }]}>{membership.families?.name ?? 'Family space'}</Text>
          <Feather name="chevron-right" size={18} color={colors.primary} />
        </Pressable>)}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.heading }]}>Session</Text>
        <Pressable accessibilityRole="button" disabled={loggingOut} onPress={() => void handleLogout()} style={[styles.logoutButton, { backgroundColor: colors.danger }, loggingOut && styles.disabled]}>
          {loggingOut ? <ActivityIndicator color={colors.onPrimary} /> : <><Feather name="log-out" size={17} color={colors.onPrimary} /><Text style={[styles.logoutText, { color: colors.onPrimary }]}>Log out</Text></>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f3' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 22, paddingBottom: 48, gap: 14 },
  eyebrow: { color: '#54726b', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#102c2a', fontSize: 29, fontWeight: '700', marginTop: -4, marginBottom: 6 },
  card: { padding: 18, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dce5dd', gap: 8 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  cardTitle: { color: '#203a36', fontSize: 17, fontWeight: '700' },
  icon: { width: 36, height: 36, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e4f0e8' },
  name: { color: '#102c2a', fontSize: 16, fontWeight: '700', marginTop: 2 },
  body: { color: '#65736f', fontSize: 14, lineHeight: 20 },
  linkButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 2 },
  linkText: { color: '#176b63', fontWeight: '700' },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  themeButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 6, borderWidth: 1, borderColor: '#b8c9be' },
  themeButtonSelected: { backgroundColor: '#176b63', borderColor: '#176b63' },
  themeText: { color: '#315a53', fontSize: 13, fontWeight: '700' },
  themeTextSelected: { color: '#ffffff' },
  familyLoading: { marginVertical: 10 },
  familyRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#e7ede8', paddingTop: 9 },
  familyName: { flex: 1, color: '#203a36', fontSize: 15, fontWeight: '600' },
  logoutButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 7, backgroundColor: '#9b332b', marginTop: 3 },
  logoutText: { color: '#ffffff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  error: { color: '#9b332b', fontSize: 13, marginTop: 4 },
});
