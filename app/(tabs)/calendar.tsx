import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../src/context/AuthContext';
import { ActiveFamilyMembership, getActiveFamilyMemberships } from '../../src/lib/familyService';
import { CalendarEvent, createCalendarEvent, deleteCalendarEvent, listCalendarEvents, updateCalendarEvent } from '../../src/lib/calendarService';

type FormState = { name: string; date: string; time: string; location: string; mapUrl: string; familyId: string };
const emptyForm: FormState = { name: '', date: '', time: '', location: '', mapUrl: '', familyId: '' };

function formDate(event: CalendarEvent) {
  if (!event.start_at) return { date: '', time: '' };
  const value = new Date(event.start_at);
  const pad = (number: number) => String(number).padStart(2, '0');
  return { date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`, time: `${pad(value.getHours())}:${pad(value.getMinutes())}` };
}

function startAtFromForm(date: string, time: string) {
  if (!date.trim()) return null;
  const value = new Date(`${date.trim()}T${time.trim() || '00:00'}:00`);
  if (Number.isNaN(value.getTime())) throw new Error('Use a date in YYYY-MM-DD format and time in HH:MM format.');
  return value.toISOString();
}

function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Date and time not set';
}

export default function CalendarScreen() {
  const { session } = useAuth();
  const [memberships, setMemberships] = useState<ActiveFamilyMembership[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadCalendar = useCallback(async (showLoading = true) => {
    if (!session?.id) {
      setMemberships([]);
      setEvents([]);
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    setError('');
    try {
      const nextMemberships = await getActiveFamilyMemberships(session.id);
      setMemberships(nextMemberships);
      setEvents(await listCalendarEvents(nextMemberships.map((membership) => membership.family_id)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Your calendar could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(useCallback(() => {
    void loadCalendar();
  }, [loadCalendar]));

  const openCreate = () => {
    setEditingEvent(null);
    setForm({ ...emptyForm, familyId: memberships[0]?.family_id ?? '' });
    setModalVisible(true);
  };

  const openEdit = (event: CalendarEvent) => {
    const dateParts = formDate(event);
    setEditingEvent(event);
    setForm({ name: event.name, date: dateParts.date, time: dateParts.time, location: event.location_name ?? '', mapUrl: event.map_url ?? '', familyId: event.family_id });
    setModalVisible(true);
  };

  const saveEvent = async () => {
    const name = form.name.trim();
    if (!name) {
      setError('Event name is required.');
      return;
    }
    if (!editingEvent && !form.familyId) {
      setError('Choose a family for this event.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const startAt = startAtFromForm(form.date, form.time);
      if (editingEvent) {
        await updateCalendarEvent({ id: editingEvent.id, name, startAt, locationName: form.location, mapUrl: form.mapUrl });
      } else {
        await createCalendarEvent({ familyId: form.familyId, name, startAt, locationName: form.location, mapUrl: form.mapUrl });
      }
      setModalVisible(false);
      await loadCalendar(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The event could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = (event: CalendarEvent) => {
    Alert.alert('Delete event?', 'This removes the event from the family calendar.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void (async () => {
        try {
          await deleteCalendarEvent(event.id);
          setEvents((current) => current.filter((item) => item.id !== event.id));
        } catch (deleteError) {
          setError(deleteError instanceof Error ? deleteError.message : 'The event could not be deleted.');
        }
      })() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>ACCOUNT</Text><Text style={styles.title}>Calendar</Text><Text style={styles.subtitle}>Events from the family spaces you belong to.</Text></View>
        <Pressable accessibilityRole="button" disabled={memberships.length === 0} onPress={openCreate} style={[styles.addButton, memberships.length === 0 && styles.disabled]}><Feather name="plus" size={19} color="#ffffff" /><Text style={styles.addText}>Create</Text></Pressable>
      </View>

      {loading ? <View style={styles.state}><ActivityIndicator color="#176b63" /><Text style={styles.muted}>Loading events...</Text></View> : error && events.length === 0 ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable onPress={() => void loadCalendar()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : memberships.length === 0 ? <View style={styles.state}><Feather name="calendar" size={28} color="#176b63" /><Text style={styles.emptyTitle}>Join or create a family first</Text><Text style={styles.muted}>Family events will appear here once you belong to a family.</Text></View> : events.length === 0 ? <View style={styles.state}><Feather name="calendar" size={28} color="#176b63" /><Text style={styles.emptyTitle}>No events yet</Text><Text style={styles.muted}>Create the first event for one of your families.</Text></View> : <View style={styles.list}>{events.map((event) => <View key={event.id} style={styles.eventCard}>
        <View style={styles.eventHeading}><View style={styles.dateIcon}><Feather name="calendar" size={18} color="#176b63" /></View><View style={styles.eventCopy}><Text style={styles.eventName}>{event.name}</Text><Text style={styles.familyName}>{event.family_name}</Text></View></View>
        <Text style={styles.eventMeta}><Feather name="clock" size={14} color="#65736f" /> {displayDate(event.start_at)}</Text>
        {event.location_name ? <Text style={styles.eventMeta}><Feather name="map-pin" size={14} color="#65736f" /> {event.location_name}</Text> : null}
        {event.map_url ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(event.map_url!)}><Text style={styles.mapLink}>Open map link</Text></Pressable> : null}
        {event.created_by === session?.id ? <View style={styles.eventActions}><Pressable accessibilityRole="button" onPress={() => openEdit(event)} style={styles.actionButton}><Feather name="edit-2" size={14} color="#176b63" /><Text style={styles.actionText}>Edit</Text></Pressable><Pressable accessibilityRole="button" onPress={() => removeEvent(event)} style={styles.actionButton}><Feather name="trash-2" size={14} color="#9b332b" /><Text style={styles.deleteText}>Delete</Text></Pressable></View> : null}
      </View>)}</View>}
      {error && events.length > 0 ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!loading && memberships.length > 0 ? <Pressable accessibilityRole="button" disabled={refreshing} onPress={() => { setRefreshing(true); void loadCalendar(false); }} style={styles.refresh}><Feather name="refresh-cw" size={15} color="#176b63" /><Text style={styles.refreshText}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text></Pressable> : null}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{editingEvent ? 'Edit event' : 'Create event'}</Text>
          <Text style={styles.label}>Event name *</Text><TextInput value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Family dinner" placeholderTextColor="#8a9691" style={styles.input} />
          {!editingEvent && memberships.length > 1 ? <><Text style={styles.label}>Family *</Text><View style={styles.familyChoices}>{memberships.map((membership) => <Pressable key={membership.family_id} onPress={() => setForm((current) => ({ ...current, familyId: membership.family_id }))} style={[styles.familyChip, form.familyId === membership.family_id && styles.familyChipSelected]}><Text style={[styles.familyChipText, form.familyId === membership.family_id && styles.familyChipTextSelected]}>{membership.families?.name ?? 'Family'}</Text></Pressable>)}</View></> : null}
          <Text style={styles.label}>Date (YYYY-MM-DD)</Text><TextInput value={form.date} onChangeText={(value) => setForm((current) => ({ ...current, date: value }))} placeholder="2026-10-31" placeholderTextColor="#8a9691" style={styles.input} autoCapitalize="none" />
          <Text style={styles.label}>Time (HH:MM)</Text><TextInput value={form.time} onChangeText={(value) => setForm((current) => ({ ...current, time: value }))} placeholder="18:30" placeholderTextColor="#8a9691" style={styles.input} keyboardType="numbers-and-punctuation" />
          <Text style={styles.label}>Location</Text><TextInput value={form.location} onChangeText={(value) => setForm((current) => ({ ...current, location: value }))} placeholder="Optional" placeholderTextColor="#8a9691" style={styles.input} />
          <Text style={styles.label}>Map URL</Text><TextInput value={form.mapUrl} onChangeText={(value) => setForm((current) => ({ ...current, mapUrl: value }))} placeholder="Optional" placeholderTextColor="#8a9691" style={styles.input} autoCapitalize="none" keyboardType="url" />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <View style={styles.modalActions}><Pressable onPress={() => setModalVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving} onPress={() => void saveEvent()} style={[styles.saveButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>Save event</Text>}</Pressable></View>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f3' },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 22, paddingBottom: 48, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: '#54726b', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#102c2a', fontSize: 29, fontWeight: '700', marginTop: 2 },
  subtitle: { color: '#65736f', fontSize: 14, lineHeight: 20, marginTop: 4 },
  addButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 7, backgroundColor: '#176b63' },
  addText: { color: '#ffffff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  state: { minHeight: 210, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, borderRadius: 8, borderWidth: 1, borderColor: '#dce5dd', backgroundColor: '#ffffff' },
  muted: { color: '#65736f', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyTitle: { color: '#203a36', fontSize: 17, fontWeight: '700' },
  error: { color: '#9b332b', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retry: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 6, backgroundColor: '#176b63' },
  retryText: { color: '#ffffff', fontWeight: '700' },
  list: { gap: 10 },
  eventCard: { padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#dce5dd', backgroundColor: '#ffffff', gap: 9 },
  eventHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  dateIcon: { width: 40, height: 40, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e4f0e8' },
  eventCopy: { flex: 1 },
  eventName: { color: '#203a36', fontSize: 16, fontWeight: '700' },
  familyName: { color: '#176b63', fontSize: 13, fontWeight: '600', marginTop: 3 },
  eventMeta: { color: '#65736f', fontSize: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapLink: { color: '#176b63', fontSize: 14, fontWeight: '700' },
  eventActions: { flexDirection: 'row', gap: 16, borderTopWidth: 1, borderTopColor: '#e7ede8', paddingTop: 9, marginTop: 2 },
  actionButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#176b63', fontSize: 13, fontWeight: '700' },
  deleteText: { color: '#9b332b', fontSize: 13, fontWeight: '700' },
  refresh: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  refreshText: { color: '#176b63', fontSize: 13, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12, 31, 29, 0.42)' },
  modalCard: { maxHeight: '92%', padding: 22, borderTopLeftRadius: 14, borderTopRightRadius: 14, backgroundColor: '#ffffff' },
  modalTitle: { color: '#102c2a', fontSize: 22, fontWeight: '700', marginBottom: 7 },
  label: { color: '#315a53', fontSize: 13, fontWeight: '700', marginTop: 9, marginBottom: 5 },
  input: { minHeight: 44, borderWidth: 1, borderColor: '#cbd8cf', borderRadius: 6, paddingHorizontal: 11, color: '#203a36', backgroundColor: '#fbfdfb' },
  familyChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  familyChip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#e6ede7' },
  familyChipSelected: { backgroundColor: '#176b63' },
  familyChipText: { color: '#435a54', fontSize: 13, fontWeight: '600' },
  familyChipTextSelected: { color: '#ffffff' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 17 },
  cancelButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 16 },
  cancelText: { color: '#64746f', fontWeight: '700' },
  saveButton: { minHeight: 46, minWidth: 120, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#176b63', paddingHorizontal: 15 },
  saveText: { color: '#ffffff', fontWeight: '700' },
});
