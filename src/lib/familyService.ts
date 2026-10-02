import { requireSupabase } from './supabase';

export type ActiveFamilyMembership = {
  id: string;
  family_id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string;
  families: {
    id: string;
    name: string;
    member_limit: number;
    owner_id: string;
    created_by: string;
    created_at: string;
    updated_at: string;
  } | null;
};

export async function getActiveFamilyMembership(userId?: string) {
  const client = requireSupabase();
  const targetUserId = userId ?? (await client.auth.getUser()).data.user?.id;

  if (!targetUserId) {
    return null;
  }

  const { data, error } = await client
    .from('family_members')
    .select('*, families(*)')
    .eq('user_id', targetUserId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return (data as ActiveFamilyMembership | null) ?? null;
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
    throw new Error(error.message);
  }

  return data as string;
}
