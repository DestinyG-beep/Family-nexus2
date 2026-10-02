import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import AuthScreen from '../src/components/AuthScreen';
import { useAuth } from '../src/context/AuthContext';
import { getActiveFamilyMembership } from '../src/lib/familyService';

export default function AppEntry() {
  const { session, profile, isLoading, isProfileComplete } = useAuth();
  const [hasFamilyAccess, setHasFamilyAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session || !profile || !isProfileComplete) {
      setHasFamilyAccess(null);
      return;
    }

    const checkMembership = async () => {
      try {
        const membership = await getActiveFamilyMembership(session.id);
        setHasFamilyAccess(Boolean(membership));
      } catch (error) {
        console.warn('Unable to verify family access', error);
        setHasFamilyAccess(false);
      }
    };

    void checkMembership();
  }, [session, profile, isProfileComplete]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Loading Family App...</Text>
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (!profile || !isProfileComplete) {
    return <Redirect href="/profile-setup" />;
  }

  if (hasFamilyAccess === false) {
    return <Redirect href="/family-onboarding" />;
  }

  if (hasFamilyAccess === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Checking family membership...</Text>
      </View>
    );
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#0f172a',
  },
});
