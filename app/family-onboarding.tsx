import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import FamilyCreationForm from '../src/components/FamilyCreationForm';
import { useAuth } from '../src/context/AuthContext';
import { getActiveFamilyMembership } from '../src/lib/familyService';

export default function FamilyOnboardingScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkMembership = async () => {
      if (!session) {
        router.replace('/');
        return;
      }

      try {
        const membership = await getActiveFamilyMembership(session.id);
        if (membership) {
          router.replace('/(tabs)');
          return;
        }
      } catch (error) {
        console.warn('Failed to load family membership', error);
      } finally {
        setIsChecking(false);
      }
    };

    void checkMembership();
  }, [router, session]);

  if (isChecking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Checking family access...</Text>
      </View>
    );
  }

  return <FamilyCreationForm />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    color: '#0f172a',
    fontSize: 16,
  },
});
