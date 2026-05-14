import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchTheme } from '../../theme/stitchTheme';
import { StitchIconButton } from './StitchPrimitives';

const CURRENCY_META = {
  USD: { symbol: '$', locale: 'en-US' },
  TZS: { symbol: 'TSh', locale: 'sw-TZ' },
  KES: { symbol: 'KSh', locale: 'en-KE' },
};

function formatNumeric(amount, currency = 'USD') {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const meta = CURRENCY_META[currency] || CURRENCY_META.USD;
  try {
    return new Intl.NumberFormat(meta.locale, { maximumFractionDigits: 0 }).format(safeAmount);
  } catch {
    return safeAmount.toLocaleString();
  }
}

export default function StitchHeroHeader({
  eyebrow,
  title,
  subtitle,
  actionIcon,
  onActionPress,
  children,
  style,
  variant = 'default',
}) {
  const compact = variant === 'compact';

  return (
    <View style={[styles.hero, style]}>
      <View style={[styles.circleLarge, compact && styles.circleLargeCompact]} />
      <View style={[styles.circleSmall, compact && styles.circleSmallCompact]} />

      <View style={[styles.topRow, compact && styles.topRowCompact]}>
        <View style={styles.copy}>
          {eyebrow ? <Text style={[styles.eyebrow, compact && styles.eyebrowCompact]}>{eyebrow}</Text> : null}
          <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>{subtitle}</Text> : null}
        </View>
        {onActionPress ? (
          <StitchIconButton icon={actionIcon || 'ellipsis-horizontal'} onPress={onActionPress} iconSize={22} style={styles.actionButton} />
        ) : null}
      </View>

      {children ? <View style={[styles.footer, compact && styles.footerCompact]}>{children}</View> : null}
    </View>
  );
}

export function StitchHeroPill({ label, value, icon, style, currency, note, hideCurrency }) {
  const sym = currency && !hideCurrency ? (CURRENCY_META[currency]?.symbol || '$') : null;
  const displayValue = currency && typeof value === 'number' ? formatNumeric(value, currency) : value;
  return (
    <View style={[styles.pill, style]}>
      <View style={styles.pillLabelRow}>
        {icon ? <Ionicons name={icon} size={12} color="rgba(255,255,255,0.58)" /> : null}
        <Text style={styles.pillLabel}>{label}</Text>
        {sym ? <Text style={styles.pillCurrency}>{sym}</Text> : null}
      </View>
      <Text style={styles.pillValue} numberOfLines={1}>{displayValue}</Text>
      {note ? <Text style={styles.pillNote} numberOfLines={1}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: stitchTheme.colors.forestDeep,
    paddingTop: stitchTheme.spacing.xs + 6,
    paddingHorizontal: stitchTheme.spacing.screen,
    paddingBottom: stitchTheme.spacing.sm + 2,
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
  topRowCompact: {
    gap: stitchTheme.spacing.xs,
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
    marginBottom: 2,
  },
  eyebrowCompact: {
    marginBottom: 2,
  },
  title: {
    fontSize: stitchTheme.typography.hero.fontSize,
    lineHeight: stitchTheme.typography.hero.lineHeight,
    fontWeight: stitchTheme.typography.hero.fontWeight,
    fontFamily: stitchTheme.fonts.display,
    color: '#ffffff',
    letterSpacing: -1,
  },
  titleCompact: {
    fontSize: 28,
    lineHeight: 31,
  },
  subtitle: {
    marginTop: 2,
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontFamily: stitchTheme.fonts.body,
    color: 'rgba(255,255,255,0.58)',
  },
  subtitleCompact: {
    marginTop: 2,
    maxWidth: '88%',
  },
  actionButton: {
    marginTop: 0,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(253,250,244,0.18)',
    borderColor: 'rgba(255,255,255,0.34)',
    shadowColor: '#08160f',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  footer: {
    marginTop: stitchTheme.spacing.xs + 4,
  },
  footerCompact: {
    marginTop: stitchTheme.spacing.xs,
  },
  circleLargeCompact: {
    top: -70,
    right: -60,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  circleSmallCompact: {
    bottom: -48,
    left: 12,
    width: 88,
    height: 88,
    borderRadius: 44,
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
    justifyContent: 'space-between',
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
  pillCurrency: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '800',
    fontFamily: stitchTheme.fonts.label,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.52)',
  },
  pillValue: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    fontFamily: stitchTheme.fonts.heading,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  pillNote: {
    marginTop: 2,
    fontSize: 18,
    lineHeight: 23,
    color: 'rgba(255,140,120,0.85)',
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
