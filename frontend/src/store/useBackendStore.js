import { create } from 'zustand';

const useBackendStore = create((set) => ({
  status: 'unknown',
  lastCheckedAt: null,
  lastOnlineAt: null,
  lastError: '',

  setOnline: () => set((state) => ({
    status: 'online',
    lastCheckedAt: Date.now(),
    lastOnlineAt: Date.now(),
    lastError: state.status === 'offline' ? '' : state.lastError,
  })),

  setOffline: (message) => set({
    status: 'offline',
    lastCheckedAt: Date.now(),
    lastError: message || 'Backend unavailable',
  }),

  setUnknown: () => set({
    status: 'unknown',
    lastCheckedAt: Date.now(),
  }),
}));

export default useBackendStore;
