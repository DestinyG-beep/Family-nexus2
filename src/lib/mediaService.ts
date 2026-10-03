import { requireSupabase } from './supabase';

const MEDIA_BUCKET = 'family-media';
const SIGNED_URL_TTL_SECONDS = 300;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export type FamilyMediaItem = {
  id: string;
  family_id: string;
  uploaded_by: string;
  uploader_name: string;
  bucket: string;
  storage_key: string;
  media_type: 'IMAGE' | 'VIDEO';
  mime_type: string;
  file_name: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
  like_count: number;
  liked_by_me: boolean;
  is_pinned: boolean;
  signed_url: string;
};

export type MediaUploadInput = {
  familyId: string;
  mediaType: 'IMAGE' | 'VIDEO';
  mimeType: string;
  fileName: string;
  blob: Blob;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

function mediaSetupError(error: { code?: string; message?: string }, fallback: string) {
  if (error.code === 'PGRST202' || /bucket not found|does not exist/i.test(error.message ?? '')) {
    return new Error('Media storage is not set up yet. Apply the new Media migration in Supabase, then try again.');
  }

  if (/row-level security|permission denied/i.test(error.message ?? '')) {
    return new Error('Your family does not have permission for this media action.');
  }

  return new Error(fallback);
}

export async function listFamilyMedia(familyId: string): Promise<FamilyMediaItem[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_family_media', { p_family_id: familyId });

  if (error) {
    throw mediaSetupError(error, 'Family media could not be loaded. Check your connection and try again.');
  }

  const rows = (data ?? []) as Omit<FamilyMediaItem, 'signed_url'>[];
  if (rows.some((item) => item.bucket !== MEDIA_BUCKET)) {
    throw new Error('A media item has an unsupported storage location.');
  }

  if (rows.length === 0) return [];

  const { data: signedUrls, error: signedError } = await client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(rows.map((item) => item.storage_key), SIGNED_URL_TTL_SECONDS);

  if (signedError || !signedUrls) {
    throw mediaSetupError(signedError ?? {}, 'Family media previews could not be opened.');
  }

  const signedByPath = new Map(signedUrls.map((entry) => [entry.path, entry]));
  return rows.map((item) => {
    const signed = signedByPath.get(item.storage_key);
    if (signed?.error || !signed?.signedUrl) {
      throw mediaSetupError(
        { message: signed?.error ?? undefined },
        'A family media preview could not be opened.'
      );
    }

    return { ...item, signed_url: signed.signedUrl };
  });
}

export async function getFamilyMediaSignedUrl(storageKey: string) {
  const { data, error } = await requireSupabase().storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw mediaSetupError(error ?? {}, 'This family media could not be opened.');
  }

  return data.signedUrl;
}

