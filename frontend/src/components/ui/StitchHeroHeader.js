import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchTheme } from '../../theme/stitchTheme';
import { StitchIconButton } from './StitchPrimitives';

export default function StitchHeroHeader({
  eyebrow,
  title,
  subtitle,
  actionIcon,
  onActionPress,
  children,
  style,
}) {
  return (
    <View style={[styles.hero, style]}>
      <View style={styles.circleLarge} />
      <View style={styles.circleSmall} />

      <View style={styles.topRow}>
        <View style={styles.copy}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {onActionPress ? (
          <StitchIconButton icon={actionIcon || 'ellipsis-horizontal'} onPress={onActionPress} style={styles.actionButton} />
        ) : null}
      </View>

      {children ? <View style={styles.footer}>{children}</View> : null}
    </View>
  );
}

export function StitchHeroPill({ label, value, icon, style }) {
  return (
    <View style={[styles.pill, style]}>
      <View style={styles.pillLabelRow}>
        {icon ? <Ionicons name={icon} size={12} color="rgba(255,255,255,0.58)" /> : null}
        <Text style={styles.pillLabel}>{label}</Text>
      </View>
      <Text style={styles.pillValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: stitchTheme.colors.forestDeep,
    paddingTop: stitchTheme.spacing.md,
    paddingHorizontal: stitchTheme.spacing.screen,
    paddingBottom: stitchTheme.spacing.lg,
    overflow: 'hidden',
  },
  circleLarge: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(82,183,136,0.10)',
  },
  circleSmall: {
    position: 'absolute',
    bottom: -40,
    left: 20,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(82,183,136,0.07)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: stitchTheme.spacing.sm,
  },
  copy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: stitchTheme.typography.label.fontSize,
    lineHeight: stitchTheme.typography.label.lineHeight,
    fontWeight: stitchTheme.typography.label.fontWeight,
    fontFamily: stitchTheme.fonts.label,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: stitchTheme.colors.primaryDim,
    marginBottom: 4,
  },
  title: {
    fontSize: stitchTheme.typography.hero.fontSize,
    lineHeight: stitchTheme.typography.hero.lineHeight,
    fontWeight: stitchTheme.typography.hero.fontWeight,
    fontFamily: stitchTheme.fonts.display,
    color: '#ffffff',
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 5,
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontFamily: stitchTheme.fonts.body,
    color: 'rgba(255,255,255,0.58)',
  },
  actionButton: {
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  footer: {
    marginTop: stitchTheme.spacing.md,
  },
  pill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: stitchTheme.radius.sm,
    padding: 12,
  },
  pillLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pillLabel: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '800',
    fontFamily: stitchTheme.fonts.label,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.52)',
  },
  pillValue: {
    fontSize: stitchTheme.typography.cardTitle.fontSize,
    lineHeight: stitchTheme.typography.cardTitle.lineHeight,
    fontWeight: '900',
    fontFamily: stitchTheme.fonts.heading,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
});
