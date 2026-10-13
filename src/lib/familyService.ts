import { requireSupabase } from './supabase';
import { getSignedAvatarUrls } from './avatarService';

export type FamilySummary = {
  name: string;
  member_limit: number;
};

export type ActiveFamilyMembership = {
  id: string;
  family_id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string;
  families: FamilySummary | null;
  member_count: number;
};

export type FamilyOperationResult = {
  status: 'joined' | 'already_member' | 'restricted' | 'family_full' | 'invalid_credentials' | 'invalid_invitation' | 'invalid_password' | 'invitation_expired' | 'invitation_exhausted';
  family_id?: string;
  family_name?: string;
  role?: 'MEMBER';
  member_count?: number;
  member_limit?: number;
};

export type FamilyInvitationPreview = {
  status: 'valid' | 'already_member' | 'invalid' | 'expired' | 'revoked' | 'exhausted';
  family_name?: string;
};

export type FamilyMemberSummary = {
  member_id: string;
  member_name: string;
  role: string;
  avatar_url: string | null;
};

export type FamilyAdminMember = {
  id: string;
  user_id: string;
  member_name: string;
  email: string | null;
  role: 'SUPERADMIN' | 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'RESTRICTED';
  joined_at: string;
  avatar_url: string | null;
};

export type FamilySettings = {
  id: string;
  name: string;
  member_limit: number;
  default_background_media_id: string | null;
  owner_id: string;
};

export async function getActiveFamilyMemberships(userId?: string): Promise<ActiveFamilyMembership[]> {
  const client = requireSupabase();
  const targetUserId = userId ?? (await client.auth.getUser()).data.user?.id;

  if (!targetUserId) {
    return [];
  }

  const { data, error } = await client
    .from('family_members')
    .select('id, family_id, user_id, role, status, joined_at, families(name, member_limit)')
    .eq('user_id', targetUserId)
    .eq('status', 'ACTIVE')
    .order('joined_at', { ascending: true });

  if (error) {
    throw error;
  }

  type MembershipQueryRow = Omit<ActiveFamilyMembership, 'member_count' | 'families'> & {
    families: FamilySummary[] | FamilySummary | null;
  };
  const memberships = (data ?? []) as unknown as MembershipQueryRow[];
  const familyIds = memberships.map((membership) => membership.family_id);
  const memberCounts = new Map<string, number>();

  if (familyIds.length > 0) {
    const { data: members, error: countError } = await client
      .from('family_members')
      .select('family_id')
      .in('family_id', familyIds)
      .neq('status', 'REMOVED');

    if (countError) {
      throw countError;
    }

    for (const member of members ?? []) {
      memberCounts.set(member.family_id, (memberCounts.get(member.family_id) ?? 0) + 1);
    }
  }

  return memberships.map((membership) => ({
    ...membership,
    families: Array.isArray(membership.families) ? membership.families[0] ?? null : membership.families,
    member_count: memberCounts.get(membership.family_id) ?? 0,
  }));
}

export async function createFamily(input: {
  name: string;
  password: string;
  memberLimit: number;
}) {
  const client = requireSupabase();

  const { data, error } = await client.rpc('create_family', {
    p_name: input.name,
    p_password: input.password,
    p_member_limit: input.memberLimit,
  });

  if (error) {
    console.warn('Family creation failed', { code: error.code });
    throw new Error('We could not create the family. Check the details and try again.');
  }

  return data as string;
}

export async function joinFamilyByCredentials(familyName: string, password: string) {
  const { data, error } = await requireSupabase().rpc('join_family_by_credentials', {
    p_family_name: familyName,
    p_password: password,
  });

  if (error) {
    console.warn('Family join failed', { code: error.code });
    throw new Error('We could not join that family. Check the details and try again.');
  }

  return data as FamilyOperationResult;
}

export async function getFamilyInvitation(token: string) {
  const { data, error } = await requireSupabase().rpc('get_family_invitation', { p_token: token });

  if (error) {
    console.warn('Invitation lookup failed', { code: error.code });
    throw new Error('This invitation could not be checked. Try again later.');
  }

  return data as FamilyInvitationPreview;
}

export async function joinFamilyWithInvitation(token: string, password: string) {
  const { data, error } = await requireSupabase().rpc('join_family_with_reusable_invitation_password', {
    p_token: token,
    p_password: password,
  });

  if (error) {
    console.warn('Invitation join failed', { code: error.code });
    if (error.code === 'PGRST202') {
      throw new Error('Invitation joining is not available yet. Ask a family Admin to finish setting it up.');
    }
    throw new Error('We could not complete this invitation. Try again later.');
  }

  return data as FamilyOperationResult;
}

