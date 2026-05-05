/**
 * useSync
 *
 * Triggers syncAll() whenever the app comes to the foreground,
 * but only when the user is logged in (token present).
 */
import { useCallback, useEffect } from 'react';
import { useAppForeground } from './useAppForeground';
import { syncAll }          from '../services/syncService';
import useAuthStore          from '../store/useAuthStore';

export function useSync() {
  const token = useAuthStore((s) => s.token);

  const sync = useCallback(() => {
    if (token) {
      syncAll();   // fire-and-forget — errors are caught inside syncAll
    }
  }, [token]);

  useAppForeground(sync);

  useEffect(() => {
    if (token) {
      sync();
    }
  }, [token, sync]);
}
