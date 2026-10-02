import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { upcomingEvents } from '../../src/data/mockData';

export default function CalendarScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Calendar</Text>
      <Text style={styles.sectionLabel}>Current month</Text>

      <View style={styles.card}>
        {upcomingEvents.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming events. Create the first family event.</Text>
        ) : (
          upcomingEvents.map((event) => (
            <View key={event.id} style={styles.eventItem}>
              <Text style={styles.eventName}>{event.name}</Text>
              <Text style={styles.eventMeta}>{event.date}</Text>
              <Text style={styles.eventMeta}>{event.time}</Text>
              <Text style={styles.eventMeta}>{event.location}</Text>
            </View>
          ))
        )}
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
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#0f172a',
  },
  sectionLabel: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
  },
  eventItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 12,
    marginBottom: 12,
  },
  eventName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  eventMeta: {
    color: '#475569',
    fontSize: 14,
    marginBottom: 2,
  },
  emptyText: {
    color: '#475569',
    fontSize: 14,
  },
});
