import { Stack } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AuthProvider } from '../src/context/AuthContext';
import { supabase } from '../src/lib/supabase';

function AuthRedirectHandler() {
  const url = Linking.useLinkingURL();

  useEffect(() => {
    if (Platform.OS === 'web' || !url || !supabase) return;

    const { queryParams } = Linking.parse(url);
    const code = queryParams?.code;
    const tokenHash = queryParams?.token_hash;
    const type = queryParams?.type;

    if (typeof code === 'string') {
      void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) console.warn('Auth redirect could not be completed', { code: error.code });
      });
      return;
    }

    if (typeof tokenHash === 'string' && (type === 'signup' || type === 'email')) {
      void supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
        if (error) console.warn('Email confirmation could not be completed', { code: error.code });
      });
    }
  }, [url]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthRedirectHandler />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
