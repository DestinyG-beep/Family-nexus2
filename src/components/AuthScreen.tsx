import * as Linking from 'expo-linking';
import { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AUTH_BACKGROUND_IMAGE_URL } from '../config/branding';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen({ nextPath }: { nextPath?: string }) {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [backgroundFailed, setBackgroundFailed] = useState(false);

  const handleSubmit = async () => {
    if (loading) {
      return;
    }

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

        const result = await signUp(
          name.trim(),
          email.trim(),
          password,
          emailRedirectTo
        );

        if (result === 'confirmation-required') {
          setMessage(
            'Your account is ready. Confirm your email, then log in to continue.'
          );
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message.toLowerCase() : '';

      console.warn('Authentication request failed');

      if (
        messageText.includes('invalid login credentials') ||
        messageText.includes('invalid credentials')
      ) {
        setMessage('Email or password is incorrect.');
      } else if (messageText.includes('rate limit')) {
        setMessage('Too many attempts. Wait a while, then try again.');
      } else if (
        messageText.includes('network') ||
        messageText.includes('fetch')
      ) {
        setMessage(
          'Unable to connect to the server. Check your internet connection and try again.'
        );
      } else if (
        messageText.includes('supabase') &&
        messageText.includes('configuration')
      ) {
        setMessage(
          'The app is missing its server configuration. Please update the app configuration.'
        );
      } else {
        setMessage(
          'We could not complete sign-in. Check your details and try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    if (loading) {
      return;
    }

    setMessage('');
    setMode((currentMode) =>
      currentMode === 'login' ? 'register' : 'login'
    );
  };

  const content = (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <View style={styles.mark}>
          <Text style={styles.markText}>FN</Text>
        </View>

        <Text style={styles.title}>Family Nexus</Text>

        <Text style={styles.subtitle}>
          Welcome to the private family workspace.
        </Text>

        {mode === 'register' && (
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#8792a1"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!loading}
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
          autoCorrect={false}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#8792a1"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          onSubmitEditing={() => {
            void handleSubmit();
          }}
        />

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !loading && styles.primaryButtonPressed,
            loading && styles.primaryButtonDisabled,
          ]}
          onPress={() => {
            void handleSubmit();
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fffaf3" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {mode === 'login' ? 'Login' : 'Create account'}
            </Text>
          )}
        </Pressable>

        {message ? (
          <Text accessibilityRole="alert" style={styles.message}>
            {message}
          </Text>
        ) : null}

        <Pressable onPress={switchMode} disabled={loading}>
          <Text style={styles.switchText}>
            {mode === 'login'
              ? 'Need an account? Register'
              : 'Already have an account? Login'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  if (AUTH_BACKGROUND_IMAGE_URL && !backgroundFailed) {
    return (
      <ImageBackground
        source={{ uri: AUTH_BACKGROUND_IMAGE_URL }}
        onError={() => setBackgroundFailed(true)}
        style={styles.background}
        imageStyle={styles.backgroundImage}
      >
        <View style={styles.overlay}>{content}</View>
      </ImageBackground>
    );
  }

  return <View style={styles.fallback}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },

  background: {
    flex: 1,
    minHeight: '100%',
  },

  backgroundImage: {
    opacity: 0.58,
  },

  overlay: {
    flex: 1,
    minHeight: '100%',
    backgroundColor: 'rgba(35, 24, 19, 0.34)',
  },

  fallback: {
    flex: 1,
    backgroundColor: '#f7f1e9',
  },

  card: {
    backgroundColor: 'rgba(255, 253, 249, 0.95)',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    elevation: 4,
  },

  mark: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a8503b',
    marginBottom: 18,
  },

  markText: {
    color: '#fffaf3',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },

  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    color: '#2f2925',
  },

  subtitle: {
    fontSize: 16,
    color: '#5f5750',
    marginBottom: 20,
  },

  input: {
    borderWidth: 1,
    borderColor: '#e7d9ca',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 16,
    color: '#2f2925',
    backgroundColor: '#fffaf3',
  },

  primaryButton: {
    minHeight: 50,
    backgroundColor: '#a8503b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  primaryButtonPressed: {
    opacity: 0.9,
  },

  primaryButtonDisabled: {
    opacity: 0.7,
  },

  primaryButtonText: {
    color: '#fffaf3',
    fontSize: 16,
    fontWeight: '600',
  },

  message: {
    color: '#a33e38',
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  switchText: {
    marginTop: 20,
    color: '#7e392e',
    textAlign: 'center',
    fontWeight: '600',
  },
});