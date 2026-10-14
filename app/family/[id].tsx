import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import InfoButton from '../../src/components/InfoButton';
import ActionCard from '../../src/components/ActionCard';
import RoleBadge from '../../src/components/RoleBadge';
import { useAuth } from '../../src/context/AuthContext';
import { ActiveFamilyMembership, FamilyMemberSummary, createFamilyInvitation, getActiveFamilyMemberships, getFamilyMemberDirectory, revokeFamilyInvitations } from '../../src/lib/familyService';
import { useAppTheme } from '../../src/theme/useAppTheme';

export default function FamilyDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [membership, setMembership] = useState<ActiveFamilyMembership | null>(null);
  const [members, setMembers] = useState<FamilyMemberSummary[]>([]);
  const [membersUnavailable, setMembersUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const { colors } = useAppTheme();
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        if (!session?.id || !id) {
          setError('This family space could not be opened.');
          setLoading(false);
          return;
        }
        setLoading(true);
        setError('');
        try {
          const memberships = await getActiveFamilyMemberships(session.id);
          const current = memberships.find((item) => item.family_id === id) ?? null;
          if (active) {
            setMembership(current);
            if (!current) {
              setError('You do not have access to this family space.');
            } else {
              try {
                setMembers(await getFamilyMemberDirectory(current.family_id));
                setMembersUnavailable(false);
              } catch {
                setMembers([]);
                setMembersUnavailable(true);
              }
            }
          }
        } catch (loadError) {
          console.warn('Unable to load family details', loadError instanceof Error ? loadError.message : 'unknown error');
          if (active) setError('This family space could not be loaded. Check your connection and try again.');
        } finally {
          if (active) setLoading(false);
        }
      };
      void load();
      return () => {
        active = false;
      };
    }, [id, session])
  );

  const makeInvitation = async () => {
    if (!id) return;
    setSharing(true);
    setError('');
    setMessage('');
    try {
      const token = await createFamilyInvitation(id);
      const path = `join/${token}`;
      const publicAppUrl = process.env.EXPO_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
      const link = publicAppUrl
        ? `${publicAppUrl}/${path}`
        : Platform.OS === 'web' && typeof window !== 'undefined'
          ? `${window.location.origin}/${path}`
          : Linking.createURL(path);
      setInviteUrl(link);
      setMessage('Invitation created. It can be used once and expires in 7 days.');
    } catch (inviteError) {
      console.warn('Unable to create family invitation', inviteError instanceof Error ? inviteError.message : 'unknown error');
      setError(inviteError instanceof Error ? inviteError.message : 'An invitation could not be created. Try again later.');
    } finally {
      setSharing(false);
    }
  };

  const copyInvitation = async () => {
    try {
      const didCopy = await Clipboard.setStringAsync(inviteUrl);
      setCopied(didCopy);
      setMessage(didCopy ? 'Invite link copied.' : 'Select and copy the invitation link above.');
    } catch {
      setMessage('Select and copy the invitation link above.');
    }
  };

  const revokeInvitation = (reset: boolean) => {
    if (!id) return;
    Alert.alert(reset ? 'Reset invitation link?' : 'Revoke invitation link?', reset ? 'The current link will stop working and a new reusable link will be created.' : 'Anyone with this link will no longer be able to use it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: reset ? 'Reset link' : 'Revoke link', style: reset ? 'default' : 'destructive', onPress: () => void (async () => {
        setRevoking(true); setError(''); setMessage('');
        try {
          await revokeFamilyInvitations(id);
          setInviteUrl('');
          if (reset) await makeInvitation();
          else setMessage('Invitation link revoked.');
        } catch (revokeError) {
          setError(revokeError instanceof Error ? revokeError.message : 'The invitation link could not be changed.');
        } finally { setRevoking(false); }
      })() },
    ]);
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color="#176b63" /><Text style={styles.body}>Loading family...</Text></View>;
  }

  if (!membership?.families) {
    return (
      <View style={styles.loading}>
        <Text accessibilityRole="alert" style={styles.error}>{error || 'This family space could not be found.'}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)')} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Return Home</Text>
        </Pressable>
      </View>
    );
  }

  const canInvite = membership.role === 'SUPERADMIN' || membership.role === 'ADMIN';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <Feather name="arrow-left" size={19} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary }]}>Home</Text>
      </Pressable>

      <View style={[styles.hero, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <View style={[styles.groupIcon, { backgroundColor: `${colors.primary}18` }]}><Feather name="users" size={34} color={colors.primary} /></View>
        <Text style={[styles.title, { color: colors.heading }]}>{membership.families.name}</Text>
        <View style={styles.heroMeta}><RoleBadge role={membership.role} /><Text style={[styles.role, { color: colors.body }]}>{membership.member_count} members · Active</Text></View>
        <Text style={[styles.heroSubtitle, { color: colors.body }]}>A private space for the people who matter most.</Text>
      </View>

      <View style={[styles.memberPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View>
          <Text style={[styles.label, { color: colors.muted }]}>Family capacity</Text>
          <Text style={[styles.count, { color: colors.heading }]}>{membership.member_count} / {membership.families.member_limit} members</Text>
        </View>
        <InfoButton title="Family members" message="Current members and maximum family size. Reaching the maximum prevents new people from joining, but never removes existing members." />
      </View>

      <View style={styles.actions}>
        <ActionCard icon="image" title="Media" description="Browse and share private photos and videos." onPress={() => router.push(`/family/${id}/media` as never)} />
        <ActionCard icon="users" title="Members" description="See the people in this family space." accent="secondary" onPress={() => router.push(`/family/${id}/members` as never)} />
        <ActionCard icon="calendar" title="Calendar" description="Keep up with shared family events." accent="secondary" onPress={() => router.push('/calendar' as never)} />
        {membership.role === 'SUPERADMIN' || membership.role === 'ADMIN' ? <ActionCard icon="settings" title="Family settings" description={membership.role === 'SUPERADMIN' ? 'Manage the shared name and member capacity.' : 'View the shared family settings.'} onPress={() => router.push(`/family/${id}/settings` as never)} /> : null}
      </View>

      <View style={[styles.directoryPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.directoryTitle, { color: colors.heading }]}>Family members</Text>
        {membersUnavailable ? (
          <Text style={[styles.body, { color: colors.body }]}>Member details are temporarily unavailable.</Text>
        ) : members.length === 0 ? (
          <Text style={[styles.body, { color: colors.body }]}>No active members are listed yet.</Text>
        ) : (
          members.map((member, index) => (
            <View key={`${member.member_name}-${index}`} style={styles.memberRow}>
              {member.avatar_url ? <Image source={{ uri: member.avatar_url }} style={styles.memberAvatar} /> : <View style={styles.memberAvatar}><Feather name="user" size={18} color="#176b63" /></View>}
              <Text style={[styles.memberName, { color: colors.heading }]}>{member.member_name}</Text>
              <RoleBadge role={member.role} />
            </View>
          ))
        )}
      </View>

      {canInvite ? (
        <View style={[styles.invitePanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.inviteIcon, { backgroundColor: `${colors.secondary}18` }]}><Feather name="user-plus" size={22} color={colors.secondary} /></View>
          <Text style={[styles.inviteTitle, { color: colors.heading }]}>Invite family members</Text>
          <View style={styles.inviteHeading}>
            <Text style={[styles.body, { color: colors.body }]}>Share one reusable link. It expires after seven days and can be revoked at any time.</Text>
            <InfoButton title="Invitation link" message="Anyone with this link can open the invitation and request to join. They must sign in and enter the family password. Each link can be used once." />
          </View>
          {inviteUrl ? (
            <>
              <Text selectable accessibilityLabel="Invitation link" style={styles.inviteLink}>{inviteUrl}</Text>
              <Pressable accessibilityRole="button" disabled={revoking} onPress={() => void copyInvitation()} style={styles.primaryButton}>
                <Text style={styles.primaryText}>{copied ? 'Copied' : 'Copy invite link'}</Text>
              </Pressable>
              <View style={styles.inviteActions}>
                <Pressable accessibilityRole="button" disabled={revoking} onPress={() => revokeInvitation(true)} style={styles.resetButton}><Feather name="refresh-cw" size={15} color="#a8503b" /><Text style={styles.resetText}>Reset link</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={revoking} onPress={() => revokeInvitation(false)} style={styles.revokeButton}><Feather name="x-circle" size={15} color="#a33e38" /><Text style={styles.revokeText}>Revoke</Text></Pressable>
              </View>
            </>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => void makeInvitation()} disabled={sharing} style={[styles.primaryButton, sharing && styles.disabled]}>
              <Text style={styles.primaryText}>{sharing ? 'Creating invite...' : 'Create invite link'}</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f3' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 22, paddingBottom: 48, gap: 16 },
  backButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  backText: { color: '#176b63', fontSize: 15, fontWeight: '700' },
  hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 18, borderWidth: 1, borderRadius: 22 },
  groupIcon: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e4f0e8', marginBottom: 18 },
  title: { color: '#102c2a', fontSize: 28, fontWeight: '700', textAlign: 'center' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  role: { color: '#64746f', fontSize: 14, marginTop: 7 },
  heroSubtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  memberPanel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 17, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dce5dd' },
  actions: { gap: 10 },
  directoryPanel: { padding: 17, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dce5dd', gap: 10 },
  directoryTitle: { color: '#102c2a', fontSize: 17, fontWeight: '700', marginBottom: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 46, borderTopWidth: 1, borderTopColor: '#e7ede8', paddingTop: 9 },
  memberAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#e4f0e8', alignItems: 'center', justifyContent: 'center' },
  memberName: { flex: 1, color: '#203a36', fontWeight: '600', fontSize: 14 },
  memberRole: { color: '#64746f', fontSize: 13 },
  label: { color: '#64746f', fontSize: 13 },
  count: { color: '#102c2a', fontSize: 17, fontWeight: '700', marginTop: 5 },
  invitePanel: { padding: 20, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dce5dd', gap: 10 },
  inviteIcon: { width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e4f0e8' },
  inviteTitle: { color: '#102c2a', fontSize: 19, fontWeight: '700' },
  body: { color: '#53645f', fontSize: 14, lineHeight: 21 },
  inviteHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inviteLink: { color: '#176b63', fontSize: 13, lineHeight: 20, padding: 11, borderRadius: 6, backgroundColor: '#f1f6f1' },
  primaryButton: { minHeight: 48, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#176b63', marginTop: 5 },
  primaryText: { color: '#ffffff', fontWeight: '700' },
  inviteActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 2 },
  resetButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6 },
  resetText: { color: '#a8503b', fontSize: 13, fontWeight: '800' },
  revokeButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6 },
  revokeText: { color: '#a33e38', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.65 },
  success: { color: '#176b63', fontSize: 14, lineHeight: 20 },
  error: { color: '#9b332b', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  secondaryButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: '#a8bcb2', borderRadius: 7 },
  secondaryText: { color: '#176b63', fontWeight: '700' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#f4f7f3', padding: 24 },
});
