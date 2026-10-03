import { Feather } from '@expo/vector-icons';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FamilyMediaItem } from '../lib/mediaService';

type Props = {
  item: FamilyMediaItem | null;
  visible: boolean;
  canDelete: boolean;
  canPin: boolean;
  busy: boolean;
  confirmingDelete: boolean;
  error: string;
  onClose: () => void;
  onLike: () => void;
  onPin: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onOpenVideo: () => void;
};

function formatFileSize(size: number | null) {
  if (size === null) return 'Size unavailable';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaDetailModal({
  item,
  visible,
  canDelete,
  canPin,
  busy,
  confirmingDelete,
  error,
  onClose,
  onLike,
  onPin,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onOpenVideo,
}: Props) {
  if (!item) return null;

  const isVideo = item.media_type === 'VIDEO';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !busy && onClose()}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>{isVideo ? 'FAMILY VIDEO' : 'FAMILY PHOTO'}</Text>
              <Text numberOfLines={1} style={styles.title}>{item.file_name || (isVideo ? 'Family video' : 'Family photo')}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close media details" disabled={busy} onPress={onClose} style={[styles.closeButton, busy && styles.disabled]}>
              <Feather name="x" size={22} color="#27433e" />
            </Pressable>
          </View>

          {isVideo ? (
            <Pressable accessibilityRole="button" onPress={onOpenVideo} style={styles.videoPreview}>
              <View style={styles.playButton}><Feather name="play" size={25} color="#ffffff" /></View>
              <Text style={styles.videoHint}>Open video</Text>
            </Pressable>
          ) : (
            <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContent}>
              <Image accessibilityLabel={item.file_name} source={{ uri: item.signed_url }} style={styles.image} resizeMode="contain" />
            </ScrollView>
          )}

          <View style={styles.metadata}>
            <Text style={styles.uploader}>Shared by {item.uploader_name}</Text>
            <Text style={styles.metaText}>{new Date(item.created_at).toLocaleString()}</Text>
            <Text style={styles.metaText}>
              {formatFileSize(item.file_size)}{item.width && item.height ? ` · ${item.width} × ${item.height}` : ''}
            </Text>
            {item.is_pinned ? <Text style={styles.highlight}>Family highlight</Text> : null}
          </View>

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={onLike} style={[styles.actionButton, busy && styles.disabled]}>
              <Feather name="heart" size={18} color={item.liked_by_me ? '#b34352' : '#176b63'} />
              <Text style={styles.actionText}>{item.liked_by_me ? 'Liked' : 'Like'} · {item.like_count}</Text>
            </Pressable>
            {canPin ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={onPin} style={[styles.actionButton, busy && styles.disabled]}>
                <Feather name="bookmark" size={18} color={item.is_pinned ? '#176b63' : '#71817c'} />
                <Text style={styles.actionText}>{item.is_pinned ? 'Unpin' : 'Pin'}</Text>
              </Pressable>
            ) : null}
            {canDelete ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={onRequestDelete} style={[styles.actionButton, styles.deleteAction, busy && styles.disabled]}>
                <Feather name="trash-2" size={17} color="#a43d37" />
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            ) : null}
          </View>

          {confirmingDelete ? (
            <View style={styles.confirmPanel}>
              <Text style={styles.confirmTitle}>Delete this media?</Text>
              <Text style={styles.metaText}>It will be removed from the family gallery.</Text>
              <View style={styles.confirmActions}>
                <Pressable accessibilityRole="button" disabled={busy} onPress={onCancelDelete} style={styles.cancelButton}>
                  <Text style={styles.actionText}>Keep media</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={busy} onPress={onConfirmDelete} style={[styles.confirmButton, busy && styles.disabled]}>
                  <Text style={styles.confirmText}>{busy ? 'Deleting…' : 'Delete media'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12, 31, 29, 0.48)' },
  sheet: { maxHeight: '92%', width: '100%', maxWidth: 760, alignSelf: 'center', backgroundColor: '#ffffff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#658079', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#102c2a', fontSize: 20, fontWeight: '700', marginTop: 4 },
  closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff4ef' },
  previewScroll: { maxHeight: 390, minHeight: 180, backgroundColor: '#122a27', borderRadius: 10 },
  previewContent: { minHeight: 180, justifyContent: 'center' },
  image: { width: '100%', height: 360 },
  videoPreview: { minHeight: 210, borderRadius: 10, backgroundColor: '#122a27', alignItems: 'center', justifyContent: 'center', gap: 9 },
  playButton: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#176b63', alignItems: 'center', justifyContent: 'center' },
  videoHint: { color: '#ffffff', fontWeight: '600' },
  metadata: { gap: 3 },
  uploader: { color: '#213d38', fontSize: 15, fontWeight: '700' },
  metaText: { color: '#65736f', fontSize: 13, lineHeight: 19 },
  highlight: { color: '#176b63', fontSize: 13, fontWeight: '700', marginTop: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 7, backgroundColor: '#eaf2ec' },
  actionText: { color: '#176b63', fontSize: 13, fontWeight: '700' },
  deleteAction: { backgroundColor: '#fff0ee' },
  deleteText: { color: '#a43d37', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  confirmPanel: { padding: 14, borderRadius: 8, backgroundColor: '#fff7f5', gap: 5 },
  confirmTitle: { color: '#79352f', fontSize: 15, fontWeight: '700' },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  cancelButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12 },
  confirmButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 6, backgroundColor: '#a43d37' },
  confirmText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  error: { color: '#9b332b', fontSize: 13, lineHeight: 19 },
});