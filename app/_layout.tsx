import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AuthProvider, useAuth } from '../src/context/AuthContext';
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
        if (error) {
          console.warn('Auth redirect could not be completed', {
            code: error.code,
          });
        }
      });
      return;
    }

    if (
      typeof tokenHash === 'string' &&
      (type === 'signup' || type === 'email')
    ) {
      void supabase.auth
        .verifyOtp({
          token_hash: tokenHash,
          type,
        })
        .then(({ error }) => {
          if (error) {
            console.warn('Email confirmation could not be completed', {
              code: error.code,
            });
          }
        });
    }
  }, [url]);

  return null;
}

function AuthNavigationGuard() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0];

    // The root "/" route is public because it contains AuthScreen.
    const isRootRoute = !firstSegment;

    // Invitation links must remain accessible while logged out.
    const isInvitationRoute = firstSegment === 'join';

    if (!session && !isRootRoute && !isInvitationRoute) {
      router.replace('/');
    }
  }, [session, isLoading, segments, router]);

  return null;
}

function RootNavigator() {
  return (
    <>
      <AuthRedirectHandler />
      <AuthNavigationGuard />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}