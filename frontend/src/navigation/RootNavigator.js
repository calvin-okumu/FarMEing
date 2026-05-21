import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import useAuthStore from '../store/useAuthStore';
import useBackendStore from '../store/useBackendStore';
import AuthNavigator from './AuthNavigator';
import TabNavigator  from './TabNavigator';
import { stitchTheme } from '../theme/stitchTheme';

// Import Modal Screens
import AddBudgetItemScreen from '../screens/AddBudgetItemScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import AddWorkEntryScreen from '../screens/AddWorkEntryScreen';
import AddHarvestScreen from '../screens/AddHarvestScreen';
import AddSaleScreen from '../screens/AddSaleScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const token     = useAuthStore((s) => s.token);
  const isLoading = useAuthStore((s) => s.isLoading);
  const backendStatus = useBackendStore((s) => s.status);
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

  return (
    <View style={styles.appShell}>
      {token ? (
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: stitchTheme.colors.background } }}>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          
          <Stack.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
            <Stack.Screen name="AddBudgetItem" component={AddBudgetItemScreen} />
            <Stack.Screen name="AddExpense"    component={AddExpenseScreen} />
            <Stack.Screen name="AddWorkEntry"  component={AddWorkEntryScreen} />
            <Stack.Screen name="AddHarvest"    component={AddHarvestScreen} />
            <Stack.Screen name="AddSale"       component={AddSaleScreen} />
          </Stack.Group>
        </Stack.Navigator>
      ) : (
        <AuthNavigator />
      )}
      
      {backendStatus === 'offline' ? (
        <View pointerEvents="none" style={styles.offlineBannerWrap}>
          <View style={styles.offlineBanner}>
            <View style={styles.offlineDot} />
            <Text style={styles.offlineText}>Offline mode - saving locally</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: stitchTheme.colors.background,
  },
  splashScreen: {
    flex: 1,
    backgroundColor: stitchTheme.colors.primary,
    justifyContent: 'space-between',
    paddingHorizontal: stitchTheme.spacing.xl,
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
    paddingHorizontal: stitchTheme.spacing.sm,
    paddingVertical: 7,
    borderRadius: stitchTheme.radius.pill,
    marginBottom: stitchTheme.spacing.xl,
  },
  estChipText: {
    color: stitchTheme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  brandTitle: {
    color: stitchTheme.colors.white,
    fontSize: 54,
    lineHeight: 56,
    fontWeight: '900',
  },
  brandSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 18,
    lineHeight: 27,
    marginTop: stitchTheme.spacing.md,
    maxWidth: 310,
  },
  glassCard: {
    alignSelf: 'flex-end',
    width: '92%',
    borderRadius: stitchTheme.radius.xl,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: stitchTheme.spacing.lg,
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
    marginTop: stitchTheme.spacing.xs,
  },
  glassBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: stitchTheme.spacing.xxs,
  },
  glassBar: {
    width: 8,
    borderRadius: stitchTheme.radius.xs,
    backgroundColor: stitchTheme.colors.primarySoft,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: stitchTheme.spacing.xs,
    alignItems: 'center',
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: stitchTheme.colors.white,
  },
  loadingDotMuted: {
    opacity: 0.35,
  },
  loadingText: {
    marginTop: 10,
    color: stitchTheme.colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  offlineBannerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 12,
    alignItems: 'center',
    zIndex: 20,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stitchTheme.spacing.xs,
    backgroundColor: 'rgba(17,42,30,0.94)',
    paddingHorizontal: stitchTheme.spacing.sm,
    paddingVertical: 9,
    borderRadius: stitchTheme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: stitchTheme.colors.accentPeach,
  },
  offlineText: {
    color: stitchTheme.colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
