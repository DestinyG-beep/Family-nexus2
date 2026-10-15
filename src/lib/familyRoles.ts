export type FamilyRole = 'SUPERADMIN' | 'ADMIN' | 'MEMBER';

export function isFamilyAdmin(role?: string | null) {
  return role === 'SUPERADMIN' || role === 'ADMIN';
}

export function isPrimaryFamilyAdmin(role?: string | null) {
  return role === 'SUPERADMIN';
}

export function canManageFamilyMembers(role?: string | null) {
  return isFamilyAdmin(role);
}

export function canEditFamilySettings(role?: string | null) {
  return isPrimaryFamilyAdmin(role);
}

export function canManageMember(actorRole: string | null | undefined, targetRole: string, targetUserId: string, actorUserId?: string) {
  if (!canManageFamilyMembers(actorRole) || targetUserId === actorUserId || targetRole === 'SUPERADMIN') return false;
  return isPrimaryFamilyAdmin(actorRole) || targetRole === 'MEMBER';
}

export function canChangeMemberRole(actorRole: string | null | undefined, targetRole: string, targetUserId: string, actorUserId?: string) {
  return isPrimaryFamilyAdmin(actorRole) && targetUserId !== actorUserId && targetRole !== 'SUPERADMIN';
}