import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useSyncStore from '../../store/useSyncStore';
import { stitchTheme } from '../../theme/stitchTheme';

export default function GlobalSyncStatus() {
  const status = useSyncStore((s) => s.status); // 'idle', 'syncing', 'error'
  const lastSync = useSyncStore((s) => s.lastSync);

  const config = useMemo(() => {
    switch (status) {
      case 'syncing':
        return {
          icon: 'sync-outline',
          color: stitchTheme.colors.primary,
          label: 'Syncing...',
          spinning: true,
        };
      case 'error':
        return {
          icon: 'cloud-offline-outline',
          color: stitchTheme.colors.accentRed,
          label: 'Sync Error',
          spinning: false,
        };
      default:
        return {
          icon: 'cloud-done-outline',
          color: stitchTheme.colors.textMuted,
          label: lastSync ? `Last sync: ${new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Up to date',
          spinning: false,
        };
    }
  }, [status, lastSync]);

  return (
    <View style={styles.container}>
      <View style={styles.pill}>
        {config.spinning ? (
          <ActivityIndicator size="small" color={config.color} style={styles.spinner} />
        ) : (
          <Ionicons name={config.icon} size={14} color={config.color} />
        )}
        <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: stitchTheme.colors.surfaceInset,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spinner: {
    transform: [{ scale: 0.7 }],
  },
});
