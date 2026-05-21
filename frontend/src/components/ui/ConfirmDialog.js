import { Modal, Text, TouchableOpacity, View, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.dialog}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.88}>
                  <Text style={styles.cancelText}>{cancelLabel || t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmButton} onPress={onConfirm} activeOpacity={0.88}>
                  <Text style={styles.confirmText}>{confirmLabel || t('common.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(12,18,12,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 28,
    backgroundColor: stitchTheme.colors.background,
    padding: 24,
    ...stitchShadows.card,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: stitchTheme.colors.primary,
    letterSpacing: -0.5,
  },
  message: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: stitchTheme.colors.textMuted,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: stitchTheme.colors.surfaceInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: stitchTheme.colors.accentRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: stitchTheme.colors.text, fontWeight: '800', fontSize: 15 },
  confirmText: { color: stitchTheme.colors.surfaceHighlight, fontWeight: '800', fontSize: 15 },
});
