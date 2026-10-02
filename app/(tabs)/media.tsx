import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

const tabs = ['Images', 'Videos', 'Audio', 'Docs'];
const items = [
  { id: 1, name: 'family_reunion.jpg', type: 'Images', owner: 'Maya', date: 'Aug 21' },
  { id: 2, name: 'birthday_video.mp4', type: 'Videos', owner: 'Arjun', date: 'Aug 18' },
  { id: 3, name: 'family_audio.m4a', type: 'Audio', owner: 'Lina', date: 'Aug 15' },
  { id: 4, name: 'menu.pdf', type: 'Docs', owner: 'Maya', date: 'Aug 14' },
];

export default function MediaScreen() {
  const [selectedTab, setSelectedTab] = useState('Images');

  const filtered = items.filter((item) => item.type === selectedTab);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Family Media</Text>

      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.uploadButton}>
        <Text style={styles.uploadText}>+ Upload</Text>
      </Pressable>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No media yet.</Text>
          <Text style={styles.emptyText}>Be the first to share something with the family.</Text>
        </View>
      ) : (
        filtered.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.thumb} />
            <View style={styles.itemContent}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>Shared by {item.owner}</Text>
              <Text style={styles.itemMeta}>{item.date}</Text>
            </View>
          </View>
        ))
      )}
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
    marginBottom: 18,
    color: '#0f172a',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  tabButtonActive: {
    backgroundColor: '#4f46e5',
  },
  tabText: {
    color: '#334155',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  uploadButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 18,
  },
  uploadText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 12,
  },
  thumb: {
    width: 74,
    height: 74,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  itemMeta: {
    color: '#475569',
    marginBottom: 2,
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
  },
  emptyTitle: {
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    color: '#475569',
  },
});
