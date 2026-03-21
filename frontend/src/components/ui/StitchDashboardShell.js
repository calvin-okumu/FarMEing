import { Animated, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { stitchTheme } from '../../theme/stitchTheme';
import { STITCH_TAB_BAR_HEIGHT } from '../navigation/StitchTabBar';
import StitchHeroHeader from './StitchHeroHeader';

export function StitchDashboardSectionHeader({ title, subtitle, actionLabel, onActionPress, badgeLabel, style }) {
  return (
    <View style={[styles.sectionHead, style]}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      {badgeLabel ? (
        <StitchDashboardStatusBadge label={badgeLabel} />
      ) : actionLabel ? (
        <TouchableOpacity activeOpacity={0.88} onPress={onActionPress}>
          <Text style={styles.seeAll}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function StitchDashboardStatusBadge({ label }) {
  return (
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>{label}</Text>
    </View>
  );
}

export default function StitchDashboardShell({
  hero,
  children,
  bodyContentStyle,
  bodyStyle,
  refreshControl,
  statusBarStyle = 'light-content',
  statusBarBackgroundColor = stitchTheme.colors.forestDeep,
}) {
  const resolvedBodyContentStyle = StyleSheet.flatten([styles.bodyContent, bodyContentStyle]) || {};
  const mergedBodyContentStyle = [
    styles.bodyContent,
    bodyContentStyle,
    { paddingBottom: Math.max(styles.bodyContent.paddingBottom, resolvedBodyContentStyle.paddingBottom || 0) },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={statusBarBackgroundColor} />
      <Animated.View style={[styles.heroWrapper, hero?.wrapperStyle]}>
        {hero?.eyebrow || hero?.title ? (
          <StitchHeroHeader
            eyebrow={hero.eyebrow}
            title={hero.title}
            subtitle={hero.subtitle}
            actionIcon={hero.actionIcon}
            onActionPress={hero.onActionPress}
            style={hero.style}
            variant={hero.variant}
          >
            {hero.children}
          </StitchHeroHeader>
        ) : null}
      </Animated.View>

      <ScrollView style={[styles.body, bodyStyle]} contentContainerStyle={mergedBodyContentStyle} showsVerticalScrollIndicator={false} refreshControl={refreshControl} keyboardShouldPersistTaps='handled'>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: stitchTheme.colors.forestDeep,
  },
  heroWrapper: {
    overflow: 'hidden',
    paddingBottom: stitchTheme.spacing.xs,
    backgroundColor: stitchTheme.colors.forestDeep,
  },
  body: {
    flex: 1,
    backgroundColor: stitchTheme.colors.background,
    marginTop: -stitchTheme.spacing.xs,
    borderTopLeftRadius: stitchTheme.radius.xl,
    borderTopRightRadius: stitchTheme.radius.xl,
  },
  bodyContent: {
    paddingHorizontal: stitchTheme.spacing.md,
    paddingTop: stitchTheme.spacing.md,
    paddingBottom: STITCH_TAB_BAR_HEIGHT + 32,
    gap: stitchTheme.spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: stitchTheme.spacing.xs,
  },
  sectionTitle: {
    fontSize: stitchTheme.typography.section.fontSize,
    fontWeight: '800',
    color: stitchTheme.colors.text,
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: stitchTheme.typography.caption.fontSize,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: stitchTheme.colors.textMuted,
    marginTop: 2,
  },
  seeAll: {
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    fontWeight: '700',
    color: stitchTheme.colors.primaryContainer,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: stitchTheme.colors.mintLight,
    paddingHorizontal: stitchTheme.spacing.xs + 2,
    paddingVertical: 5,
    borderRadius: stitchTheme.radius.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: stitchTheme.colors.primaryDim,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: stitchTheme.colors.primaryContainer,
  },
});
