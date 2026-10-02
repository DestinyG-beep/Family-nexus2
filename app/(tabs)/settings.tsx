import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/context/AuthContext';

export default function SettingsScreen() {
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Logout failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.item}>Theme: Light / Dark / System</Text>
      <Text style={styles.item}>Family background: Enabled</Text>
      <Text style={styles.item}>Profile completion reminder: On</Text>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 18,
    color: '#0f172a',
  },
  item: {
    color: '#334155',
    fontSize: 16,
    marginBottom: 10,
  },
  logoutButton: {
    marginTop: 24,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
