import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../context/AuthContext';

export default function ProfileSetupForm() {
  const router = useRouter();
  const { updateProfile, profile, session } = useAuth();
  const [name, setName] = useState(profile?.name ?? session?.name ?? '');
  const [email, setEmail] = useState(profile?.email ?? session?.email ?? '');
  const [phone, setPhone] = useState(profile?.phone_number ?? '');
  const [residence, setResidence] = useState(profile?.residence ?? '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please provide a name before entering the family app.');
      return;
    }

    setLoading(true);

    try {
      await updateProfile({
        name: name.trim(),
        email: email.trim() || null,
        phone_number: phone.trim() || null,
        residence: residence.trim() || null,
      });

      router.replace('/');
    } catch (error) {
      Alert.alert('Profile update failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>Name is required before you can access the family app.</Text>

        <TextInput style={styles.input} placeholder="Name" placeholderTextColor="#8a9691" value={name} onChangeText={setName} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8a9691"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput style={styles.input} placeholder="Phone" placeholderTextColor="#8a9691" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Residence" placeholderTextColor="#8a9691" value={residence} onChangeText={setResidence} />

        <Pressable style={styles.primaryButton} onPress={handleSave} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? 'Saving...' : 'Continue to app'}</Text>
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
