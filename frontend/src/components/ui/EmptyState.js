import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchTheme } from '../../theme/stitchTheme';
import { StitchPrimaryButton } from './StitchPrimitives';

export default function EmptyState({ icon = 'leaf-outline', title, subtitle, actionLabel, onAction, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={34} color={stitchTheme.colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <StitchPrimaryButton label={actionLabel} onPress={onAction} icon="add-circle-outline" style={styles.actionButton} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 28 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: stitchTheme.radius.lg,
    backgroundColor: stitchTheme.colors.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: stitchTheme.typography.title.fontSize, fontWeight: '800', color: stitchTheme.colors.primary, marginTop: 14 },
  subtitle: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.textMuted, marginTop: 6, textAlign: 'center' },
  actionButton: { marginTop: 20 },
});
