import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import InfoButton from './InfoButton';
import { joinFamilyByCredentials } from '../lib/familyService';

export default function FamilyJoinForm() {
  const router = useRouter();
  const [familyName, setFamilyName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const join = async () => {
    if (familyName.trim().length < 5) {
      setError('Enter the family name. It must be at least 5 characters.');
      return;
    }
    if (password.length < 8) {
      setError('Enter a family password with at least 8 characters.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await joinFamilyByCredentials(familyName.trim(), password);
      switch (result.status) {
        case 'joined':
          router.replace({ pathname: '/(tabs)', params: { familyJoined: '1' } });
          return;
        case 'already_member':
          setError('You already belong to this family.');
          return;
        case 'family_full':
          setError('This family has reached its maximum size and cannot accept new members.');
          return;
        case 'restricted':
          setError('Your access to this family is restricted. Contact a family administrator.');
          return;
        default:
          setError('We could not match that family and password. Check the details and try again.');
      }
    } catch (joinError) {
      console.warn('Family join form failed', joinError instanceof Error ? joinError.message : 'unknown error');
      setError(joinError instanceof Error ? joinError.message : 'We could not join this family. Try again later.');
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
          <View style={styles.iconWrap}><Feather name="user-plus" size={24} color="#176b63" /></View>
          <Text style={styles.title}>Join a family</Text>
          <Text style={styles.subtitle}>Join an existing family with its name and private family password. Invitation links can also take you straight here.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldHeading}>
            <Text style={styles.label}>Family name</Text>
            <InfoButton title="Family name" message="Enter the family name exactly as the family recognizes it. The family name and password are checked together. We do not reveal whether a family exists." />
          </View>
          <TextInput
            style={styles.input}
            accessibilityLabel="Family name"
            placeholder="The Martins"
            placeholderTextColor="#8a9691"
            value={familyName}
            onChangeText={setFamilyName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <View style={styles.fieldHeading}>
            <Text style={styles.label}>Family password</Text>
            <InfoButton title="Family password" message="The family owner or administrator shares this password with trusted people. It is verified securely by the server and is never returned to the app. Invitation links also require this password to finish joining." />
          </View>
          <TextInput
            style={styles.input}
            accessibilityLabel="Family password"
            placeholder="Enter the family password"
            placeholderTextColor="#8a9691"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={() => void join()}
          />

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          <Pressable accessibilityRole="button" style={[styles.primaryButton, loading && styles.disabled]} onPress={() => void join()} disabled={loading}>
            <Text style={styles.primaryText}>{loading ? 'Joining family...' : 'Join Family'}</Text>
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
  error: { color: '#9b332b', fontSize: 14, lineHeight: 20, marginVertical: 9 },
  primaryButton: { minHeight: 50, borderRadius: 7, backgroundColor: '#176b63', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.65 },
});
