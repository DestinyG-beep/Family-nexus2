import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { createFamily } from '../lib/familyService';

export default function FamilyCreationForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [memberLimit, setMemberLimit] = useState('12');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (name.trim().length < 5) {
      Alert.alert('Family name too short', 'The family name must be at least 5 characters long.');
      return;
    }

    if (password.trim().length < 8) {
      Alert.alert('Password too short', 'The family password must be at least 8 characters long.');
      return;
    }

    const parsedLimit = Number(memberLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      Alert.alert('Invalid member limit', 'Member limit must be a positive integer.');
      return;
    }

    setLoading(true);

    try {
      await createFamily({
        name: name.trim(),
        password: password.trim(),
        memberLimit: parsedLimit,
      });

      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Family creation failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create your family</Text>
        <Text style={styles.subtitle}>Set the family details for your private community.</Text>

        <TextInput style={styles.input} placeholder="Family name" value={name} onChangeText={setName} />
        <TextInput
          style={styles.input}
          placeholder="Family password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Member limit"
          value={memberLimit}
          keyboardType="number-pad"
          onChangeText={setMemberLimit}
        />

        <Pressable style={styles.primaryButton} onPress={handleCreate} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? 'Creating...' : 'Create family'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: '#f8fafc',
  },
  primaryButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
