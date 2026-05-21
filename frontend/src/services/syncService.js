import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from '../db';
import api from '../lib/api';
import useSyncStore from '../store/useSyncStore';

let _syncing = false;

export async function syncAll() {
  if (_syncing) {
    return { skipped: true };
  }

  _syncing = true;
  useSyncStore.getState().setSyncing();

  try {
    await synchronize({
      database,
      pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
        const response = await api.get('sync/pull', {
          params: {
            last_pulled_at: lastPulledAt || 0,
            schema_version: schemaVersion,
            migration: migration ? encodeURIComponent(JSON.stringify(migration)) : null,
          },
        });

        const { changes, timestamp } = response.data;
        return { changes, timestamp };
      },
      pushChanges: async ({ changes, lastPulledAt }) => {
        await api.post('sync/push', { changes, lastPulledAt });
      },
      migrationsEnabledAtVersion: 10,
    });

    useSyncStore.getState().setSuccess({ failedCount: 0 });
    return { skipped: false, error: null };
  } catch (error) {
    console.warn('[sync] failed:', error.message);
    useSyncStore.getState().setError(error.message);
    return { skipped: false, error: error.message };
  } finally {
    _syncing = false;
  }
}
