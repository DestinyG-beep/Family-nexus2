import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Panel from '../../../src/components/Panel';
import BackButton from '../../../src/components/BackButton';
import SectionHeader from '../../../src/components/SectionHeader';
import { useAuth } from '../../../src/context/AuthContext';
import { ActiveFamilyMembership, FamilySettings, changeFamilyPassword, getActiveFamilyMemberships, getFamilySettings, resetFamilyPassword, updateFamilySettings } from '../../../src/lib/familyService';
import { canEditFamilySettings, isPrimaryFamilyAdmin } from '../../../src/lib/familyRoles';
import { useAppTheme } from '../../../src/theme/useAppTheme';

export default function FamilySettingsScreen() {
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

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

  const isOwner = canEditFamilySettings(membership?.role) && isPrimaryFamilyAdmin(membership?.role) && membership?.user_id === session?.id;
  const save = async () => {
    const limit = Number.parseInt(memberLimit.trim(), 10);
    if (name.trim().length < 5) { setError('Family name must be at least 5 characters long.'); return; }
    if (!Number.isInteger(limit) || limit < 1) { setError('Member limit must be a positive whole number.'); return; }
    setSaving(true); setError(''); setMessage('');
    try { const next = await updateFamilySettings({ familyId: id, name, memberLimit: limit }); setSettings(next); setName(next.name); setMemberLimit(String(next.member_limit)); setMessage('Family settings saved.'); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Family settings could not be saved.'); } finally { setSaving(false); }
  };

  const validateNewPassword = () => {
    if (newPassword.length < 8) { setError('Family password must be at least 8 characters long.'); return false; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return false; }
    return true;
  };

  const validateResetPassword = () => {
    if (resetNewPassword.length < 8) { setError('Family password must be at least 8 characters long.'); return false; }
    if (resetNewPassword !== resetConfirmPassword) { setError('Passwords do not match.'); return false; }
    return true;
  };

  const changePassword = async () => {
    setError(''); setMessage('');
    if (!currentPassword) { setError('Enter the current family password.'); return; }
    if (!validateNewPassword()) return;
    setPasswordSaving(true);
    try {
      await changeFamilyPassword({ familyId: id, currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setMessage('Family password changed successfully.');
    } catch (passwordError) { setError(passwordError instanceof Error ? passwordError.message : 'Family password could not be changed.'); } finally { setPasswordSaving(false); }
  };

  const resetPassword = async () => {
    setError(''); setMessage('');
    if (!resetConfirmed) { setError('Confirm that you want to replace the family password.'); return; }
    if (!validateResetPassword()) return;
    setPasswordSaving(true);
    try {
      await resetFamilyPassword({ familyId: id, newPassword: resetNewPassword });
      setResetNewPassword(''); setResetConfirmPassword(''); setResetConfirmed(false); setShowReset(false);
      setMessage('Family password reset successfully.');
    } catch (passwordError) { setError(passwordError instanceof Error ? passwordError.message : 'Family password could not be reset.'); } finally { setPasswordSaving(false); }
  };

  if (loading) return <View style={[styles.state, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /><Text style={[styles.body, { color: colors.body }]}>Loading family settings...</Text></View>;
  if (!membership || !settings) return <View style={[styles.state, { backgroundColor: colors.background }]}><Text style={[styles.error, { color: colors.danger }]}>{error || 'Family settings are unavailable.'}</Text><BackButton label="Family workspace" fallback={`/family/${id}`} /></View>;

  return <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
    <BackButton label={settings.name} fallback={`/family/${id}`} />
    <SectionHeader eyebrow="FAMILY WORKSPACE" title="Family settings" subtitle={isOwner ? 'Shape the shared space for everyone.' : 'View the settings for this family space.'} />
    <Panel style={styles.formCard}>
      <Text style={[styles.label, { color: colors.heading }]}>Family name</Text><TextInput editable={isOwner} value={name} onChangeText={setName} style={[styles.input, { color: colors.heading, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} />
      <Text style={[styles.label, { color: colors.heading }]}>Maximum members</Text><TextInput editable={isOwner} value={memberLimit} onChangeText={setMemberLimit} keyboardType="number-pad" style={[styles.input, { color: colors.heading, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} />
      <Text style={[styles.help, { color: colors.muted }]}>The limit cannot be lower than the current member count.</Text>
      {!isOwner ? <Text style={[styles.notice, { color: colors.body, backgroundColor: colors.surfaceMuted }]}>Only the primary Admin can edit these settings.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}{message ? <Text style={[styles.success, { color: colors.success }]}>{message}</Text> : null}
      {isOwner ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.primary, { backgroundColor: colors.primary }, saving && styles.disabled]}>{saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Save family settings</Text>}</Pressable> : null}
    </Panel>
    <Panel style={styles.formCard}>
      <Text style={[styles.sectionTitle, { color: colors.heading }]}>Family Password</Text>
      {!isOwner ? <Text style={[styles.notice, { color: colors.body, backgroundColor: colors.surfaceMuted }]}>Only the primary Admin can change or reset the family password.</Text> : null}
      {isOwner ? <>
        <PasswordField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} colors={colors} />
        <PasswordField label="New password" value={newPassword} onChangeText={setNewPassword} colors={colors} />
        <PasswordField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} colors={colors} />
        <Pressable accessibilityRole="button" disabled={passwordSaving} onPress={() => void changePassword()} style={[styles.primary, { backgroundColor: colors.primary }, passwordSaving && styles.disabled]}>{passwordSaving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Change Password</Text>}</Pressable>
        <Text style={[styles.forgot, { color: colors.body }]}>Forgot the family password?</Text>
        {!showReset ? <Pressable accessibilityRole="button" onPress={() => { setShowReset(true); setError(''); setMessage(''); }} style={[styles.secondary, { borderColor: colors.border }]}><Text style={[styles.secondaryText, { color: colors.primary }]}>Reset Family Password</Text></Pressable> : <View style={[styles.resetPanel, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.warning, { color: colors.warning }]}>The old password cannot be recovered. Resetting the family password will immediately replace the existing password. Existing invitation links will remain valid, but anyone joining must use the new password.</Text>
          <PasswordField label="New password" value={resetNewPassword} onChangeText={setResetNewPassword} colors={colors} />
          <PasswordField label="Confirm new password" value={resetConfirmPassword} onChangeText={setResetConfirmPassword} colors={colors} />
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: resetConfirmed }} onPress={() => setResetConfirmed((checked) => !checked)} style={styles.confirmRow}><Ionicons name={resetConfirmed ? 'checkbox' : 'square-outline'} size={22} color={colors.danger} /><Text style={[styles.confirmText, { color: colors.body }]}>I understand that the existing password will be replaced.</Text></Pressable>
          <View style={styles.resetActions}><Pressable accessibilityRole="button" onPress={() => { setShowReset(false); setResetConfirmed(false); setResetNewPassword(''); setResetConfirmPassword(''); }} style={[styles.secondary, { borderColor: colors.border }]}><Text style={[styles.secondaryText, { color: colors.body }]}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={passwordSaving} onPress={() => void resetPassword()} style={[styles.dangerButton, { backgroundColor: colors.danger }, passwordSaving && styles.disabled]}><Text style={styles.primaryText}>Reset Password</Text></Pressable></View>
        </View>}
      </> : null}
    </Panel>
    {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}{message ? <Text style={[styles.success, { color: colors.success }]}>{message}</Text> : null}
  </ScrollView>;
}

function PasswordField({ label, value, onChangeText, colors }: { label: string; value: string; onChangeText: (value: string) => void; colors: ReturnType<typeof useAppTheme>['colors'] }) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.field}><Text style={[styles.label, { color: colors.heading }]}>{label}</Text><View style={[styles.passwordRow, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}><TextInput value={value} onChangeText={onChangeText} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} style={[styles.passwordInput, { color: colors.heading }]} /><Pressable accessibilityRole="button" accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`} onPress={() => setVisible((isVisible) => !isVisible)} style={styles.eyeButton}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.muted} /></Pressable></View></View>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 22, paddingBottom: 48, gap: 16 }, back: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' }, backText: { fontSize: 14, fontWeight: '800' }, formCard: { gap: 8 }, sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 }, label: { fontSize: 13, fontWeight: '800', marginTop: 6 }, input: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 }, passwordRow: { minHeight: 46, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }, passwordInput: { flex: 1, minHeight: 44, paddingHorizontal: 12 }, eyeButton: { minHeight: 44, minWidth: 46, alignItems: 'center', justifyContent: 'center' }, field: { gap: 2 }, help: { fontSize: 13, lineHeight: 19 }, notice: { padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 19, marginTop: 8 }, forgot: { fontSize: 14, marginTop: 16 }, warning: { fontSize: 13, lineHeight: 20 }, resetPanel: { gap: 8, padding: 14, borderRadius: 8, marginTop: 4 }, confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }, confirmText: { flex: 1, fontSize: 13, lineHeight: 19 }, resetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 4 }, primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginTop: 12, paddingHorizontal: 18 }, primaryText: { color: '#ffffff', fontWeight: '800' }, secondary: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderRadius: 8 }, secondaryText: { fontWeight: '800' }, dangerButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 8 }, state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }, body: { fontSize: 14 }, error: { fontSize: 14, lineHeight: 20, textAlign: 'center' }, success: { fontSize: 14, lineHeight: 20 }, disabled: { opacity: 0.6 } });
