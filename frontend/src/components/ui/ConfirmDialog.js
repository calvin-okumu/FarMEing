import { Modal, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { stitchShadows, stitchTheme } from '../../theme/stitchTheme';

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.88}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={onConfirm} activeOpacity={0.88}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 18, 12, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    borderRadius: 30,
    backgroundColor: stitchTheme.colors.background,
    padding: 24,
    ...stitchShadows.card,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: stitchTheme.colors.primary,
  },
  message: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    color: stitchTheme.colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 22,
    backgroundColor: '#ebe7e3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 22,
    backgroundColor: '#9c1111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: stitchTheme.colors.text, fontWeight: '800' },
  confirmText: { color: '#fff', fontWeight: '800' },
});
