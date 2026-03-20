import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stitchShadows, stitchTheme } from '../../theme/stitchTheme';

export function StitchTopBar({ title, subtitle, onBack, rightLabel, onRightPress, rightIcon = 'language-outline' }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        {onBack ? (
          <TouchableOpacity style={styles.iconButton} onPress={onBack} activeOpacity={0.86}>
            <Ionicons name="arrow-back" size={22} color={stitchTheme.colors.primary} />
          </TouchableOpacity>
        ) : null}
        <View>
          <Text style={styles.topBarTitle}>{title}</Text>
          {subtitle ? <Text style={styles.topBarSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {onRightPress ? (
        rightLabel ? (
          <TouchableOpacity style={styles.langChip} onPress={onRightPress} activeOpacity={0.86}>
            <Text style={styles.langChipText}>{rightLabel}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.iconButton} onPress={onRightPress} activeOpacity={0.86}>
            <Ionicons name={rightIcon} size={22} color={stitchTheme.colors.primary} />
          </TouchableOpacity>
        )
      ) : null}
    </View>
  );
}

export function StitchEyebrow({ children }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function StitchDisplayTitle({ children }) {
  return <Text style={styles.displayTitle}>{children}</Text>;
}

export function StitchSectionLabel({ children, style }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

export function StitchSurface({ children, style }) {
  return <View style={[styles.surfaceGlow, style]}><View style={styles.surfaceInner}>{children}</View></View>;
}

export function StitchChip({ label, active, onPress, style, textStyle }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, style]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive, textStyle]}>{label}</Text>
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
      <Ionicons name={icon} size={22} color={stitchTheme.colors.primary} />
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

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.52)',
  },
  topBarTitle: {
    fontSize: stitchTheme.typography.title.fontSize,
    fontWeight: stitchTheme.typography.title.fontWeight,
    color: stitchTheme.colors.primary,
  },
  topBarSubtitle: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: stitchTheme.colors.primary,
  },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(163,246,156,0.82)',
  },
  langChipText: {
    color: stitchTheme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  eyebrow: {
    fontSize: stitchTheme.typography.label.fontSize,
    fontWeight: stitchTheme.typography.label.fontWeight,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: stitchTheme.colors.accentBrown,
  },
  displayTitle: {
    marginTop: 10,
    fontSize: stitchTheme.typography.display.fontSize,
    lineHeight: stitchTheme.typography.display.lineHeight,
    fontWeight: stitchTheme.typography.display.fontWeight,
    color: stitchTheme.colors.primary,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: stitchTheme.colors.accentBrown,
    marginBottom: 12,
  },
  surfaceGlow: {
    borderRadius: stitchTheme.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.25)',
    ...stitchShadows.card,
  },
  surfaceInner: {
    backgroundColor: stitchTheme.colors.surface,
    borderRadius: stitchTheme.radius.lg,
    padding: 22,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#ebe7e3',
  },
  chipActive: {
    backgroundColor: stitchTheme.colors.primarySoft,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    color: stitchTheme.colors.accentBrown,
  },
  chipTextActive: {
    color: stitchTheme.colors.primary,
  },
  primaryButton: {
    minHeight: 82,
    borderRadius: 30,
    backgroundColor: stitchTheme.colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    ...stitchShadows.float,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: stitchTheme.colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  miniBars: {
    height: 92,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  miniBar: {
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: 20,
  },
});
