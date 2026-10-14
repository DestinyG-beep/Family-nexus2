import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import MemberAvatar from '../../src/components/MemberAvatar';
import { useAuth } from '../../src/context/AuthContext';
import { getProfileAvatarSignedUrl, uploadProfileAvatar } from '../../src/lib/avatarService';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function ProfileScreen() {
  const { session, profile, isLoading, isProfileComplete, updateProfile, refreshProfile } = useAuth();
  const { colors } = useAppTheme();
  const [name, setName] = useState(profile?.name ?? session?.name ?? '');
  const [email, setEmail] = useState(profile?.email ?? session?.email ?? '');
  const [phone, setPhone] = useState(profile?.phone_number ?? '');
  const [residence, setResidence] = useState(profile?.residence ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!session?.id) return () => { active = false; };
    setAvatarLoading(true);
    void getProfileAvatarSignedUrl(session.id)
      .then((result) => { if (active) setAvatarUrl(result?.signedUrl ?? null); })
      .catch(() => { if (active) setAvatarUrl(null); })
      .finally(() => { if (active) setAvatarLoading(false); });
    return () => { active = false; };
  }, [session]));

  const chooseAvatar = async () => {
    if (!session?.id || avatarUploading) return;
    setAvatarUploading(true);
    setError('');
    setMessage('');
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error('Allow photo access to choose a profile picture.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('The selected picture could not be read.');
      const blob = await response.blob();
      const uploaded = await uploadProfileAvatar({ blob, mimeType: asset.mimeType || blob.type || 'image/jpeg' });
      await updateProfile({ avatar_media_id: uploaded.avatarId });
      await refreshProfile();
      setAvatarUrl(uploaded.signedUrl);
      setMessage('Profile picture updated.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'The profile picture could not be updated.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const saveProfile = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      setMessage('');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateProfile({
        name: trimmedName,
        email: email.trim() || null,
        phone_number: phone.trim() || null,
        residence: residence.trim() || null,
      });
      setMessage('Profile saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Your profile could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <View style={[styles.state, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /><Text style={[styles.muted, { color: colors.body }]}>Loading your profile...</Text></View>;
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.eyebrow, { color: colors.primary }]}>ACCOUNT</Text>
      <Text style={[styles.title, { color: colors.heading }]}>Profile</Text>
      <Text style={[styles.subtitle, { color: colors.body }]}>Keep your family directory details up to date.</Text>

      <View style={styles.avatarWrap}>
        {avatarLoading ? <View style={[styles.avatar, { backgroundColor: `${colors.primary}20` }]}><ActivityIndicator color={colors.primary} /></View> : <MemberAvatar key={avatarUrl ?? 'avatar-fallback'} name={name || session?.name || 'Family member'} imageUrl={avatarUrl} size={82} />}
        <Pressable accessibilityRole="button" disabled={avatarUploading} onPress={() => void chooseAvatar()} style={[styles.avatarAction, { backgroundColor: colors.surface, borderColor: colors.border }, avatarUploading && styles.disabled]}>
          <Feather name="camera" size={15} color={colors.primary} /><Text style={[styles.avatarActionText, { color: colors.primary }]}>{avatarUploading ? 'Uploading...' : avatarUrl ? 'Change picture' : 'Add picture'}</Text>
        </Pressable>
      </View>
      <Text style={[styles.completion, { color: colors.secondary }]}>{isProfileComplete ? 'Profile complete' : 'Profile setup is incomplete'}</Text>

      <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.heading }]}>Name <Text style={[styles.required, { color: colors.danger }]}>*</Text></Text>
        <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.heading, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} autoCapitalize="words" />
        <Text style={[styles.label, { color: colors.heading }]}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.heading, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} keyboardType="email-address" autoCapitalize="none" />
        <Text style={[styles.label, { color: colors.heading }]}>Phone number</Text>
        <TextInput value={phone} onChangeText={setPhone} placeholder="Optional" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.heading, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} keyboardType="phone-pad" />
        <Text style={[styles.label, { color: colors.heading }]}>Residence</Text>
        <TextInput value={residence} onChangeText={setResidence} placeholder="Optional" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.heading, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} />

        {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {message ? <Text style={[styles.success, { color: colors.success }]}>{message}</Text> : null}
        <Pressable accessibilityRole="button" disabled={saving || !session} onPress={() => void saveProfile()} style={[styles.primaryButton, { backgroundColor: colors.primary }, (saving || !session) && styles.disabled]}>
          {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Save profile</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f3' },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 22, paddingBottom: 48, gap: 10 },
  eyebrow: { color: '#54726b', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#102c2a', fontSize: 29, fontWeight: '700', marginTop: 2 },
  subtitle: { color: '#65736f', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  avatarWrap: { alignItems: 'center', gap: 8, marginVertical: 8 },
  avatar: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e4f0e8' },
  avatarAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderWidth: 1, borderRadius: 999 },
  avatarActionText: { fontSize: 12, fontWeight: '800' },
  completion: { color: '#176b63', fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  formCard: { padding: 18, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dce5dd' },
  label: { color: '#315a53', fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  required: { color: '#9b332b' },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#cbd8cf', borderRadius: 6, paddingHorizontal: 12, color: '#203a36', backgroundColor: '#fbfdfb' },
  primaryButton: { minHeight: 48, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#176b63', marginTop: 18 },
  primaryText: { color: '#ffffff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  error: { color: '#9b332b', fontSize: 14, lineHeight: 20, marginTop: 10 },
  success: { color: '#176b63', fontSize: 14, lineHeight: 20, marginTop: 10 },
  state: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#f4f7f3', padding: 24 },
  muted: { color: '#65736f', fontSize: 14 },
});
