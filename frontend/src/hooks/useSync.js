/**
 * useSync
 *
 * Triggers syncAll() whenever the app comes to the foreground,
 * but only when the user is logged in (token present).
 */
import { useCallback, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAppForeground } from './useAppForeground';
import { syncAll }          from '../services/syncService';
import useAuthStore          from '../store/useAuthStore';
import useBackendStore       from '../store/useBackendStore';

export function useSync() {
  const token = useAuthStore((s) => s.token);
  const backendStatus = useBackendStore((s) => s.status);
  const prevStatusRef = useRef(backendStatus);

  const sync = useCallback(() => {
    if (token) {
      syncAll();   // fire-and-forget — errors are caught inside syncAll
    }
  }, [token]);

  useAppForeground(sync);

  // Sync on mount or when token becomes available
  useEffect(() => {
    if (token) {
      sync();
    }
  }, [token, sync]);

  // Sync when NetInfo detects connectivity restoration
  useEffect(() => {
    if (!token) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        sync();
      }
    });

    return () => unsubscribe();
  }, [token, sync]);

  // Sync when transitioning from offline to online (Store-based)
  useEffect(() => {
    if (token && prevStatusRef.current === 'offline' && backendStatus === 'online') {
      sync();
    }
    prevStatusRef.current = backendStatus;
  }, [token, backendStatus, sync]);
}
