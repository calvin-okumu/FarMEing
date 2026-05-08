import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getFailedRecords, syncAll } from '../services/syncService';
import { stitchTheme, stitchShadows } from '../theme/stitchTheme';
import StitchDashboardShell from '../components/ui/StitchDashboardShell';
import { formatAppDate } from '../utils/date';
import useSyncStore from '../store/useSyncStore';

export default function SyncErrorsScreen() {
  const { t } = useTranslation();
  const [errors, setErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const syncStatus = useSyncStore((s) => s.status);

  const loadErrors = async () => {
    setIsLoading(true);
    const failed = await getFailedRecords();
    setErrors(failed);
    setIsLoading(false);
  };

  useEffect(() => {
    loadErrors();
  }, [syncStatus]);

  const handleRetryAll = async () => {
    await syncAll();
    loadErrors();
  };

  return (
    <View style={styles.screen}>
      <StitchDashboardShell
        hero={{
          eyebrow: t('settings.sync_errors.title'),
          title: t('settings.sync_errors.title'),
          subtitle: t('settings.sync_errors.subtitle'),
        }}
        bodyContentStyle={styles.listContent}
      >
        <View style={styles.container}>
          {isLoading ? (
            <StitchScreenSkeleton />
          ) : errors.length > 0 ? (
            errors.map((item) => (
              <View key={`${item.table}-${item.id}`} style={styles.errorCard}>
                <View style={styles.errorHeader}>
                  <View style={styles.typeTag}>
                    <Text style={styles.typeTagText}>{item.table.replace('_', ' ').toUpperCase()}</Text>
                  </View>
                  <Text style={styles.dateText}>{formatAppDate(item.updatedAt)}</Text>
                </View>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.errorText}>{item.lastError}</Text>
                <Text style={styles.itemId}>{t('settings.sync_errors.item_id', { id: item.id })}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={64} color={stitchTheme.colors.primaryDim} />
              <Text style={styles.emptyText}>{t('settings.sync_errors.no_errors')}</Text>
            </View>
          )}
        </View>
      </StitchDashboardShell>

      {errors.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={handleRetryAll}
            disabled={syncStatus === 'syncing'}
          >
            {syncStatus === 'syncing' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.retryButtonText}>{t('settings.sync_errors.retry_all')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: stitchTheme.colors.background },
  container: { flex: 1 },
  listContent: { padding: stitchTheme.spacing.md, gap: stitchTheme.spacing.md, paddingBottom: 100 },
  errorCard: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderRadius: stitchTheme.radius.card,
    padding: stitchTheme.spacing.md,
    ...stitchShadows.card,
    borderLeftWidth: 4,
    borderLeftColor: stitchTheme.colors.accentRed,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeTag: {
    backgroundColor: stitchTheme.colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: stitchTheme.colors.textSoft,
  },
  dateText: {
    fontSize: 11,
    color: stitchTheme.colors.textMuted,
    fontWeight: '600',
  },
  itemName: {
    fontSize: 18,
    fontWeight: '800',
    color: stitchTheme.colors.text,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: stitchTheme.colors.accentRed,
    fontWeight: '600',
    marginBottom: 8,
  },
  itemId: {
    fontSize: 11,
    color: stitchTheme.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: stitchTheme.colors.textSoft,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: stitchTheme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: 'rgba(245, 240, 232, 0.9)',
  },
  retryButton: {
    backgroundColor: stitchTheme.colors.primary,
    height: 56,
    borderRadius: stitchTheme.radius.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    ...stitchShadows.float,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
});
nter',
    gap: 12,
    ...stitchShadows.float,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
});
