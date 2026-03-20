import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import useAuthStore from '../store/useAuthStore';
import AuthNavigator from './AuthNavigator';
import TabNavigator  from './TabNavigator';
import { stitchTheme } from '../theme/stitchTheme';

export default function RootNavigator() {
  const token     = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [holdSplash, setHoldSplash] = useState(true);

  useEffect(() => {
    let timeout;
    if (!isLoading) {
      timeout = setTimeout(() => setHoldSplash(false), 2200);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isLoading]);

  // Show splash/spinner while SecureStore is being read
  if (isLoading || holdSplash) {
    return (
      <View style={styles.splashScreen}>
        <View style={styles.splashGlowTop} />
        <View style={styles.splashGlowBottom} />
        <View style={styles.brandWrap}>
          <View style={styles.estChip}>
            <Text style={styles.estChipText}>EST. 2024</Text>
          </View>
          <Text style={styles.brandTitle}>FarmTrack</Text>
          <Text style={styles.brandSubtitle}>Precision management for the modern digital agronomist. Grounded in soil, driven by data.</Text>
        </View>

        <View style={styles.glassCard}>
          <View>
            <Text style={styles.glassLabel}>Soil Health Index</Text>
            <Text style={styles.glassValue}>94.2%</Text>
          </View>
          <View style={styles.glassBars}>
            <View style={[styles.glassBar, { height: 26, opacity: 0.35 }]} />
            <View style={[styles.glassBar, { height: 34, opacity: 0.5 }]} />
            <View style={[styles.glassBar, { height: 40, opacity: 0.7 }]} />
            <View style={[styles.glassBar, { height: 50, opacity: 1 }]} />
          </View>
        </View>

        <View style={styles.loadingWrap}>
          <View style={styles.loadingDots}>
            <View style={styles.loadingDot} />
            <View style={[styles.loadingDot, styles.loadingDotMuted]} />
            <View style={[styles.loadingDot, styles.loadingDotMuted]} />
          </View>
          <Text style={styles.loadingText}>Syncing Fields</Text>
          <ActivityIndicator size="large" color={stitchTheme.colors.primarySoft} style={{ marginTop: 18 }} />
        </View>
      </View>
    );
  }

  // React Navigation automatically animates between these two navigators
  // when `token` changes (login → tabs, logout → auth)
  return token ? <TabNavigator /> : <AuthNavigator />;
}

const styles = StyleSheet.create({
  splashScreen: {
    flex: 1,
    backgroundColor: stitchTheme.colors.primary,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 88,
    paddingBottom: 52,
  },
  splashGlowTop: {
    position: 'absolute',
    top: 120,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(163,246,156,0.14)',
  },
  splashGlowBottom: {
    position: 'absolute',
    bottom: 120,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(253,205,188,0.12)',
  },
  brandWrap: {
    alignItems: 'flex-start',
  },
  estChip: {
    backgroundColor: stitchTheme.colors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 22,
  },
  estChipText: {
    color: stitchTheme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  brandTitle: {
    color: '#fff',
    fontSize: 54,
    lineHeight: 56,
    fontWeight: '900',
  },
  brandSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 18,
    lineHeight: 27,
    marginTop: 18,
    maxWidth: 310,
  },
  glassCard: {
    alignSelf: 'flex-end',
    width: '92%',
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  glassLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
  glassValue: {
    color: stitchTheme.colors.primarySoft,
    fontSize: 34,
    fontWeight: '900',
    marginTop: 8,
  },
  glassBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  glassBar: {
    width: 8,
    borderRadius: 8,
    backgroundColor: stitchTheme.colors.primarySoft,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  loadingDotMuted: {
    opacity: 0.35,
  },
  loadingText: {
    marginTop: 10,
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
});
