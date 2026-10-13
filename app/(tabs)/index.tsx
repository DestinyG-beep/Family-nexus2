import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import ActionCard from '../../src/components/ActionCard';
import MemberAvatar from '../../src/components/MemberAvatar';
import Panel from '../../src/components/Panel';
import RoleBadge from '../../src/components/RoleBadge';
import SectionHeader from '../../src/components/SectionHeader';
import { useAuth } from '../../src/context/AuthContext';
import { CalendarEvent, listCalendarEvents } from '../../src/lib/calendarService';
import { ActiveFamilyMembership, getActiveFamilyMemberships } from '../../src/lib/familyService';
import { FamilyMediaItem, listFamilyMedia } from '../../src/lib/mediaService';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function HomeScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const { familyCreated, familyJoined } = useLocalSearchParams<{ familyCreated?: string; familyJoined?: string }>();
  const { colors } = useAppTheme();
  const [memberships, setMemberships] = useState<ActiveFamilyMembership[]>([]);
  const [upcoming, setUpcoming] = useState<CalendarEvent | null>(null);
  const [recentMedia, setRecentMedia] = useState<FamilyMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [familyChoicesVisible, setFamilyChoicesVisible] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    const loadDashboard = async () => {
      if (!session?.id) { setMemberships([]); setLoading(false); return; }
      setLoading(true); setError('');
      try {
        const result = await getActiveFamilyMemberships(session.id);
        if (!active) return;
        setMemberships(result);
        const familyIds = result.map((membership) => membership.family_id);
        const [events, media] = await Promise.allSettled([
          listCalendarEvents(familyIds),
          Promise.all(familyIds.slice(0, 3).map((familyId) => listFamilyMedia(familyId))).then((groups) => groups.flat()),
        ]);
        if (!active) return;
        if (events.status === 'fulfilled') setUpcoming(events.value.find((event) => !event.start_at || new Date(event.start_at).getTime() >= Date.now()) ?? null);
        if (media.status === 'fulfilled') setRecentMedia(media.value.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3));
      } catch (loadError) {
        console.warn('Unable to load family dashboard', { retryCount: refreshKey });
        if (active) setError(loadError instanceof Error ? loadError.message : 'Your family spaces could not be loaded.');
      } finally { if (active) setLoading(false); }
    };
    void loadDashboard();
    return () => { active = false; };
  }, [refreshKey, session]));

  const greetingName = profile?.name?.trim().split(/\s+/)[0] || 'there';
  const goTo = (path: '/create-family' | '/join-family') => { setFamilyChoicesVisible(false); router.push(path); };

  return <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
    <View style={styles.header}><View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: colors.primary }]}>FAMILY NEXUS</Text><Text style={[styles.title, { color: colors.heading }]}>Good to see you, {greetingName}</Text><Text style={[styles.subtitle, { color: colors.body }]}>Here is what is happening with your family.</Text></View><View style={[styles.brandMark, { backgroundColor: colors.primary }]}><Feather name="home" size={21} color={colors.onPrimary} /></View></View>
    {familyCreated === '1' ? <View style={[styles.successBanner, { backgroundColor: `${colors.success}18` }]}><Feather name="check-circle" size={18} color={colors.success} /><Text style={[styles.successText, { color: colors.success }]}>Family created. You are the Family Owner.</Text></View> : null}
    {familyJoined === '1' ? <View style={[styles.successBanner, { backgroundColor: `${colors.success}18` }]}><Feather name="check-circle" size={18} color={colors.success} /><Text style={[styles.successText, { color: colors.success }]}>You joined the family.</Text></View> : null}

    <View style={styles.sectionRow}><SectionHeader eyebrow="YOUR PEOPLE" title="Family workspaces" subtitle="Private spaces for the people you love." /><Pressable accessibilityRole="button" accessibilityLabel="Add or join a family" onPress={() => setFamilyChoicesVisible(true)} style={[styles.addButton, { backgroundColor: colors.primary }]}><Feather name="plus" size={22} color={colors.onPrimary} /></Pressable></View>

    {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={[styles.muted, { color: colors.body }]}>Gathering your family spaces...</Text></View> : error && memberships.length === 0 ? <Panel style={styles.errorPanel}><Text style={[styles.bodyText, { color: colors.danger }]}>{error}</Text><Pressable onPress={() => setRefreshKey((current) => current + 1)} style={[styles.secondaryButton, { borderColor: colors.border }]}><Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Try again</Text></Pressable></Panel> : memberships.length === 0 ? <Panel style={styles.emptyPanel}><View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}18` }]}><Feather name="users" size={28} color={colors.primary} /></View><Text style={[styles.emptyTitle, { color: colors.heading }]}>Your family story starts here</Text><Text style={[styles.bodyText, { color: colors.body }]}>Create a private family space or join one you have been invited to.</Text><View style={styles.emptyActions}><Pressable onPress={() => goTo('/create-family')} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Create a Family</Text></Pressable><Pressable onPress={() => goTo('/join-family')} style={[styles.secondaryButton, { borderColor: colors.border }]}><Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Join a Family</Text></Pressable></View></Panel> : <View style={styles.familyList}>{memberships.map((membership) => <Panel key={membership.id} style={styles.familyCard}><View style={[styles.familyStripe, { backgroundColor: membership.role === 'SUPERADMIN' ? colors.primary : colors.secondary }]} /><View style={styles.familyCardBody}><View style={styles.familyTop}><MemberAvatar name={membership.families?.name ?? 'Family'} size={50} /><View style={styles.familyInfo}><Text style={[styles.familyName, { color: colors.heading }]}>{membership.families?.name ?? 'Family space'}</Text><RoleBadge role={membership.role} /></View></View><Text style={[styles.memberCount, { color: colors.body }]}>{membership.member_count} of {membership.families?.member_limit ?? 0} members</Text><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/family/[id]', params: { id: membership.family_id } })} style={[styles.openButton, { backgroundColor: colors.primary }]}><Text style={[styles.openText, { color: colors.onPrimary }]}>Open Family</Text><Feather name="arrow-up-right" size={16} color={colors.onPrimary} /></Pressable></View></Panel>)}</View>}

    {!loading && memberships.length > 0 ? <><View style={styles.sectionSpacing}><SectionHeader eyebrow="NEXT UP" title="Upcoming" subtitle="The next shared moment on your calendar." /></View><Panel style={styles.upcomingPanel}>{upcoming ? <><View style={styles.eventIcon}><Feather name="calendar" size={20} color={colors.secondary} /></View><View style={styles.eventCopy}><Text style={[styles.eventName, { color: colors.heading }]}>{upcoming.name}</Text><Text style={[styles.eventFamily, { color: colors.secondary }]}>{upcoming.family_name}</Text><Text style={[styles.eventMeta, { color: colors.body }]}>{upcoming.start_at ? new Date(upcoming.start_at).toLocaleString() : 'Date and time not set'}</Text></View><Pressable onPress={() => router.push('/calendar' as never)}><Text style={[styles.viewLink, { color: colors.primary }]}>View Calendar</Text></Pressable></> : <><Feather name="calendar" size={22} color={colors.muted} /><Text style={[styles.muted, { color: colors.body }]}>No upcoming events yet.</Text><Pressable onPress={() => router.push('/calendar' as never)}><Text style={[styles.viewLink, { color: colors.primary }]}>Open Calendar</Text></Pressable></>}</Panel></> : null}

    {!loading && memberships.length > 0 ? <><View style={styles.sectionSpacing}><SectionHeader eyebrow="RECENTLY SHARED" title="Family activity" subtitle="A small glimpse of what your families have shared." /></View><Panel style={styles.activityPanel}>{recentMedia.length > 0 ? <View style={styles.mediaRow}>{recentMedia.map((item) => <Pressable key={item.id} onPress={() => router.push(`/family/${item.family_id}/media` as never)} style={styles.mediaPreview}>{item.media_type === 'IMAGE' ? <Image source={{ uri: item.signed_url }} style={styles.mediaImage} /> : <View style={[styles.mediaImage, { backgroundColor: colors.secondary }]}><Feather name="play" size={19} color="#ffffff" /></View>}<Text numberOfLines={1} style={[styles.mediaLabel, { color: colors.body }]}>{item.uploader_name}</Text></Pressable>)}</View> : <><Feather name="image" size={22} color={colors.muted} /><Text style={[styles.muted, { color: colors.body }]}>Your latest family photos and videos will appear here.</Text></>}</Panel></> : null}

    <Modal visible={familyChoicesVisible} transparent animationType="fade" onRequestClose={() => setFamilyChoicesVisible(false)}><View style={styles.modalBackdrop}><Pressable accessibilityRole="button" onPress={() => setFamilyChoicesVisible(false)} style={StyleSheet.absoluteFill} /><View style={[styles.choiceSheet, { backgroundColor: colors.surface }]}><View style={[styles.sheetHandle, { backgroundColor: colors.border }]} /><Text style={[styles.sheetEyebrow, { color: colors.primary }]}>FAMILY</Text><Text style={[styles.sheetTitle, { color: colors.heading }]}>What would you like to do?</Text><ActionCard icon="plus-circle" title="Create a Family" description="Start a private space for your people." onPress={() => goTo('/create-family')} /><ActionCard icon="user-plus" title="Join a Family" description="Enter through an invitation or family details." accent="secondary" onPress={() => goTo('/join-family')} /><Pressable onPress={() => setFamilyChoicesVisible(false)} style={styles.cancelButton}><Text style={[styles.cancelText, { color: colors.muted }]}>Cancel</Text></Pressable></View></View></Modal>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { width: '100%', maxWidth: 980, alignSelf: 'center', padding: 22, paddingBottom: 52, gap: 16 }, header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, paddingTop: 8 }, headerCopy: { flex: 1 }, eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, title: { fontSize: 30, fontWeight: '800', marginTop: 7 }, subtitle: { fontSize: 15, lineHeight: 21, marginTop: 5 }, brandMark: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, successBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 10, padding: 13 }, successText: { flex: 1, fontWeight: '700' }, sectionRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 12 }, addButton: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 12 }, muted: { fontSize: 14, textAlign: 'center' }, errorPanel: { gap: 12 }, emptyPanel: { gap: 10 }, emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }, emptyTitle: { fontSize: 21, fontWeight: '800' }, bodyText: { fontSize: 15, lineHeight: 22 }, emptyActions: { width: '100%', gap: 10, marginTop: 10 }, primaryButton: { minHeight: 48, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, primaryButtonText: { fontWeight: '800', fontSize: 15 }, secondaryButton: { minHeight: 48, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, secondaryButtonText: { fontWeight: '800', fontSize: 15 }, familyList: { gap: 12 }, familyCard: { padding: 0, overflow: 'hidden' }, familyStripe: { height: 8 }, familyCardBody: { padding: 17, gap: 12 }, familyTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, familyInfo: { flex: 1, gap: 7 }, familyName: { fontSize: 18, fontWeight: '800' }, memberCount: { fontSize: 13 }, openButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 9 }, openText: { fontWeight: '800' }, sectionSpacing: { marginTop: 14 }, upcomingPanel: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12 }, eventIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#e1f0ec', alignItems: 'center', justifyContent: 'center' }, eventCopy: { flex: 1, gap: 3 }, eventName: { fontSize: 16, fontWeight: '800' }, eventFamily: { fontSize: 13, fontWeight: '700' }, eventMeta: { fontSize: 13 }, viewLink: { fontSize: 12, fontWeight: '800' }, activityPanel: { minHeight: 98, justifyContent: 'center' }, mediaRow: { flexDirection: 'row', gap: 10 }, mediaPreview: { flex: 1, gap: 5 }, mediaImage: { width: '100%', aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d9c9bc' }, mediaLabel: { fontSize: 12 }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(35, 25, 20, 0.5)' }, choiceSheet: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 28, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 10 }, sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginBottom: 12 }, sheetEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, sheetTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 }, cancelButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 2 }, cancelText: { fontWeight: '700' },
});
