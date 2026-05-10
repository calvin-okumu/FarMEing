import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchShadows, stitchTheme } from '../../theme/stitchTheme';

function getSurfaceTone(tone) {
  if (tone === 'muted') {
    return {
      backgroundColor: stitchTheme.colors.surfaceInset,
      borderColor: 'transparent',
    };
  }

  if (tone === 'success') {
    return {
      backgroundColor: stitchTheme.colors.successSurface,
      borderColor: 'transparent',
    };
  }

  if (tone === 'accent') {
    return {
      backgroundColor: stitchTheme.colors.primaryContainer,
      borderColor: 'transparent',
    };
  }

  if (tone === 'flat') {
    return {
      backgroundColor: stitchTheme.colors.surfaceHighlight,
      borderColor: 'transparent',
    };
  }

  if (tone === 'raised') {
    return {
      backgroundColor: stitchTheme.colors.surfaceRaised,
      borderColor: 'rgba(255,255,255,0.6)',
    };
  }

  return {
    backgroundColor: stitchTheme.colors.surface,
    borderColor: 'transparent',
  };
}

export function StitchScreen({ children, scroll = false, style, contentContainerStyle, ...props }) {
  if (scroll) {
    return (
      <ScrollView
        style={[styles.screen, style]}
        contentContainerStyle={[styles.screenContent, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.screen, style]} {...props}>{children}</View>;
}

export function StitchTopBar({ title, subtitle, onBack, rightLabel, onRightPress, rightIcon = 'language-outline' }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        {onBack ? <StitchIconButton icon='arrow-back' onPress={onBack} /> : null}
        <View>
          <Text style={styles.topBarTitle}>{title}</Text>
          {subtitle ? <Text style={styles.topBarSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {onRightPress ? (
        rightLabel ? <StitchBadge label={rightLabel} tone='success' /> : <StitchIconButton icon={rightIcon} onPress={onRightPress} />
      ) : null}
    </View>
  );
}

export function StitchPageHeader({ eyebrow, title, subtitle, actionIcon, onActionPress, actionLabel, style }) {
  return (
    <View style={[styles.pageHeader, style]}>
      <View style={styles.pageHeaderBody}>
        {eyebrow ? <Text style={styles.pageKicker}>{eyebrow}</Text> : null}
        <Text style={styles.pageTitle}>{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {onActionPress ? (
        <StitchIconButton icon={actionIcon || 'add'} onPress={onActionPress} style={styles.pageHeaderAction} />
      ) : actionLabel ? (
        <StitchBadge label={actionLabel} tone='success' />
      ) : null}
    </View>
  );
}

export function StitchIconButton({ icon, onPress, tone = 'neutral', active = false, style, iconSize = 20 }) {
  const palette = tone === 'success'
    ? { bg: stitchTheme.colors.successSurface, color: stitchTheme.colors.primary }
    : tone === 'warning'
      ? { bg: stitchTheme.colors.warningSurface, color: stitchTheme.colors.accentBrown }
      : { bg: stitchTheme.colors.surfaceFloating, color: stitchTheme.colors.primary };

  return (
    <TouchableOpacity style={[styles.iconButton, active && styles.iconButtonActive, { backgroundColor: palette.bg }, style]} onPress={onPress} activeOpacity={0.86}>
      <Ionicons name={icon} size={iconSize} color={palette.color} />
    </TouchableOpacity>
  );
}

export function StitchEyebrow({ children, style }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

export function StitchDisplayTitle({ children, style }) {
  return <Text style={[styles.displayTitle, style]}>{children}</Text>;
}

export function StitchSectionTitle({ children, style }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

export function StitchSectionHeader({ title, subtitle, action, actionLabel, style, titleStyle }) {
  const label = actionLabel || action;
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionHeaderBody}>
        <Text style={[styles.sectionHeaderTitle, titleStyle]}>{title}</Text>
        {subtitle ? <Text style={styles.sectionHeaderSubtitle}>{subtitle}</Text> : null}
      </View>
      {label ? <Text style={styles.sectionHeaderAction}>{label}</Text> : null}
    </View>
  );
}

export function StitchCard({ children, style, contentStyle, tone = 'default', compact = false, onPress, shadow = 'card' }) {
  const palette = getSurfaceTone(tone);
  const shadowStyle = shadow === 'soft' ? stitchShadows.soft : shadow === 'float' ? stitchShadows.float : stitchShadows.card;
  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={[styles.cardShell, shadowStyle, { borderColor: palette.borderColor }, style]}
      onPress={onPress}
      activeOpacity={onPress ? 0.9 : undefined}
    >
      <View style={[styles.cardInner, compact && styles.cardInnerCompact, { backgroundColor: palette.backgroundColor }, contentStyle]}>{children}</View>
    </Component>
  );
}

export function StitchSurface({ children, style, contentStyle, tone = 'default', compact = false }) {
  return <StitchCard style={style} contentStyle={contentStyle} tone={tone} compact={compact}>{children}</StitchCard>;
}

export function StitchStatCard({ title, value, subtitle, icon, tone = 'default', style }) {
  const palette = tone === 'accent'
    ? { iconBg: 'rgba(255,255,255,0.14)', iconColor: '#fff', titleColor: '#d8f0d4', valueColor: '#fff', subtitleColor: '#cae8c4' }
    : tone === 'warning'
      ? { iconBg: '#f7d8ca', iconColor: stitchTheme.colors.accentBrown, titleColor: stitchTheme.colors.textMuted, valueColor: stitchTheme.colors.text, subtitleColor: stitchTheme.colors.accentBrown }
      : { iconBg: stitchTheme.colors.surfaceMuted, iconColor: stitchTheme.colors.primary, titleColor: stitchTheme.colors.textMuted, valueColor: stitchTheme.colors.text, subtitleColor: stitchTheme.colors.accentBrown };

  return (
    <StitchCard style={style} compact tone={tone === 'accent' ? 'accent' : tone === 'warning' ? 'muted' : 'default'} shadow='soft'>
      <View style={styles.statCardTop}>
        <Text style={[styles.statCardTitle, { color: palette.titleColor }]} numberOfLines={1}>{title}</Text>
        {icon ? (
          <View style={[styles.statCardIconWrap, { backgroundColor: palette.iconBg }]}>
            <Ionicons name={icon} size={15} color={palette.iconColor} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.statCardValue, { color: palette.valueColor }]} numberOfLines={1}>{value}</Text>
      {subtitle ? <Text style={[styles.statCardSubtitle, { color: palette.subtitleColor }]} numberOfLines={2}>{subtitle}</Text> : null}
    </StitchCard>
  );
}

export function StitchBadge({ label, tone = 'neutral', style, textStyle }) {
  const palette = tone === 'success'
    ? { bg: stitchTheme.colors.successSurface, color: stitchTheme.colors.primary }
    : tone === 'warning'
      ? { bg: stitchTheme.colors.warningSurface, color: stitchTheme.colors.accentBrown }
      : { bg: stitchTheme.colors.chip, color: stitchTheme.colors.accentBrown };

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      <Text style={[styles.badgeText, { color: palette.color }, textStyle]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function StitchChip({ label, active, onPress, style, textStyle, icon }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, style]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? stitchTheme.colors.primary : stitchTheme.colors.accentBrown} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive, textStyle]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export function StitchPrimaryButton({ label, onPress, disabled, loading, icon = 'checkmark-circle', style }) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, disabled && styles.primaryButtonDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
    >
      <Ionicons name={icon} size={20} color={stitchTheme.colors.primary} />
      <Text style={styles.primaryButtonText}>{loading ? '...' : label}</Text>
    </TouchableOpacity>
  );
}

export function StitchMiniBars({ values, activeIndex = -1, softIndex = -1, style }) {
  const maxValue = Math.max(...values, 1);

  return (
    <View style={[styles.miniBars, style]}>
      {values.map((value, index) => {
        let backgroundColor = '#e2ddd8';
        if (index === activeIndex) backgroundColor = stitchTheme.colors.primaryContainer;
        else if (index === softIndex) backgroundColor = stitchTheme.colors.primarySoft;

        return (
          <View
            key={`${value}-${index}`}
            style={[
              styles.miniBar,
              {
                height: `${Math.max(24, (value / maxValue) * 100)}%`,
                backgroundColor,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export function StitchSkeletonBlock({ style }) {
  return <View style={[styles.skeletonBlock, style]} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: stitchTheme.colors.background,
  },
  screenContent: {
    paddingHorizontal: stitchTheme.spacing.screen,
    paddingTop: stitchTheme.spacing.md,
    paddingBottom: 120,
    gap: stitchTheme.spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: stitchTheme.spacing.lg,
    gap: stitchTheme.spacing.sm,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stitchTheme.spacing.sm,
    flex: 1,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: stitchTheme.spacing.md,
  },
  pageHeaderBody: {
    flex: 1,
  },
  pageKicker: {
    fontSize: stitchTheme.typography.pageKicker.fontSize,
    lineHeight: stitchTheme.typography.pageKicker.lineHeight,
    fontWeight: stitchTheme.typography.pageKicker.fontWeight,
    fontFamily: stitchTheme.fonts.label,
    color: stitchTheme.colors.accentBrown,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pageTitle: {
    marginTop: stitchTheme.spacing.xs,
    fontSize: stitchTheme.typography.pageTitle.fontSize,
    lineHeight: stitchTheme.typography.pageTitle.lineHeight,
    fontWeight: stitchTheme.typography.pageTitle.fontWeight,
    fontFamily: stitchTheme.fonts.display,
    color: stitchTheme.colors.primary,
  },
  pageSubtitle: {
    marginTop: stitchTheme.spacing.xs,
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    color: stitchTheme.colors.textMuted,
    maxWidth: 260,
  },
  pageHeaderAction: {
    marginTop: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    ...stitchShadows.soft,
  },
  iconButtonActive: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  topBarTitle: {
    fontSize: stitchTheme.typography.title.fontSize,
    lineHeight: stitchTheme.typography.title.lineHeight,
    fontWeight: stitchTheme.typography.title.fontWeight,
    fontFamily: stitchTheme.fonts.heading,
    color: stitchTheme.colors.primary,
  },
  topBarSubtitle: {
    marginTop: 2,
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontWeight: '700',
    fontFamily: stitchTheme.fonts.body,
    color: stitchTheme.colors.textMuted,
  },
  eyebrow: {
    fontSize: stitchTheme.typography.label.fontSize,
    lineHeight: stitchTheme.typography.label.lineHeight,
    fontWeight: stitchTheme.typography.label.fontWeight,
    fontFamily: stitchTheme.fonts.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: stitchTheme.colors.accentBrown,
  },
  displayTitle: {
    marginTop: stitchTheme.spacing.xs,
    fontSize: stitchTheme.typography.display.fontSize,
    lineHeight: stitchTheme.typography.display.lineHeight,
    fontWeight: stitchTheme.typography.display.fontWeight,
    fontFamily: stitchTheme.fonts.display,
    color: stitchTheme.colors.primary,
  },
  sectionLabel: {
    fontSize: stitchTheme.typography.cardTitle.fontSize,
    lineHeight: stitchTheme.typography.cardTitle.lineHeight,
    fontWeight: '800',
    fontFamily: stitchTheme.fonts.label,
    color: stitchTheme.colors.accentBrown,
    marginBottom: stitchTheme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: stitchTheme.spacing.sm,
  },
  sectionHeaderBody: {
    flex: 1,
  },
  sectionHeaderTitle: {
    fontSize: stitchTheme.typography.section.fontSize,
    lineHeight: stitchTheme.typography.section.lineHeight,
    fontWeight: stitchTheme.typography.section.fontWeight,
    fontFamily: stitchTheme.fonts.heading,
    color: stitchTheme.colors.primary,
  },
  sectionHeaderSubtitle: {
    marginTop: 4,
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    color: stitchTheme.colors.textMuted,
  },
  sectionHeaderAction: {
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontWeight: '700',
    color: stitchTheme.colors.accentBrown,
  },
  cardShell: {
    borderRadius: stitchTheme.radius.card,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  cardInner: {
    borderRadius: stitchTheme.radius.card,
    padding: stitchTheme.spacing.md,
  },
  cardInnerCompact: {
    padding: stitchTheme.spacing.sm,
  },
  statCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: stitchTheme.spacing.sm,
  },
  statCardIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardTitle: {
    flex: 1,
    fontSize: stitchTheme.typography.cardTitle.fontSize,
    lineHeight: stitchTheme.typography.cardTitle.lineHeight,
    fontWeight: '800',
  },
  statCardValue: {
    marginTop: stitchTheme.spacing.sm,
    fontSize: stitchTheme.typography.title.fontSize,
    lineHeight: stitchTheme.typography.title.lineHeight,
    fontWeight: '900',
  },
  statCardSubtitle: {
    marginTop: 6,
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: stitchTheme.radius.pill,
  },
  badgeText: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: stitchTheme.radius.pill,
    backgroundColor: stitchTheme.colors.chip,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipActive: {
    backgroundColor: stitchTheme.colors.chipActive,
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontWeight: '800',
    fontFamily: stitchTheme.fonts.label,
    color: stitchTheme.colors.accentBrown,
  },
  chipTextActive: {
    color: stitchTheme.colors.primary,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: stitchTheme.radius.card,
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: stitchTheme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
    ...stitchShadows.float,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: stitchTheme.colors.primary,
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontWeight: '900',
  },
  miniBars: {
    height: 86,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: stitchTheme.spacing.xs,
  },
  miniBar: {
    flex: 1,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    minHeight: 20,
  },
  skeletonBlock: {
    backgroundColor: stitchTheme.colors.surfaceInset,
    borderRadius: 10,
  },
});