export async function uploadFamilyMedia(input: MediaUploadInput) {
  if (input.blob.size < 1 || input.blob.size > MAX_FILE_SIZE) {
    throw new Error('Choose a file that is 50 MB or smaller.');
  }

  const client = requireSupabase();
  const { data: userResult, error: userError } = await client.auth.getUser();
  if (userError || !userResult.user) {
    throw new Error('Sign in before uploading family media.');
  }

  const { data, error: beginError } = await client.rpc('begin_family_media_upload', {
    p_family_id: input.familyId,
    p_media_type: input.mediaType,
    p_mime_type: input.mimeType.toLowerCase(),
    p_file_name: input.fileName,
    p_file_size: input.blob.size,
    p_width: input.width ?? null,
    p_height: input.height ?? null,
    p_duration_seconds: input.durationSeconds ?? null,
  });

  if (beginError) {
    throw mediaSetupError(beginError, 'The upload could not be prepared. Check your family access and try again.');
  }

  const reservation = Array.isArray(data) ? data[0] : data;
  if (!reservation?.media_id || reservation.bucket_id !== MEDIA_BUCKET || !reservation.storage_key) {
    throw new Error('The upload could not be prepared. Try again later.');
  }

  try {
    const { error: uploadError } = await client.storage
      .from(reservation.bucket_id)
      .upload(reservation.storage_key, input.blob, {
        cacheControl: '3600',
        contentType: input.mimeType.toLowerCase(),
        upsert: false,
      });

    if (uploadError) {
      throw mediaSetupError(uploadError, 'The file did not finish uploading. Check your connection and try again.');
    }

    const { error: completeError } = await client.rpc('complete_family_media_upload', {
      p_media_id: reservation.media_id,
    });

    if (completeError) {
      // A network error can arrive after the database committed. The finalize RPC is safe to retry.
      const { error: retryError } = await client.rpc('complete_family_media_upload', {
        p_media_id: reservation.media_id,
      });

      if (retryError) {
        throw mediaSetupError(completeError, 'The file uploaded but could not be added to the family gallery.');
      }
    }
  } catch (uploadFailure) {
    const { error: removeError } = await client.storage
      .from(reservation.bucket_id)
      .remove([reservation.storage_key]);

    if (removeError) {
      const { error: deleteCompleteError } = await client.rpc('delete_family_media', {
        p_media_id: reservation.media_id,
      });

      if (deleteCompleteError) {
        const { error: cancelError } = await client.rpc('cancel_family_media_upload', {
          p_media_id: reservation.media_id,
        });

        if (cancelError) {
          throw new Error('The upload did not complete, and its temporary file could not be cleaned up. Ask a family administrator for help.');
        }
      }

      throw uploadFailure instanceof Error
        ? uploadFailure
        : new Error('The file did not finish uploading. Check your connection and try again.');
    }

    const { error: deleteCompleteError } = await client.rpc('delete_family_media', {
      p_media_id: reservation.media_id,
    });

    if (deleteCompleteError) {
      const { error: cancelError } = await client.rpc('cancel_family_media_upload', {
        p_media_id: reservation.media_id,
      });

      if (cancelError) {
        throw new Error('The upload did not complete and its temporary record could not be cleaned up. Ask a family administrator for help.');
      }
    }

    throw uploadFailure instanceof Error
      ? uploadFailure
      : new Error('The file did not finish uploading. Check your connection and try again.');
  }
}

export async function setMediaLike(mediaId: string, liked: boolean) {
  const client = requireSupabase();
  const { data, error: userError } = await client.auth.getUser();
  if (userError || !data.user) {
    throw new Error('Sign in to react to family media.');
  }

  const query = liked
    ? client.from('media_likes').delete().eq('media_id', mediaId).eq('user_id', data.user.id)
    : client.from('media_likes').insert({ media_id: mediaId, user_id: data.user.id });

  const { error } = await query;
  if (error) {
    throw mediaSetupError(error, 'Your reaction could not be saved. Try again.');
  }
}

export async function setMediaPinned(mediaId: string, pinned: boolean) {
  const client = requireSupabase();
  const { data, error: userError } = await client.auth.getUser();
  if (userError || !data.user) {
    throw new Error('Sign in to manage family highlights.');
  }

  const query = pinned
    ? client.from('media_pins').delete().eq('media_id', mediaId)
    : client.from('media_pins').insert({ media_id: mediaId, pinned_by: data.user.id });

  const { error } = await query;
  if (error) {
    throw mediaSetupError(error, 'The family highlight could not be updated. Try again.');
  }
}

export async function deleteFamilyMedia(mediaId: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('delete_family_media', { p_media_id: mediaId });

  if (error) {
    throw mediaSetupError(error, 'This media could not be deleted. Check your access and try again.');
  }

  const deleted = Array.isArray(data) ? data[0] : data;
  if (!deleted?.bucket || !deleted.storage_key) {
    throw new Error('The media was removed from the gallery, but its stored file could not be cleaned up.');
  }

  const { error: removeError } = await client.storage.from(deleted.bucket).remove([deleted.storage_key]);
  if (removeError) {
    throw new Error('The media was removed from the gallery, but its stored file could not be cleaned up.');
  }
}