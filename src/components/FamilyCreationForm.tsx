import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import InfoButton from './InfoButton';
import { createFamily } from '../lib/familyService';

function FieldHeading({ label, title, message }: { label: string; title: string; message: string }) {
  return (
    <View style={styles.fieldHeading}>
      <Text style={styles.label}>{label}</Text>
      <InfoButton title={title} message={message} />
    </View>
  );
}

export default function FamilyCreationForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [memberLimit, setMemberLimit] = useState('12');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (name.trim().length < 5) {
      setError('Use a family name with at least 5 characters.');
      return;
    }
    if (password.trim().length < 8) {
      setError('Use a family password with at least 8 characters.');
      return;
    }

    const parsedLimit = Number(memberLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      setError('Maximum members must be a positive whole number.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await createFamily({ name: name.trim(), password: password.trim(), memberLimit: parsedLimit });
      router.replace({ pathname: '/(tabs)', params: { familyCreated: '1' } });
    } catch (createError) {
      console.warn('Family creation form failed', createError instanceof Error ? createError.message : 'unknown error');
      setError(createError instanceof Error ? createError.message : 'We could not create the family. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={19} color="#176b63" />
          <Text style={styles.backText}>Home</Text>
        </Pressable>

        <View style={styles.intro}>
          <View style={styles.iconWrap}><Feather name="users" size={25} color="#176b63" /></View>
          <Text style={styles.title}>Create your family</Text>
          <Text style={styles.subtitle}>Create a private family space where your family can share and stay connected.</Text>
        </View>

        <View style={styles.form}>
          <FieldHeading
            label="Family name"
            title="Family name"
            message="This is the name family members will see. Choose one they will recognize."
          />
          <TextInput
            style={styles.input}
            accessibilityLabel="Family name"
            placeholder="The Martins"
            placeholderTextColor="#8a9691"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            maxLength={80}
            returnKeyType="next"
          />

          <FieldHeading
            label="Family password"
            title="Family password"
            message="This password is used when someone joins your family directly. Keep it private and only share it with people you trust."
          />
          <TextInput
            style={styles.input}
            accessibilityLabel="Family password"
            placeholder="Enter a private family password"
            placeholderTextColor="#8a9691"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="next"
          />

          <FieldHeading
            label="Maximum members"
            title="Maximum members"
            message="This limits how many people can belong to the family. Lowering the limit does not remove existing members. New people cannot join once the limit is reached."
          />
          <TextInput
            style={styles.input}
            value={memberLimit}
            accessibilityLabel="Maximum members"
            onChangeText={setMemberLimit}
            keyboardType="number-pad"
            returnKeyType="done"
          />
          <Text style={styles.fieldHint}>Starting maximum: 12 people. Change this value as needed; current members will not be removed if you lower it.</Text>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          <Pressable accessibilityRole="button" style={[styles.primaryButton, loading && styles.disabled]} onPress={handleCreate} disabled={loading}>
            <Text style={styles.primaryText}>{loading ? 'Creating family...' : 'Create Family'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f4f7f3' },
  container: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 22, paddingBottom: 48 },
  backButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  backText: { color: '#176b63', fontSize: 15, fontWeight: '700' },
  intro: { marginTop: 15, marginBottom: 25 },
  iconWrap: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#e4f0e8', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { color: '#102c2a', fontSize: 29, fontWeight: '700' },
  subtitle: { color: '#53645f', fontSize: 15, lineHeight: 22, marginTop: 9, maxWidth: 560 },
  form: { backgroundColor: '#ffffff', padding: 20, borderRadius: 8, borderWidth: 1, borderColor: '#dce5dd' },
  fieldHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9, marginBottom: 2 },
  label: { color: '#203a36', fontSize: 14, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#cbd7cf', borderRadius: 6, paddingHorizontal: 13, color: '#18322f', backgroundColor: '#ffffff', fontSize: 15, marginBottom: 10 },
  fieldHint: { color: '#74817c', fontSize: 12, marginTop: -4, marginBottom: 8 },
  error: { color: '#9b332b', fontSize: 14, lineHeight: 20, marginVertical: 9 },
  primaryButton: { minHeight: 50, borderRadius: 7, backgroundColor: '#176b63', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.65 },
});