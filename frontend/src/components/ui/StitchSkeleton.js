import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { stitchTheme } from '../../theme/stitchTheme';

export function StitchSkeleton({ style, type = 'box', width, height }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  const baseStyle = {
    opacity,
    backgroundColor: stitchTheme.colors.surfaceMuted,
    width: width || (type === 'text' ? '100%' : 'auto'),
    height: height || (type === 'text' ? 20 : type === 'avatar' ? 40 : 100),
    borderRadius: type === 'avatar' ? (height ? height / 2 : 20) : type === 'text' ? 4 : stitchTheme.radius.card,
  };

  return <Animated.View style={[baseStyle, style]} />;
}

export function StitchScreenSkeleton() {
  return (
    <View style={styles.screenSkeleton}>
      <StitchSkeleton type="box" height={150} style={styles.heroSkeleton} />
      <View style={styles.contentSkeleton}>
        <StitchSkeleton type="text" width="60%" height={24} style={styles.titleSkeleton} />
        <StitchSkeleton type="box" height={80} style={styles.cardSkeleton} />
        <StitchSkeleton type="box" height={80} style={styles.cardSkeleton} />
        <StitchSkeleton type="box" height={80} style={styles.cardSkeleton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenSkeleton: {
    flex: 1,
    backgroundColor: stitchTheme.colors.background,
  },
  heroSkeleton: {
    borderRadius: 0,
    marginBottom: stitchTheme.spacing.lg,
  },
  contentSkeleton: {
    paddingHorizontal: stitchTheme.spacing.screen,
  },
  titleSkeleton: {
    marginBottom: stitchTheme.spacing.md,
  },
  cardSkeleton: {
    marginBottom: stitchTheme.spacing.sm,
  },
});
