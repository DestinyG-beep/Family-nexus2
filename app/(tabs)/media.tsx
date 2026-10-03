import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import MediaDetailModal from '../../src/components/MediaDetailModal';
import { useAuth } from '../../src/context/AuthContext';
import { ActiveFamilyMembership, getActiveFamilyMemberships } from '../../src/lib/familyService';
import {
  deleteFamilyMedia,
  FamilyMediaItem,
  getFamilyMediaSignedUrl,
  listFamilyMedia,
  setMediaLike,
  setMediaPinned,
  uploadFamilyMedia,
} from '../../src/lib/mediaService';

type MediaFilter = 'IMAGE' | 'VIDEO';

const MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  png: 'image/png',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  webm: 'video/webm',
  webp: 'image/webp',
};

function roleAllowsMediaAdmin(role: string) {
  return role === 'SUPERADMIN' || role === 'ADMIN';
}

function fileNameFromUri(uri: string) {
  const lastSegment = uri.split(/[/?#]/).filter(Boolean).at(-1) ?? '';
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
}

function getAssetMimeType(asset: ImagePicker.ImagePickerAsset, blob: Blob) {
  const supplied = (asset.mimeType || blob.type || '').toLowerCase();
  if (supplied === 'image/jpg') return 'image/jpeg';
  if (supplied && supplied !== 'application/octet-stream') return supplied;

  const fileName = asset.fileName || fileNameFromUri(asset.uri);
  const extension = fileName.split('.').at(-1)?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? '';
}

function formatFileSize(size: number | null) {
  if (size === null) return 'Size unavailable';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [memberships, setMemberships] = useState<ActiveFamilyMembership[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<MediaFilter>('IMAGE');
  const [items, setItems] = useState<FamilyMediaItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<FamilyMediaItem | null>(null);
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [familyError, setFamilyError] = useState('');
  const [galleryError, setGalleryError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [detailError, setDetailError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadMemberships = async () => {
        setLoadingFamilies(true);
        setFamilyError('');

        if (!session?.id) {
          setMemberships([]);
          setFamilyId(null);
          setLoadingFamilies(false);
          return;
        }

        try {
          const result = await getActiveFamilyMemberships(session.id);
          if (!active) return;
          setMemberships(result);
          setFamilyId((current) =>
            result.some((membership) => membership.family_id === current)
              ? current
              : result[0]?.family_id ?? null
          );
        } catch (error) {
          if (active) {
            setMemberships([]);
            setFamilyId(null);
            setFamilyError(error instanceof Error ? error.message : 'Your family spaces could not be loaded.');
          }
        } finally {
          if (active) setLoadingFamilies(false);
        }
      };

      void loadMemberships();
      return () => {
        active = false;
      };
    }, [session])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!familyId) {
        setItems([]);
        setLoadingMedia(false);
        setGalleryError('');
        return () => {
          active = false;
        };
      }

      setLoadingMedia(true);
      setGalleryError('');
      void listFamilyMedia(familyId)
        .then((result) => {
          if (active) setItems(result);
        })
        .catch((error: unknown) => {
          if (active) {
            setGalleryError(error instanceof Error ? error.message : 'Family media could not be loaded.');
          }
        })
        .finally(() => {
          if (active) setLoadingMedia(false);
        });

      return () => {
        active = false;
      };
    }, [familyId])
  );

  const currentFamily = memberships.find((membership) => membership.family_id === familyId) ?? null;
  const filteredItems = items.filter((item) => item.media_type === filter);
  const canDeleteSelected = !!selectedItem && (
    selectedItem.uploaded_by === session?.id || roleAllowsMediaAdmin(currentFamily?.role ?? '')
  );
  const canPinSelected = roleAllowsMediaAdmin(currentFamily?.role ?? '');

  const refreshGallery = async (targetFamilyId: string) => {
    const updated = await listFamilyMedia(targetFamilyId);
    setItems(updated);
    setSelectedItem((current) => current ? updated.find((item) => item.id === current.id) ?? null : null);
    return updated;
  };

  const refreshFromServer = async () => {
    if (!familyId || loadingMedia) return;
    setLoadingMedia(true);
    setGalleryError('');
    try {
      await refreshGallery(familyId);
    } catch (error) {
      setGalleryError(error instanceof Error ? error.message : 'Family media could not be loaded.');
    } finally {
      setLoadingMedia(false);
    }
  };

  const startUpload = async () => {
    if (!currentFamily || uploading) return;
    setUploadMessage('');
    setGalleryError('');

    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setGalleryError('Allow access to your photos and videos before uploading.');
          return;
        }
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: filter === 'IMAGE' ? ['images'] : ['videos'],
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (pickerResult.canceled || !pickerResult.assets[0]) return;
      const asset = pickerResult.assets[0];
      setUploading(true);

      const response = await fetch(asset.uri);
      if (!response.ok) {
        throw new Error('The selected file could not be read. Choose it again and retry.');
      }

      const blob = await response.blob();
      const mimeType = getAssetMimeType(asset, blob);
      if (!mimeType.startsWith(filter === 'IMAGE' ? 'image/' : 'video/')) {
        throw new Error(`Choose a supported ${filter === 'IMAGE' ? 'image' : 'video'} file.`);
      }

      const mediaType = filter;
      const fileName = asset.fileName || fileNameFromUri(asset.uri) || (mediaType === 'IMAGE' ? 'Family photo' : 'Family video');
      await uploadFamilyMedia({
        familyId: currentFamily.family_id,
        mediaType,
        mimeType,
        fileName,
        blob,
        width: asset.width || undefined,
        height: asset.height || undefined,
        durationSeconds: asset.duration ? Math.round(asset.duration / 1000) : undefined,
      });

      try {
        await refreshGallery(currentFamily.family_id);
        setUploadMessage('Added to family media.');
      } catch {
        setGalleryError('The upload completed, but the gallery could not refresh. Use Refresh to load the latest media.');
      }
    } catch (error) {
      setGalleryError(error instanceof Error ? error.message : 'The upload did not complete. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const runDetailAction = async (
    action: () => Promise<void>,
    optimisticUpdate: (item: FamilyMediaItem) => FamilyMediaItem
  ) => {
    if (!selectedItem || !familyId || busyAction) return;
    const original = selectedItem;
    setBusyAction(true);
    setDetailError('');
    try {
      await action();
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'That media action could not be completed.');
      setBusyAction(false);
      return;
    }

    try {
      const updated = await listFamilyMedia(familyId);
      setItems(updated);
      setSelectedItem(updated.find((item) => item.id === original.id) ?? null);
    } catch {
      const optimistic = optimisticUpdate(original);
      setItems((current) => current.map((item) => item.id === original.id ? optimistic : item));
      setSelectedItem(optimistic);
      setDetailError('Saved, but the latest gallery state could not be loaded. Close this view and refresh.');
    } finally {
      setBusyAction(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedItem || !familyId || busyAction) return;
    const deletingId = selectedItem.id;
    setBusyAction(true);
    setDetailError('');
    try {
      await deleteFamilyMedia(deletingId);
      setSelectedItem(null);
      setConfirmingDelete(false);
      setItems((current) => current.filter((item) => item.id !== deletingId));
      try {
        setItems(await listFamilyMedia(familyId));
      } catch {
        setGalleryError('The media was deleted, but the gallery could not refresh. Use Refresh to load the latest media.');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('removed from the gallery')) {
        setSelectedItem(null);
        setConfirmingDelete(false);
        setItems((current) => current.filter((item) => item.id !== deletingId));
        setGalleryError(error.message);
      } else {
        setDetailError(error instanceof Error ? error.message : 'This media could not be deleted. Try again.');
      }
    } finally {
      setBusyAction(false);
    }
  };

  const openVideo = async () => {
    if (!selectedItem) return;
    setDetailError('');
    try {
      const signedUrl = await getFamilyMediaSignedUrl(selectedItem.storage_key);
      await Linking.openURL(signedUrl);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'This video could not be opened.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>YOUR FAMILY, TOGETHER</Text>
          <Text style={styles.title}>Media</Text>
          <Text style={styles.subtitle}>Private photos and videos shared by your family.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!currentFamily || uploading || loadingFamilies}
          onPress={() => void startUpload()}
          style={[styles.uploadButton, (!currentFamily || uploading || loadingFamilies) && styles.disabled]}
        >
          {uploading ? <ActivityIndicator size="small" color="#ffffff" /> : <Feather name="upload" size={17} color="#ffffff" />}
          <Text style={styles.uploadText}>{uploading ? 'Uploading…' : 'Upload'}</Text>
        </Pressable>
      </View>

      {memberships.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.familyChoices}>
          {memberships.map((membership) => {
            const selected = membership.family_id === familyId;
            return (
              <Pressable
                key={membership.family_id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setFamilyId(membership.family_id);
                  setSelectedItem(null);
                  setUploadMessage('');
                }}
                style={[styles.familyChip, selected && styles.familyChipSelected]}
              >
                <Text style={[styles.familyChipText, selected && styles.familyChipTextSelected]}>
                  {membership.families?.name ?? 'Family'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : currentFamily ? (
        <View style={styles.currentFamily}>
          <Feather name="users" size={15} color="#176b63" />
          <Text style={styles.currentFamilyText}>{currentFamily.families?.name ?? 'Family'}</Text>
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <View style={styles.filterRow}>
          {([
            { key: 'IMAGE', label: 'Images', icon: 'image' },
            { key: 'VIDEO', label: 'Videos', icon: 'video' },
          ] as const).map((option) => {
            const selected = filter === option.key;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setFilter(option.key)}
                style={[styles.filterButton, selected && styles.filterButtonSelected]}
              >
                <Feather name={option.icon} size={15} color={selected ? '#ffffff' : '#526a64'} />
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {currentFamily ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh family media"
            disabled={loadingMedia}
            onPress={() => void refreshFromServer()}
            style={styles.refreshButton}
          >
            <Feather name="refresh-cw" size={16} color="#176b63" />
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        ) : null}
      </View>

      {loadingFamilies || loadingMedia ? (
        <View style={styles.statePanel}>
          <ActivityIndicator color="#176b63" />
          <Text style={styles.muted}>{loadingFamilies ? 'Loading family spaces…' : 'Loading family media…'}</Text>
        </View>
      ) : familyError ? (
        <View style={styles.statePanel}>
          <Text accessibilityRole="alert" style={styles.errorText}>{familyError}</Text>
        </View>
      ) : !currentFamily ? (
        <View style={styles.statePanel}>
          <View style={styles.emptyIcon}><Feather name="users" size={25} color="#176b63" /></View>
          <Text style={styles.emptyTitle}>Join or create a family first</Text>
          <Text style={styles.emptyText}>Family photos and videos are only available to family members.</Text>
          <View style={styles.familyActions}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/create-family')} style={styles.emptyUploadButton}>
              <Text style={styles.emptyUploadText}>Create a Family</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/join-family')} style={styles.joinButton}>
              <Text style={styles.joinButtonText}>Join a Family</Text>
            </Pressable>
          </View>
        </View>
      ) : galleryError ? (
        <View style={styles.statePanel}>
          <Text accessibilityRole="alert" style={styles.errorText}>{galleryError}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refreshFromServer()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.statePanel}>
          <View style={styles.emptyIcon}>
            <Feather name={filter === 'IMAGE' ? 'image' : 'video'} size={25} color="#176b63" />
          </View>
          <Text style={styles.emptyTitle}>No {filter === 'IMAGE' ? 'photos' : 'videos'} yet</Text>
          <Text style={styles.emptyText}>Upload something to share it privately with your family.</Text>
          <Pressable accessibilityRole="button" disabled={uploading} onPress={() => void startUpload()} style={styles.emptyUploadButton}>
            <Text style={styles.emptyUploadText}>Choose {filter === 'IMAGE' ? 'photo' : 'video'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.gallery}>
          {filteredItems.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.media_type === 'IMAGE' ? 'photo' : 'video'} ${item.file_name}`}
              onPress={() => {
                setDetailError('');
                setConfirmingDelete(false);
                setSelectedItem(item);
              }}
              style={styles.mediaCard}
            >
              <View style={styles.thumbnailWrap}>
                {item.media_type === 'IMAGE' ? (
                  <Image source={{ uri: item.signed_url }} style={styles.thumbnail} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumbnail, styles.videoThumbnail]}>
                    <Feather name="play-circle" size={34} color="#ffffff" />
                  </View>
                )}
                {item.is_pinned ? (
                  <View style={styles.pinBadge}><Feather name="bookmark" size={12} color="#ffffff" /></View>
                ) : null}
              </View>
              <View style={styles.mediaInfo}>
                <Text numberOfLines={1} style={styles.fileName}>{item.file_name || (item.media_type === 'IMAGE' ? 'Family photo' : 'Family video')}</Text>
                <Text numberOfLines={1} style={styles.mediaMeta}>By {item.uploader_name} · {new Date(item.created_at).toLocaleDateString()}</Text>
                <View style={styles.mediaFoot}>
                  <Text style={styles.mediaSize}>{formatFileSize(item.file_size)}</Text>
                  <View style={styles.likeCount}>
                    <Feather name="heart" size={13} color={item.liked_by_me ? '#b34352' : '#71817c'} />
                    <Text style={styles.mediaSize}>{item.like_count}</Text>
                  </View>
                </View>
              </View>
              <Feather name="chevron-right" size={19} color="#788982" />
            </Pressable>
          ))}
        </View>
      )}

      {uploadMessage ? <Text style={styles.successText}>{uploadMessage}</Text> : null}

      <MediaDetailModal
        item={selectedItem}
        visible={!!selectedItem}
        canDelete={canDeleteSelected}
        canPin={canPinSelected}
        busy={busyAction}
        confirmingDelete={confirmingDelete}
        error={detailError}
        onClose={() => {
          setSelectedItem(null);
          setConfirmingDelete(false);
        }}
        onLike={() => selectedItem && void runDetailAction(
          () => setMediaLike(selectedItem.id, selectedItem.liked_by_me),
          (item) => ({
            ...item,
            liked_by_me: !item.liked_by_me,
            like_count: Math.max(0, item.like_count + (item.liked_by_me ? -1 : 1)),
          })
        )}
        onPin={() => selectedItem && void runDetailAction(
          () => setMediaPinned(selectedItem.id, selectedItem.is_pinned),
          (item) => ({ ...item, is_pinned: !item.is_pinned })
        )}
        onRequestDelete={() => setConfirmingDelete(true)}
        onCancelDelete={() => setConfirmingDelete(false)}
        onConfirmDelete={() => void confirmDelete()}
        onOpenVideo={() => void openVideo()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f3' },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 22, paddingBottom: 48, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#54726b', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#102c2a', fontSize: 29, fontWeight: '700', marginTop: 5 },
  subtitle: { color: '#65736f', fontSize: 14, lineHeight: 20, marginTop: 4 },
  uploadButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 15, borderRadius: 7, backgroundColor: '#176b63' },
  uploadText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  familyChoices: { gap: 8, paddingRight: 10 },
  familyChip: { minHeight: 39, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#e6ede7' },
  familyChipSelected: { backgroundColor: '#176b63' },
  familyChipText: { color: '#435a54', fontSize: 13, fontWeight: '600' },
  familyChipTextSelected: { color: '#ffffff' },
  currentFamily: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  currentFamilyText: { color: '#315a53', fontSize: 14, fontWeight: '600' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#e6ede7' },
  filterButtonSelected: { backgroundColor: '#176b63' },
  filterText: { color: '#526a64', fontSize: 13, fontWeight: '600' },
  filterTextSelected: { color: '#ffffff' },
  refreshButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
  refreshText: { color: '#176b63', fontSize: 13, fontWeight: '700' },
  statePanel: { minHeight: 190, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 24, borderRadius: 9, borderWidth: 1, borderColor: '#dce5dd', backgroundColor: '#ffffff' },
  muted: { color: '#65736f', fontSize: 14 },
  errorText: { color: '#9b332b', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 6, backgroundColor: '#176b63' },
  retryText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  emptyIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#e4f0e8', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#102c2a', fontSize: 17, fontWeight: '700', marginTop: 2 },
  emptyText: { color: '#65736f', fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 330 },
  emptyUploadButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 6, backgroundColor: '#176b63', marginTop: 4 },
  emptyUploadText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  familyActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 4 },
  joinButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 6, borderWidth: 1, borderColor: '#a8bcb2' },
  joinButtonText: { color: '#176b63', fontSize: 13, fontWeight: '700' },
  gallery: { gap: 10 },
  mediaCard: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, borderRadius: 9, borderWidth: 1, borderColor: '#dce5dd', backgroundColor: '#ffffff' },
  thumbnailWrap: { position: 'relative' },
  thumbnail: { width: 80, height: 80, borderRadius: 7, backgroundColor: '#dce9e1' },
  videoThumbnail: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#254c45' },
  pinBadge: { position: 'absolute', top: 5, right: 5, width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#176b63' },
  mediaInfo: { flex: 1, minWidth: 0, gap: 5 },
  fileName: { color: '#203a36', fontSize: 15, fontWeight: '700' },
  mediaMeta: { color: '#65736f', fontSize: 12 },
  mediaFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mediaSize: { color: '#71817c', fontSize: 12 },
  likeCount: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  successText: { color: '#176b63', fontSize: 13, fontWeight: '600' },
});