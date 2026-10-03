import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type InfoButtonProps = {
  title: string;
  message: string;
};

export default function InfoButton({ title, message }: InfoButtonProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More information about ${title}`}
        onPress={() => setVisible(true)}
        style={styles.trigger}
        hitSlop={8}
      >
        <Feather name="info" size={17} color="#176b63" />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close information dialog"
            onPress={() => setVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.dialog}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            <Pressable accessibilityRole="button" onPress={() => setVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(12, 31, 29, 0.42)',
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    padding: 22,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  title: {
    color: '#102c2a',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    color: '#526260',
    fontSize: 15,
    lineHeight: 22,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginTop: 20,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  closeText: {
    color: '#176b63',
    fontWeight: '700',
  },
});
