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
  return <View style={[styles.surface, style]}>{children}</View>;
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: stitchTheme.colors.primary,
  },
  topBarSubtitle: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: stitchTheme.colors.primary,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: stitchTheme.colors.primarySoft,
  },
  langChipText: {
    color: stitchTheme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: stitchTheme.colors.accentBrown,
  },
  displayTitle: {
    marginTop: 10,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    color: stitchTheme.colors.primary,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: stitchTheme.colors.accentBrown,
    marginBottom: 12,
  },
  surface: {
    backgroundColor: '#fff',
    borderRadius: 30,
    padding: 22,
    ...stitchShadows.card,
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
