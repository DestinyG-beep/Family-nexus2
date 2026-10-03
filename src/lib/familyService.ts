import { requireSupabase } from './supabase';

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
  member_name: string;
  role: string;
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
  const { data, error } = await requireSupabase().rpc('join_family_with_invitation_password', {
    p_token: token,
    p_password: password,
  });

  if (error) {
    console.warn('Invitation join failed', { code: error.code });
    if (error.code === 'PGRST202') {
      throw new Error('Invitation joining is not available yet. Ask an administrator to finish setting it up.');
    }
    throw new Error('We could not complete this invitation. Try again later.');
  }

  return data as FamilyOperationResult;
}

export async function createFamilyInvitation(familyId: string) {
  const { data, error } = await requireSupabase().rpc('create_family_invitation', {
    p_family_id: familyId,
    p_expires_in_days: 7,
    p_max_uses: 1,
  });

  if (error) {
    console.warn('Invitation creation failed', { code: error.code });
    if (error.code === '42501') {
      throw new Error('Only a family owner or administrator can create an invitation.');
    }
    if (error.code === 'PGRST202') {
      throw new Error('Invitation links are not available yet. Ask an administrator to finish setting them up.');
    }
    throw new Error('We could not create an invitation. Check your access and try again.');
  }

  return data as string;
}

export async function getFamilyMemberDirectory(familyId: string) {
  const { data, error } = await requireSupabase().rpc('get_family_member_directory', { p_family_id: familyId });

  if (error) {
    console.warn('Family member list failed', { code: error.code });
    throw new Error('Family member details are temporarily unavailable.');
  }

  return (data ?? []) as FamilyMemberSummary[];
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
