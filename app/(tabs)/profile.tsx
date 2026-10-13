import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../src/context/AuthContext';

export default function ProfileScreen() {
  const { session, profile, isLoading, isProfileComplete, updateProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? session?.name ?? '');
  const [email, setEmail] = useState(profile?.email ?? session?.email ?? '');
  const [phone, setPhone] = useState(profile?.phone_number ?? '');
  const [residence, setResidence] = useState(profile?.residence ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
    return <View style={styles.state}><ActivityIndicator color="#176b63" /><Text style={styles.muted}>Loading your profile...</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>ACCOUNT</Text>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Keep your family directory details up to date.</Text>

      <View style={styles.avatar}><Feather name="user" size={32} color="#176b63" /></View>
      <Text style={styles.completion}>{isProfileComplete ? 'Profile complete' : 'Profile setup is incomplete'}</Text>

      <View style={styles.formCard}>
        <Text style={styles.label}>Name <Text style={styles.required}>*</Text></Text>
        <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#8a9691" style={styles.input} autoCapitalize="words" />
        <Text style={styles.label}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#8a9691" style={styles.input} keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.label}>Phone number</Text>
        <TextInput value={phone} onChangeText={setPhone} placeholder="Optional" placeholderTextColor="#8a9691" style={styles.input} keyboardType="phone-pad" />
        <Text style={styles.label}>Residence</Text>
        <TextInput value={residence} onChangeText={setResidence} placeholder="Optional" placeholderTextColor="#8a9691" style={styles.input} />

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <Pressable accessibilityRole="button" disabled={saving || !session} onPress={() => void saveProfile()} style={[styles.primaryButton, (saving || !session) && styles.disabled]}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Save profile</Text>}
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
  avatar: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: '#e4f0e8', marginVertical: 8 },
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
