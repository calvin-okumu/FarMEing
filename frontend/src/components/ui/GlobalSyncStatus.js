import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useSyncStore from '../../store/useSyncStore';
import { stitchTheme, stitchShadows } from '../../theme/stitchTheme';
import { useTranslation } from 'react-i18next';

export default function GlobalSyncStatus() {
  const { t } = useTranslation();
  const syncStatus = useSyncStore((s) => s.status);
  const failedCount = useSyncStore((s) => s.failedCount);

  if (syncStatus === 'idle' && failedCount === 0) return null;

  return (
    <View style={[styles.container, syncStatus === 'error' ? styles.errorContainer : styles.syncingContainer]}>
      {syncStatus === 'syncing' ? (
        <>
          <Animated.View style={styles.spinner}>
            <Ionicons name="sync" size={12} color="#fff" />
          </Animated.View>
          <Text style={styles.text}>{t('common.loading', { defaultValue: 'Syncing...' })}</Text>
        </>
      ) : (
        <>
          <Ionicons name="warning" size={12} color="#fff" />
          <Text style={styles.text}>{failedCount} {t('settings.sync_errors.title', { defaultValue: 'Errors' })}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 100,
    gap: 4,
    ...stitchShadows.float,
  },
  syncingContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  errorContainer: {
    backgroundColor: stitchTheme.colors.danger,
  },
  text: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  spinner: {
    // In a real app, this would use an Animated rotation, 
    // but for simplicity we just show the icon.
  }
});
