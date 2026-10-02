import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { familyName, recentMedia, upcomingEvents } from '../../src/data/mockData';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}> 
      <Text style={styles.eyebrow}>Welcome</Text>
      <Text style={styles.title}>{familyName}</Text>
      <Text style={styles.status}>Profile completion: 75% complete</Text>

      <View style={styles.cardRow}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Recent media</Text>
          {recentMedia.map((item) => (
            <Text key={item.id} style={styles.listItem}>{item.type}: {item.name}</Text>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Upcoming events</Text>
          {upcomingEvents.map((item) => (
            <Text key={item.id} style={styles.listItem}>{item.name} • {item.date}</Text>
          ))}
        </View>
      </View>

      <View style={styles.actionsPanel}>
        <Text style={styles.panelTitle}>Quick actions</Text>
        <Text style={styles.actionText}>Upload media</Text>
        <Text style={styles.actionText}>Create event</Text>
        <Text style={styles.actionText}>Review family profile</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  eyebrow: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
    color: '#0f172a',
  },
  status: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 18,
  },
  cardRow: {
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    color: '#0f172a',
  },
  listItem: {
    color: '#334155',
    fontSize: 14,
    marginBottom: 6,
  },
  actionsPanel: {
    backgroundColor: '#eef2ff',
    borderRadius: 18,
    padding: 16,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#312e81',
  },
  actionText: {
    fontSize: 15,
    color: '#312e81',
    marginBottom: 6,
  },
});
