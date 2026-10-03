import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/context/AuthContext';
import { FamilyInvitationPreview, getFamilyInvitation, joinFamilyWithInvitation } from '../../src/lib/familyService';

export default function InvitationRoute() {
  const router = useRouter();
  const { token: routeToken } = useLocalSearchParams<{ token?: string }>();
  const token = Array.isArray(routeToken) ? routeToken[0] : routeToken;
  const { session } = useAuth();
  const [preview, setPreview] = useState<FamilyInvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const loadInvitation = useCallback(async () => {
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      setPreview({ status: 'invalid' });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getFamilyInvitation(token);
      setPreview(result);
    } catch (loadError) {
      console.warn('Invitation preview failed', loadError instanceof Error ? loadError.message : 'unknown error');
      setError(loadError instanceof Error ? loadError.message : 'This invitation could not be checked. Try again later.');
    } finally {
      setLoading(false);
    }
  }, [token, session?.id]);

  useEffect(() => {
    void loadInvitation();
  }, [loadInvitation]);

  const acceptInvitation = async () => {
    if (!session) {
      router.push({ pathname: '/', params: { next: `/join/${token}` } });
      return;
    }

    setJoining(true);
    setError('');
    try {
      const result = await joinFamilyWithInvitation(token);
      if (result.status === 'joined' || result.status === 'already_member') {
        router.replace({ pathname: '/(tabs)', params: { familyJoined: result.status === 'joined' ? '1' : undefined } });
        return;
      }
      if (result.status === 'family_full') {
        setError('This family has reached its maximum size. Ask the owner for help.');
      } else if (result.status === 'invitation_expired' || result.status === 'invitation_exhausted') {
        setError('This invitation has expired or has already been used. Ask for a new link.');
      } else if (result.status === 'restricted') {
        setError('Your access to this family is restricted. Contact a family administrator.');
      } else {
        setError('This invitation is no longer valid. Ask for a new link.');
      }
    } catch (joinError) {
      console.warn('Invitation acceptance failed', joinError instanceof Error ? joinError.message : 'unknown error');
      setError(joinError instanceof Error ? joinError.message : 'We could not complete this invitation. Try again.');
    } finally {
      setJoining(false);
    }
  };

  const invitationMessage = (status: FamilyInvitationPreview['status']) => {
    if (status === 'expired') return 'This invitation has expired. Ask for a new link.';
    if (status === 'revoked') return 'This invitation is no longer active. Ask for a new link.';
    if (status === 'exhausted') return 'This invitation has already been used.';
    return 'This invitation could not be found. Check the link or ask for another.';
  };

  const canJoin = preview?.status === 'valid';
  const alreadyMember = preview?.status === 'already_member';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.inviteIcon}><Feather name="users" size={34} color="#176b63" /></View>
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color="#176b63" /><Text style={styles.body}>Checking invitation...</Text></View>
      ) : preview?.family_name ? (
        <>
          <Text style={styles.title}>{preview.family_name}</Text>
          <Text style={styles.body}>You&apos;ve been invited to join this family on Family Nexus.</Text>
          {alreadyMember ? <Text style={styles.note}>You already belong to this family.</Text> : null}
          {canJoin || alreadyMember ? (
            <Pressable accessibilityRole="button" onPress={() => void (alreadyMember ? router.replace('/(tabs)') : acceptInvitation())} disabled={joining} style={[styles.primaryButton, joining && styles.disabled]}>
              <Text style={styles.primaryText}>
                {alreadyMember ? 'Go to Home' : joining ? 'Joining family...' : session ? `Join ${preview.family_name}` : `Join ${preview.family_name}`}
              </Text>
            </Pressable>
          ) : (
            <Text accessibilityRole="alert" style={styles.error}>{invitationMessage(preview.status)}</Text>
          )}
        </>
      ) : (
        <>
          <Text style={styles.title}>Family invitation</Text>
          <Text accessibilityRole="alert" style={styles.error}>{error || (preview ? invitationMessage(preview.status) : 'This invitation could not be loaded.')}</Text>
          <Pressable accessibilityRole="button" onPress={() => void loadInvitation()} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Try again</Text>
          </Pressable>
        </>
      )}
      {error && preview?.family_name ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!session && canJoin ? <Text style={styles.footnote}>You&apos;ll sign in or create an account before joining. This link does not reveal private family content.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f3' },
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', padding: 24 },
  inviteIcon: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#e4f0e8', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { color: '#102c2a', fontSize: 27, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  body: { color: '#53645f', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  loading: { minHeight: 100, justifyContent: 'center', alignItems: 'center', gap: 12 },
  note: { color: '#176b63', marginTop: 14, fontWeight: '600' },
  primaryButton: { width: '100%', minHeight: 50, borderRadius: 7, backgroundColor: '#176b63', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 22 },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  secondaryButton: { minHeight: 48, borderRadius: 7, borderWidth: 1, borderColor: '#a8bcb2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 15 },
  secondaryText: { color: '#176b63', fontWeight: '700' },
  footnote: { color: '#74817c', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 18 },
  error: { color: '#9b332b', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 16 },
  disabled: { opacity: 0.65 },
});