import { create } from 'zustand';

export const useToastStore = create((set) => ({
  toast: null,
  showToast: ({ tone, title, message, duration = 4000 }) => {
    set({ toast: { tone, title, message, duration } });
  },
  hideToast: () => set({ toast: null }),
}));
