import { requireSupabase } from './supabase';

const AVATAR_BUCKET = 'profile-avatars';
const SIGNED_URL_TTL_SECONDS = 300;

export type AvatarUploadResult = {
  avatarId: string;
  storageKey: string;
  signedUrl: string;
};

type AvatarRow = { avatar_id: string; storage_key: string; mime_type?: string };

function avatarSetupError(error: { code?: string; message?: string } | null, fallback: string) {
  if (error?.code === 'PGRST202' || /does not exist|bucket not found/i.test(error?.message ?? '')) {
    return new Error('Profile pictures are not set up yet. Apply the profile avatar migration, then try again.');
  }
  return new Error(fallback);
}

export async function getSignedAvatarUrls(storageKeys: string[]) {
  if (storageKeys.length === 0) return new Map<string, string>();
  const { data, error } = await requireSupabase().storage
    .from(AVATAR_BUCKET)
    .createSignedUrls(storageKeys, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw avatarSetupError(error, 'Profile pictures could not be opened.');
  const result = new Map<string, string>();
  for (const entry of data) {
    if (entry.path && entry.signedUrl) result.set(entry.path, entry.signedUrl);
  }
  return result;
}

export async function getProfileAvatarSignedUrl(userId: string) {
  const { data, error } = await requireSupabase().rpc('get_profile_avatar', { p_user_id: userId });
  if (error) throw avatarSetupError(error, 'Profile picture could not be loaded.');
  const row = (Array.isArray(data) ? data[0] : data) as AvatarRow | null | undefined;
  if (!row?.storage_key) return null;
  const { data: signed, error: signedError } = await requireSupabase().storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(row.storage_key, SIGNED_URL_TTL_SECONDS);
  if (signedError || !signed?.signedUrl) throw avatarSetupError(signedError, 'Profile picture could not be opened.');
  return { avatarId: row.avatar_id, signedUrl: signed.signedUrl };
}

export async function uploadProfileAvatar(input: { blob: Blob; mimeType: string }): Promise<AvatarUploadResult> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('begin_profile_avatar_upload', {
    p_mime_type: input.mimeType.toLowerCase(),
    p_file_size: input.blob.size,
  });
  if (error) throw avatarSetupError(error, 'The profile picture upload could not be prepared.');

  const reservation = (Array.isArray(data) ? data[0] : data) as { avatar_id?: string; bucket_id?: string; storage_key?: string } | undefined;
  if (!reservation?.avatar_id || reservation.bucket_id !== AVATAR_BUCKET || !reservation.storage_key) {
    throw new Error('The profile picture upload could not be prepared.');
  }

  let completed = false;
  try {
    const { error: uploadError } = await client.storage.from(AVATAR_BUCKET).upload(reservation.storage_key, input.blob, {
      cacheControl: '3600',
      contentType: input.mimeType.toLowerCase(),
      upsert: false,
    });
    if (uploadError) throw avatarSetupError(uploadError, 'The profile picture could not be uploaded.');

    const { data: completedData, error: completeError } = await client.rpc('complete_profile_avatar_upload', { p_avatar_id: reservation.avatar_id });
    if (completeError) throw avatarSetupError(completeError, 'The profile picture could not be saved.');
    completed = true;
    const saved = (Array.isArray(completedData) ? completedData[0] : completedData) as { avatar_id?: string; storage_key?: string; previous_storage_key?: string | null } | undefined;
    if (!saved?.avatar_id || !saved.storage_key) throw new Error('The profile picture could not be saved.');
    if (saved.previous_storage_key) {
      await client.storage.from(AVATAR_BUCKET).remove([saved.previous_storage_key]);
    }
    const { data: signed, error: signedError } = await client.storage.from(AVATAR_BUCKET).createSignedUrl(saved.storage_key, SIGNED_URL_TTL_SECONDS);
    if (signedError || !signed?.signedUrl) throw avatarSetupError(signedError, 'The profile picture could not be opened.');
    return { avatarId: saved.avatar_id, storageKey: saved.storage_key, signedUrl: signed.signedUrl };
  } catch (uploadFailure) {
    if (!completed) await client.storage.from(AVATAR_BUCKET).remove([reservation.storage_key]);
    throw uploadFailure instanceof Error ? uploadFailure : new Error('The profile picture upload did not complete.');
  }
}