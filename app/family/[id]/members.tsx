import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import MemberAvatar from '../../../src/components/MemberAvatar';
import BackButton from '../../../src/components/BackButton';
import Panel from '../../../src/components/Panel';
import RoleBadge from '../../../src/components/RoleBadge';
import SectionHeader from '../../../src/components/SectionHeader';
import { useAuth } from '../../../src/context/AuthContext';
import { ActiveFamilyMembership, FamilyAdminMember, FamilyMemberSummary, getActiveFamilyMemberships, getFamilyAdminMembers, getFamilyMemberDirectory, setFamilyMemberStatus, updateFamilyMemberRole } from '../../../src/lib/familyService';
import { canChangeMemberRole, canManageMember, isFamilyAdmin } from '../../../src/lib/familyRoles';
import { useAppTheme } from '../../../src/theme/useAppTheme';

export default function FamilyMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const [membership, setMembership] = useState<ActiveFamilyMembership | null>(null);
  const [members, setMembers] = useState<(FamilyAdminMember | FamilyMemberSummary)[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session?.id || !id) return;
    setLoading(true);
    setError('');
    try {
      const memberships = await getActiveFamilyMemberships(session.id);
      const current = memberships.find((item) => item.family_id === id) ?? null;
      setMembership(current);
      if (!current) throw new Error('You do not have access to this family.');
      setMembers(isFamilyAdmin(current.role) ? await getFamilyAdminMembers(id) : await getFamilyMemberDirectory(id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Family members could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id, session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const canManage = isFamilyAdmin(membership?.role);
  const familyName = membership?.families?.name ?? 'Family workspace';

  const changeRole = (member: FamilyAdminMember) => {
    const nextRole = member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    Alert.alert(`${nextRole === 'ADMIN' ? 'Promote' : 'Demote'} member?`, `${member.member_name} will become ${nextRole === 'ADMIN' ? 'an Admin' : 'a Member'}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => void (async () => {
        setBusyId(member.id);
        try { await updateFamilyMemberRole(id, member.id, nextRole); await load(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'The member role could not be changed.'); } finally { setBusyId(''); }
      })() },
    ]);
  };

  const changeStatus = (member: FamilyAdminMember, status: 'ACTIVE' | 'RESTRICTED' | 'REMOVED') => {
    const action = status === 'REMOVED' ? 'remove' : status === 'RESTRICTED' ? 'restrict' : 'restore';
    Alert.alert(`${action[0].toUpperCase()}${action.slice(1)} member?`, status === 'REMOVED' ? `${member.member_name} will leave this family.` : `${member.member_name} will be ${status === 'RESTRICTED' ? 'restricted from' : 'restored to'} family access.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: status === 'REMOVED' ? 'destructive' : 'default', onPress: () => void (async () => {
        setBusyId(member.id);
        try { await setFamilyMemberStatus(id, member.id, status); await load(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'The member status could not be changed.'); } finally { setBusyId(''); }
      })() },
    ]);
  };

  if (loading) return <View style={[styles.state, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /><Text style={[styles.muted, { color: colors.body }]}>Loading members...</Text></View>;
  if (error && !membership) return <View style={[styles.state, { backgroundColor: colors.background }]}><Text style={[styles.error, { color: colors.danger }]}>{error}</Text><BackButton label="Family workspace" fallback={`/family/${id}`} /></View>;

  return <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
    <BackButton label={familyName} fallback={`/family/${id}`} />
    <SectionHeader eyebrow="FAMILY DIRECTORY" title="Members" subtitle={`${familyName} · ${members.length} active member${members.length === 1 ? '' : 's'}`} />
    {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    <View style={styles.list}>{members.map((member) => {
      const adminMember = canManage ? member as FamilyAdminMember : null;
      const memberId = adminMember?.id ?? (member as FamilyMemberSummary).member_id;
      const memberUserId = adminMember?.user_id;
      const isSelf = memberUserId === session?.id;
      const canChange = !!adminMember && !!memberUserId && canManageMember(membership?.role, member.role, memberUserId, session?.id);
      const canChangeRole = !!adminMember && !!memberUserId && canChangeMemberRole(membership?.role, member.role, memberUserId, session?.id);
      const isBusy = busyId === memberId;
      return <Panel key={memberId} style={styles.memberCard}>
        <MemberAvatar key={`${memberId}-${member.avatar_url ?? 'avatar-fallback'}`} name={member.member_name} imageUrl={member.avatar_url} />
        <View style={styles.memberCopy}><Text style={[styles.memberName, { color: colors.heading }]}>{member.member_name}{isSelf ? ' (you)' : ''}</Text>{adminMember ? <Text style={[styles.email, { color: colors.muted }]}>{adminMember.email || 'Email not available'}</Text> : null}<View style={styles.badges}><RoleBadge role={member.role} />{adminMember?.status === 'RESTRICTED' ? <View style={[styles.restricted, { backgroundColor: `${colors.warning}20` }]}><Text style={[styles.restrictedText, { color: colors.warning }]}>Restricted</Text></View> : null}</View></View>
        {canChange && adminMember ? <View style={styles.actions}>{isBusy ? <ActivityIndicator color={colors.primary} /> : <>{canChangeRole ? <Pressable accessibilityRole="button" onPress={() => changeRole(adminMember)} style={styles.iconButton}><Feather name={member.role === 'ADMIN' ? 'arrow-down-circle' : 'arrow-up-circle'} size={18} color={colors.secondary} /></Pressable> : null}<Pressable accessibilityRole="button" onPress={() => changeStatus(adminMember, adminMember.status === 'RESTRICTED' ? 'ACTIVE' : 'RESTRICTED')} style={styles.iconButton}><Feather name={adminMember.status === 'RESTRICTED' ? 'unlock' : 'lock'} size={17} color={colors.warning} /></Pressable><Pressable accessibilityRole="button" onPress={() => changeStatus(adminMember, 'REMOVED')} style={styles.iconButton}><Feather name="user-minus" size={17} color={colors.danger} /></Pressable></>}</View> : null}
      </Panel>;
    })}</View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 22, paddingBottom: 48, gap: 16 },
  back: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' }, backText: { fontSize: 14, fontWeight: '800' },
  list: { gap: 10 }, memberCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }, memberImage: { width: 44, height: 44, borderRadius: 22 }, memberCopy: { flex: 1, minWidth: 0, gap: 4 }, memberName: { fontSize: 15, fontWeight: '800' }, email: { fontSize: 12 }, badges: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 }, restricted: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }, restrictedText: { fontSize: 11, fontWeight: '800' }, actions: { flexDirection: 'row', alignItems: 'center', gap: 4 }, iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }, muted: { fontSize: 14 }, error: { fontSize: 14, lineHeight: 20, textAlign: 'center' }, secondaryButton: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderRadius: 8 }, secondaryText: { fontWeight: '800' },
});
