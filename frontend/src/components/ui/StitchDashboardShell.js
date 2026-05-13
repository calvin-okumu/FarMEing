import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, ActivityIndicator, Keyboard, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { stitchTheme } from '../../theme/stitchTheme';
import { STITCH_TAB_BAR_HEIGHT } from '../navigation/StitchTabBar';
import StitchHeroHeader from './StitchHeroHeader';
import StatusBanner from './StatusBanner';
import useSyncStore from '../../store/useSyncStore';

const EXPANDED_HERO_HEIGHT = 184;

export function StitchDashboardSectionHeader({ title, subtitle, badgeLabel, actionLabel, onActionPress, style }) {
  return (
    <View style={[styles.sectionHead, style]}>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      {badgeLabel ? (
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{badgeLabel}</Text>
        </View>
      ) : null}
      {!badgeLabel && actionLabel && onActionPress ? (
        <TouchableOpacity onPress={onActionPress} activeOpacity={0.82}>
          <Text style={styles.seeAll}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function StitchDashboardShell({
  hero,
  children,
  bodyContentStyle,
  bodyStyle,
  refreshControl,
  banner,
  onDismissBanner,
  stickyHeader,
  statusBarStyle = 'light-content',
  statusBarBackgroundColor = stitchTheme.colors.forestDeep,
}) {
  const syncStatus = useSyncStore((s) => s.status);
  const heroHeight = useRef(new Animated.Value(EXPANDED_HERO_HEIGHT)).current;

  const syncIcon = useMemo(() => {
    switch (syncStatus) {
      case 'syncing': return { name: 'sync-outline', color: stitchTheme.colors.primary, spin: true };
      case 'error': return { name: 'cloud-offline-outline', color: stitchTheme.colors.accentRed, spin: false };
      default: return { name: 'cloud-done-outline', color: 'rgba(255,255,255,0.4)', spin: false };
    }
  }, [syncStatus]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () =>
      Animated.timing(heroHeight, { toValue: 0, duration: 180, useNativeDriver: false }).start()
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      Animated.timing(heroHeight, { toValue: EXPANDED_HERO_HEIGHT, duration: 200, useNativeDriver: false }).start()
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [heroHeight]);

  const resolvedBodyContentStyle = StyleSheet.flatten([styles.bodyContent, bodyContentStyle]) || {};
  const mergedBodyContentStyle = [
    styles.bodyContent,
    bodyContentStyle,
    { paddingBottom: Math.max(styles.bodyContent.paddingBottom, resolvedBodyContentStyle.paddingBottom || 0) },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={statusBarBackgroundColor} />
      
      <StatusBanner 
        {...banner} 
        variant="toast" 
        onDismiss={onDismissBanner} 
        style={styles.floatingBanner}
      />

      <Animated.View style={[styles.heroWrapper, { height: heroHeight }]}> 
        <View style={styles.syncIndicator}>
          {syncIcon.spin ? (
            <ActivityIndicator size='small' color={syncIcon.color} />
          ) : (
            <Ionicons name={syncIcon.name} size={16} color={syncIcon.color} />
          )}
        </View>
        <Animated.View style={hero?.wrapperStyle}>
          {hero?.eyebrow || hero?.title ? (
            <StitchHeroHeader
              eyebrow={hero.eyebrow}
              title={hero.title}
              subtitle={hero.subtitle}
              actionIcon={hero.actionIcon}
              onActionPress={hero.onActionPress}
              leftActionIcon={hero.leftActionIcon}
              onLeftActionPress={hero.onLeftActionPress}
              style={hero.style}
              variant={hero.variant}
            >
              {hero.children}
            </StitchHeroHeader>
          ) : null}
        </Animated.View>
      </Animated.View>

      {stickyHeader ? <View style={styles.stickyWrap}>{stickyHeader}</View> : null}

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
  floatingBanner: {
    marginTop: Platform.OS === 'ios' ? 0 : 10,
  },
  heroWrapper: {
    overflow: 'hidden',
    paddingBottom: 0,
    backgroundColor: stitchTheme.colors.forestDeep,
  },
  stickyWrap: {
    backgroundColor: 'transparent',
    paddingHorizontal: stitchTheme.spacing.md,
    paddingVertical: 6,
    marginTop: -12,
  },
  syncIndicator: { position: 'absolute', bottom: 10, right: 16, zIndex: 10 },
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
    paddingBottom: STITCH_TAB_BAR_HEIGHT,
    gap: stitchTheme.spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: stitchTheme.spacing.xs,
  },
  sectionCopy: {
    flex: 1,
    paddingRight: stitchTheme.spacing.sm,
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
