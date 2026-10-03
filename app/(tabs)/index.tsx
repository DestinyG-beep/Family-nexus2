import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import InfoButton from '../../src/components/InfoButton';
import { useAuth } from '../../src/context/AuthContext';
import { ActiveFamilyMembership, getActiveFamilyMemberships } from '../../src/lib/familyService';

function roleLabel(role: string) {
  if (role === 'SUPERADMIN') return 'Family Owner';
  if (role === 'ADMIN') return 'Administrator';
  return 'Member';
}

export default function HomeScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const { familyCreated, familyJoined } = useLocalSearchParams<{ familyCreated?: string; familyJoined?: string }>();
  const [memberships, setMemberships] = useState<ActiveFamilyMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [familyChoicesVisible, setFamilyChoicesVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadMemberships = async () => {
        if (!session?.id) {
          setMemberships([]);
          setLoading(false);
          return;
        }

        setLoading(true);
        setError('');
        try {
          const result = await getActiveFamilyMemberships(session.id);
          if (active) setMemberships(result);
        } catch (loadError) {
          console.warn('Unable to load family spaces', loadError instanceof Error ? loadError.message : 'unknown error');
          if (active) setError('Your family spaces could not be loaded. Check your connection and try again.');
        } finally {
          if (active) setLoading(false);
        }
      };

      void loadMemberships();
      return () => {
        active = false;
      };
    }, [refreshKey, session?.id])
  );

  const goTo = (path: '/create-family' | '/join-family') => {
    setFamilyChoicesVisible(false);
    router.push(path);
  };

  const greetingName = profile?.name?.trim().split(/\s+/)[0] || 'there';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topLine}>
        <View>
          <Text style={styles.eyebrow}>FAMILY NEXUS</Text>
          <Text style={styles.title}>Welcome, {greetingName}</Text>
        </View>
        <View style={styles.brandMark}>
          <Feather name="home" size={20} color="#ffffff" />
        </View>
      </View>

      {familyCreated === '1' ? (
        <View style={styles.successBanner}>
          <Feather name="check-circle" size={18} color="#176b63" />
          <Text style={styles.successText}>Family created. You are the Family Owner.</Text>
        </View>
      ) : null}
      {familyJoined === '1' ? (
        <View style={styles.successBanner}>
          <Feather name="check-circle" size={18} color="#176b63" />
          <Text style={styles.successText}>You joined the family.</Text>
        </View>
      ) : null}

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionEyebrow}>YOUR PEOPLE</Text>
          <Text style={styles.sectionTitle}>Family spaces</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add or join a family"
          onPress={() => setFamilyChoicesVisible(true)}
          style={styles.addButton}
        >
          <Feather name="plus" size={24} color="#ffffff" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#176b63" />
          <Text style={styles.muted}>Loading family spaces...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.bodyText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => setRefreshKey((current) => current + 1)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : memberships.length === 0 ? (
        <View style={styles.emptyPanel}>
          <View style={styles.emptyIcon}>
            <Feather name="users" size={28} color="#176b63" />
          </View>
          <Text style={styles.emptyTitle}>Welcome to Family Nexus</Text>
          <Text style={styles.bodyText}>You are not part of a family yet. Create a family space or join one you have been invited to.</Text>
          <View style={styles.emptyActions}>
            <Pressable accessibilityRole="button" onPress={() => goTo('/create-family')} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Create a Family</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => goTo('/join-family')} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Join a Family</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.familyList}>
          {memberships.map((membership) => (
            <View key={membership.id} style={styles.familyCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${membership.families?.name ?? 'family space'}`}
                onPress={() => router.push({ pathname: '/family/[id]', params: { id: membership.family_id } })}
                style={styles.familyCardMain}
              >
                <View style={styles.familyIcon}>
                  <Feather name="users" size={25} color="#176b63" />
                </View>
                <View style={styles.familyInfo}>
                  <Text style={styles.familyName}>{membership.families?.name ?? 'Family space'}</Text>
                  <Text style={styles.familyRole}>{roleLabel(membership.role)} · Active</Text>
                  <Text style={styles.memberCount}>
                    {membership.member_count} / {membership.families?.member_limit ?? 0} members
                  </Text>
                </View>
                <View style={styles.openAction}>
                  <Text style={styles.openText}>Open family</Text>
                  <Feather name="arrow-up-right" size={17} color="#176b63" />
                </View>
              </Pressable>
              <View style={styles.familyInfoButton}>
                <InfoButton
                  title="Family members"
                  message="This shows current family members and the maximum number of people the family can hold. Removed members do not count toward the limit."
                />
              </View>
            </View>
          ))}
        </View>
      )}

      <Modal
        visible={familyChoicesVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFamilyChoicesVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close family actions"
            onPress={() => setFamilyChoicesVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.choiceSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEyebrow}>FAMILY</Text>
            <Text style={styles.sheetTitle}>What would you like to do?</Text>
            <Pressable accessibilityRole="button" onPress={() => goTo('/create-family')} style={styles.choiceButton}>
              <View style={styles.choiceIcon}><Feather name="plus-circle" size={21} color="#176b63" /></View>
              <Text style={styles.choiceText}>Create a Family</Text>
              <Feather name="chevron-right" size={19} color="#65736f" />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => goTo('/join-family')} style={styles.choiceButton}>
              <View style={styles.choiceIcon}><Feather name="user-plus" size={21} color="#176b63" /></View>
              <Text style={styles.choiceText}>Join a Family</Text>
              <Feather name="chevron-right" size={19} color="#65736f" />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setFamilyChoicesVisible(false)} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f3' },
  content: { padding: 22, paddingBottom: 44, gap: 22 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  eyebrow: { color: '#54726b', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#102c2a', fontSize: 29, fontWeight: '700', marginTop: 7 },
  brandMark: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#176b63', alignItems: 'center', justifyContent: 'center' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionEyebrow: { color: '#6a817b', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sectionTitle: { color: '#102c2a', fontSize: 21, fontWeight: '700', marginTop: 3 },
  addButton: { width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#176b63' },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { color: '#65736f', fontSize: 14 },
  emptyPanel: { padding: 22, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dce5dd', alignItems: 'flex-start' },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#e4f0e8', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  emptyTitle: { color: '#102c2a', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  bodyText: { color: '#53645f', fontSize: 15, lineHeight: 22 },
  emptyActions: { width: '100%', gap: 10, marginTop: 20 },
  primaryButton: { minHeight: 48, borderRadius: 7, backgroundColor: '#176b63', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  secondaryButton: { minHeight: 48, borderRadius: 7, borderWidth: 1, borderColor: '#a8bcb2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  secondaryButtonText: { color: '#176b63', fontWeight: '700', fontSize: 15 },
  familyList: { gap: 12 },
  familyCard: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ffffff', paddingLeft: 16, paddingRight: 5, borderRadius: 8, borderWidth: 1, borderColor: '#dce5dd' },
  familyCardMain: { flex: 1, minWidth: 0, minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  familyIcon: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#e4f0e8', alignItems: 'center', justifyContent: 'center' },
  familyInfo: { flex: 1, minWidth: 0 },
  familyName: { color: '#102c2a', fontSize: 17, fontWeight: '700' },
  familyRole: { color: '#64746f', fontSize: 13, marginTop: 3 },
  memberCount: { color: '#176b63', fontSize: 13, fontWeight: '600', marginTop: 5 },
  familyInfoButton: { alignItems: 'center', justifyContent: 'center' },
  openAction: { alignItems: 'flex-end', gap: 3 },
  openText: { color: '#176b63', fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12, 31, 29, 0.42)' },
  choiceSheet: { backgroundColor: '#ffffff', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 28, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#d4ded8', marginBottom: 19 },
  sheetEyebrow: { color: '#54726b', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sheetTitle: { color: '#102c2a', fontSize: 22, fontWeight: '700', marginTop: 5, marginBottom: 12 },
  choiceButton: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#e7ede8' },
  choiceIcon: { width: 35, alignItems: 'center' },
  choiceText: { flex: 1, color: '#203a36', fontSize: 16, fontWeight: '600' },
  cancelButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cancelText: { color: '#64746f', fontWeight: '600' },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 7, padding: 13, backgroundColor: '#e4f0e8' },
  successText: { flex: 1, color: '#175a50', fontWeight: '600' },
});