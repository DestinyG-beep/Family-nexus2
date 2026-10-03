import { Href, Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AuthScreen from '../src/components/AuthScreen';
import { useAuth } from '../src/context/AuthContext';

export default function AppEntry() {
  const { session, isLoading } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const nextPath = typeof next === 'string' && /^\/join\/[a-f0-9]{64}$/.test(next) ? next : undefined;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Loading Family App...</Text>
      </View>
    );
  }

  if (!session) {
    return <AuthScreen nextPath={nextPath} />;
  }

  return <Redirect href={(nextPath ?? '/(tabs)') as Href} />;
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
