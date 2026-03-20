import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchTheme } from '../../theme/stitchTheme';

const TONES = {
  success: {
    backgroundColor: '#e9f6e6',
    borderColor: '#b8dfb1',
    icon: 'checkmark-circle',
    iconColor: stitchTheme.colors.primary,
    titleColor: stitchTheme.colors.primary,
    textColor: stitchTheme.colors.text,
  },
  warning: {
    backgroundColor: '#fbf0dc',
    borderColor: '#f1d59b',
    icon: 'warning',
    iconColor: '#9b5c22',
    titleColor: '#9b5c22',
    textColor: stitchTheme.colors.text,
  },
  error: {
    backgroundColor: '#fde9e9',
    borderColor: '#f3b6b6',
    icon: 'alert-circle',
    iconColor: '#9c1111',
    titleColor: '#9c1111',
    textColor: stitchTheme.colors.text,
  },
  info: {
    backgroundColor: '#e9f0fb',
    borderColor: '#bfd0f3',
    icon: 'information-circle',
    iconColor: '#305db8',
    titleColor: '#305db8',
    textColor: stitchTheme.colors.text,
  },
};

export default function StatusBanner({ tone = 'info', title, message, style }) {
  if (!title && !message) return null;
  const palette = TONES[tone] || TONES.info;

  return (
    <View style={[styles.wrap, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }, style]}>
      <Ionicons name={palette.icon} size={20} color={palette.iconColor} />
      <View style={styles.body}>
        {title ? <Text style={[styles.title, { color: palette.titleColor }]}>{title}</Text> : null}
        {message ? <Text style={[styles.message, { color: palette.textColor }]}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  body: { flex: 1 },
  title: { fontSize: 13, fontWeight: '800', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 },
  message: { fontSize: 14, lineHeight: 20 },
});
