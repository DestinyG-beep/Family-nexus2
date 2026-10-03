import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import InfoButton from '../../src/components/InfoButton';
import { useAuth } from '../../src/context/AuthContext';
import { ActiveFamilyMembership, createFamilyInvitation, getActiveFamilyMemberships } from '../../src/lib/familyService';

function roleLabel(role: string) {
  if (role === 'SUPERADMIN') return 'Family Owner';
  if (role === 'ADMIN') return 'Administrator';
  return 'Member';
}

export default function FamilyDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [membership, setMembership] = useState<ActiveFamilyMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
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
            if (!current) setError('You do not have access to this family space.');
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
    }, [id, session?.id])
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <Feather name="arrow-left" size={19} color="#176b63" />
        <Text style={styles.backText}>Home</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.groupIcon}><Feather name="users" size={34} color="#176b63" /></View>
        <Text style={styles.title}>{membership.families.name}</Text>
        <Text style={styles.role}>{roleLabel(membership.role)} · Active</Text>
      </View>

      <View style={styles.memberPanel}>
        <View>
          <Text style={styles.label}>Family members</Text>
          <Text style={styles.count}>{membership.member_count} / {membership.families.member_limit} members</Text>
        </View>
        <InfoButton title="Family members" message="Current members and maximum family size. Reaching the maximum prevents new people from joining, but never removes existing members." />
      </View>

      {canInvite ? (
        <View style={styles.invitePanel}>
          <View style={styles.inviteIcon}><Feather name="user-plus" size={22} color="#176b63" /></View>
          <Text style={styles.inviteTitle}>Invite family members</Text>
          <Text style={styles.body}>Create a private link that lets one person join this family. The link expires after seven days.</Text>
          {inviteUrl ? (
            <>
              <Text selectable accessibilityLabel="Invitation link" style={styles.inviteLink}>{inviteUrl}</Text>
              <Pressable accessibilityRole="button" onPress={() => void copyInvitation()} style={styles.primaryButton}>
                <Text style={styles.primaryText}>{copied ? 'Copied' : 'Copy invite link'}</Text>
              </Pressable>
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
  hero: { alignItems: 'center', paddingVertical: 22 },
  groupIcon: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e4f0e8', marginBottom: 18 },
  title: { color: '#102c2a', fontSize: 28, fontWeight: '700', textAlign: 'center' },
  role: { color: '#64746f', fontSize: 14, marginTop: 7 },
  memberPanel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 17, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dce5dd' },
  label: { color: '#64746f', fontSize: 13 },
  count: { color: '#102c2a', fontSize: 17, fontWeight: '700', marginTop: 5 },
  invitePanel: { padding: 20, borderRadius: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dce5dd', gap: 10 },
  inviteIcon: { width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e4f0e8' },
  inviteTitle: { color: '#102c2a', fontSize: 19, fontWeight: '700' },
  body: { color: '#53645f', fontSize: 14, lineHeight: 21 },
  inviteLink: { color: '#176b63', fontSize: 13, lineHeight: 20, padding: 11, borderRadius: 6, backgroundColor: '#f1f6f1' },
  primaryButton: { minHeight: 48, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#176b63', marginTop: 5 },
  primaryText: { color: '#ffffff', fontWeight: '700' },
  disabled: { opacity: 0.65 },
  success: { color: '#176b63', fontSize: 14, lineHeight: 20 },
  error: { color: '#9b332b', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  secondaryButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: '#a8bcb2', borderRadius: 7 },
  secondaryText: { color: '#176b63', fontWeight: '700' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#f4f7f3', padding: 24 },
});