export async function createFamilyInvitation(familyId: string) {
  const { data, error } = await requireSupabase().rpc('create_reusable_family_invitation', {
    p_family_id: familyId,
    p_expires_in_days: 7,
  });

  if (error) {
    console.warn('Invitation creation failed', { code: error.code });
    if (error.code === '42501') {
      throw new Error('Only a family Admin can create an invitation.');
    }
    if (error.code === 'PGRST202') {
      throw new Error('Invitation links are not available yet. Ask a family Admin to finish setting them up.');
    }
    throw new Error('We could not create an invitation. Check your access and try again.');
  }

  return data as string;
}

export async function revokeFamilyInvitations(familyId: string) {
  const { data, error } = await requireSupabase().rpc('revoke_family_invitations', { p_family_id: familyId });
  if (error) {
    throw new Error(error.message || 'The invitation link could not be revoked.');
  }
  return data as { status: 'revoked' };
}

export async function getFamilyMemberDirectory(familyId: string) {
  const { data, error } = await requireSupabase().rpc('get_family_member_directory', { p_family_id: familyId });

  if (error) {
    console.warn('Family member list failed', { code: error.code });
    throw new Error('Family member details are temporarily unavailable.');
  }

  const rows = (data ?? []) as (FamilyMemberSummary & { avatar_storage_key?: string | null })[];
  const avatarUrls = await getSignedAvatarUrls(rows.flatMap((row) => row.avatar_storage_key ? [row.avatar_storage_key] : []));
  return rows.map(({ avatar_storage_key, ...row }) => ({ ...row, avatar_url: avatar_storage_key ? avatarUrls.get(avatar_storage_key) ?? null : null }));
}

export async function getFamily(familyId: string) {
  const { data, error } = await requireSupabase()
    .from('families')
    .select('name, member_limit')
    .eq('id', familyId)
    .maybeSingle();

  if (error) {
    console.warn('Family details query failed', { code: error.code });
    throw new Error('We could not load this family. Try again later.');
  }

  return (data as FamilySummary | null) ?? null;
}

export async function getFamilySettings(familyId: string) {
  const { data, error } = await requireSupabase().rpc('get_family_settings', { p_family_id: familyId });
  if (error) throw new Error(error.message || 'Family settings could not be loaded.');
  const row = Array.isArray(data) ? data[0] : data;
  return (row as FamilySettings | null) ?? null;
}

export async function getFamilyAdminMembers(familyId: string) {
  const { data, error } = await requireSupabase().rpc('get_family_admin_members', { p_family_id: familyId });
  if (error) throw new Error(error.message || 'Family members could not be loaded.');
  const rows = (data ?? []) as (FamilyAdminMember & { avatar_storage_key?: string | null })[];
  const avatarUrls = await getSignedAvatarUrls(rows.flatMap((row) => row.avatar_storage_key ? [row.avatar_storage_key] : []));
  return rows.map(({ avatar_storage_key, ...row }) => ({ ...row, avatar_url: avatar_storage_key ? avatarUrls.get(avatar_storage_key) ?? null : null }));
}

export async function updateFamilyMemberRole(familyId: string, memberId: string, role: 'ADMIN' | 'MEMBER') {
  const { data, error } = await requireSupabase().rpc('update_family_member_role', {
    p_family_id: familyId,
    p_member_id: memberId,
    p_role: role,
  });
  if (error) throw new Error(error.message || 'The member role could not be updated.');
  return data as { status: 'updated' };
}

export async function setFamilyMemberStatus(familyId: string, memberId: string, status: 'ACTIVE' | 'RESTRICTED' | 'REMOVED') {
  const { data, error } = await requireSupabase().rpc('set_family_member_status', {
    p_family_id: familyId,
    p_member_id: memberId,
    p_status: status,
  });
  if (error) throw new Error(error.message || 'The member status could not be updated.');
  return data as { status: 'updated' };
}

export async function updateFamilySettings(input: { familyId: string; name: string; memberLimit: number }) {
  const { data, error } = await requireSupabase().rpc('update_family_settings', {
    p_family_id: input.familyId,
    p_name: input.name.trim(),
    p_member_limit: input.memberLimit,
  });
  if (error) throw new Error(error.message || 'Family settings could not be saved.');
  const row = Array.isArray(data) ? data[0] : data;
  return row as FamilySettings;
}
