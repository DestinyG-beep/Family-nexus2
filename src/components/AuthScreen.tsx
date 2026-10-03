import * as Linking from 'expo-linking';
import { useState } from 'react';
import {
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';

export default function AuthScreen({ nextPath }: { nextPath?: string }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    if (mode === 'register' && !name.trim()) {
      setMessage('Enter your name to create an account.');
      return;
    }
    if (!email.trim() || !password) {
      setMessage('Enter your email and password to continue.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      if (mode === 'register') {
        const emailRedirectTo = nextPath
          ? Platform.OS === 'web' && typeof window !== 'undefined'
            ? `${window.location.origin}${nextPath}`
            : Linking.createURL(nextPath.replace(/^\//, ''))
          : undefined;
        const result = await signUp(name.trim(), email.trim(), password, emailRedirectTo);
        if (result === 'confirmation-required') {
          setMessage('Your account is ready. Confirm your email, then log in to continue.');
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message.toLowerCase() : '';
      console.warn('Authentication request failed');
      setMessage(
        messageText.includes('invalid login credentials') || messageText.includes('invalid credentials')
          ? 'Email or password is incorrect.'
          : messageText.includes('rate limit')
            ? 'Too many attempts. Wait a while, then try again.'
            : 'We could not complete sign-in. Check your details and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Family App</Text>
        <Text style={styles.subtitle}>Welcome to the private family workspace.</Text>

        {mode === 'register' && (
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#8792a1"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8792a1"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#8792a1"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}</Text>
        </Pressable>

        {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}

        <Pressable onPress={() => { setMessage(''); setMode(mode === 'login' ? 'register' : 'login'); }}>
          <Text style={styles.switchText}>
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
          </Text>
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
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
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
    fontSize: 16,
    backgroundColor: '#f8fafc',
  },
  message: {
    color: '#8b3d2f',
    marginTop: 12,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchText: {
    marginTop: 18,
    color: '#4338ca',
    textAlign: 'center',
    fontWeight: '600',
  },
});
