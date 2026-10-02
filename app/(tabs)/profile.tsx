import { StyleSheet, Text, View } from 'react-native';

import { profile } from '../../src/data/mockData';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.avatar} />
      <Text style={styles.name}>{profile.name}</Text>
      <Text style={styles.label}>Email</Text>
      <Text style={styles.value}>{profile.email}</Text>
      <Text style={styles.label}>Phone</Text>
      <Text style={styles.value}>{profile.phone}</Text>
      <Text style={styles.label}>Residence</Text>
      <Text style={styles.value}>{profile.residence}</Text>
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
    marginBottom: 20,
    color: '#0f172a',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#c7d2fe',
    alignSelf: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    color: '#0f172a',
  },
  label: {
    color: '#64748b',
    marginBottom: 4,
    fontWeight: '600',
  },
  value: {
    color: '#0f172a',
    fontSize: 16,
    marginBottom: 16,
  },
});
