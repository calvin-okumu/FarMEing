import { create } from 'zustand';

const useSyncStore = create((set) => ({
  status: 'idle',
  lastSyncAt: null,
  failedCount: 0,
  lastError: '',

  setSyncing: () => set({ status: 'syncing', lastError: '' }),
  setSuccess: ({ failedCount = 0 } = {}) => set({
    status: failedCount > 0 ? 'error' : 'success',
    lastSyncAt: Date.now(),
    failedCount,
    lastError: failedCount > 0 ? 'Some items failed to sync' : '',
  }),
  setError: (message, failedCount = 0) => set({
    status: 'error',
    lastSyncAt: Date.now(),
    failedCount,
    lastError: message || 'Sync failed',
  }),
  reset: () => set({ status: 'idle', lastSyncAt: null, failedCount: 0, lastError: '' }),
}));

export default useSyncStore;
