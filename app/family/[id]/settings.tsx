import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Panel from '../../../src/components/Panel';
import SectionHeader from '../../../src/components/SectionHeader';
import { useAuth } from '../../../src/context/AuthContext';
import { ActiveFamilyMembership, FamilySettings, getActiveFamilyMemberships, getFamilySettings, updateFamilySettings } from '../../../src/lib/familyService';
import { useAppTheme } from '../../../src/theme/useAppTheme';

export default function FamilySettingsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const [membership, setMembership] = useState<ActiveFamilyMembership | null>(null);
  const [settings, setSettings] = useState<FamilySettings | null>(null);
  const [name, setName] = useState('');
  const [memberLimit, setMemberLimit] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session?.id || !id) return;
    setLoading(true); setError('');
    try {
      const memberships = await getActiveFamilyMemberships(session.id);
      const current = memberships.find((item) => item.family_id === id) ?? null;
      setMembership(current);
      if (!current) throw new Error('You do not have access to this family.');
      const next = await getFamilySettings(id);
      setSettings(next); setName(next?.name ?? current.families?.name ?? ''); setMemberLimit(String(next?.member_limit ?? current.families?.member_limit ?? ''));
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Family settings could not be loaded.'); } finally { setLoading(false); }
  }, [id, session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const isOwner = membership?.role === 'SUPERADMIN' && membership.user_id === session?.id;
  const save = async () => {
    const limit = Number.parseInt(memberLimit.trim(), 10);
    if (name.trim().length < 5) { setError('Family name must be at least 5 characters long.'); return; }
    if (!Number.isInteger(limit) || limit < 1) { setError('Member limit must be a positive whole number.'); return; }
    setSaving(true); setError(''); setMessage('');
    try { const next = await updateFamilySettings({ familyId: id, name, memberLimit: limit }); setSettings(next); setName(next.name); setMemberLimit(String(next.member_limit)); setMessage('Family settings saved.'); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Family settings could not be saved.'); } finally { setSaving(false); }
  };

  if (loading) return <View style={[styles.state, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /><Text style={[styles.body, { color: colors.body }]}>Loading family settings...</Text></View>;
  if (!membership || !settings) return <View style={[styles.state, { backgroundColor: colors.background }]}><Text style={[styles.error, { color: colors.danger }]}>{error || 'Family settings are unavailable.'}</Text><Pressable onPress={() => router.back()} style={[styles.secondary, { borderColor: colors.border }]}><Text style={[styles.secondaryText, { color: colors.primary }]}>Back to family</Text></Pressable></View>;

  return <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={18} color={colors.primary} /><Text style={[styles.backText, { color: colors.primary }]}>{settings.name}</Text></Pressable>
    <SectionHeader eyebrow="FAMILY WORKSPACE" title="Family settings" subtitle={isOwner ? 'Shape the shared space for everyone.' : 'View the settings for this family space.'} />
    <Panel style={styles.formCard}>
      <Text style={[styles.label, { color: colors.heading }]}>Family name</Text><TextInput editable={isOwner} value={name} onChangeText={setName} style={[styles.input, { color: colors.heading, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} />
      <Text style={[styles.label, { color: colors.heading }]}>Maximum members</Text><TextInput editable={isOwner} value={memberLimit} onChangeText={setMemberLimit} keyboardType="number-pad" style={[styles.input, { color: colors.heading, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} />
      <Text style={[styles.help, { color: colors.muted }]}>The limit cannot be lower than the current member count.</Text>
      {!isOwner ? <Text style={[styles.notice, { color: colors.body, backgroundColor: colors.surfaceMuted }]}>Only the primary Admin can edit these settings.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}{message ? <Text style={[styles.success, { color: colors.success }]}>{message}</Text> : null}
      {isOwner ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.primary, { backgroundColor: colors.primary }, saving && styles.disabled]}>{saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Save family settings</Text>}</Pressable> : null}
    </Panel>
  </ScrollView>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 22, paddingBottom: 48, gap: 16 }, back: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' }, backText: { fontSize: 14, fontWeight: '800' }, formCard: { gap: 8 }, label: { fontSize: 13, fontWeight: '800', marginTop: 6 }, input: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 }, help: { fontSize: 13, lineHeight: 19 }, notice: { padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 19, marginTop: 8 }, primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginTop: 12 }, primaryText: { fontWeight: '800' }, secondary: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderRadius: 8 }, secondaryText: { fontWeight: '800' }, state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }, body: { fontSize: 14 }, error: { fontSize: 14, lineHeight: 20, textAlign: 'center' }, success: { fontSize: 14, lineHeight: 20 }, disabled: { opacity: 0.6 } });
