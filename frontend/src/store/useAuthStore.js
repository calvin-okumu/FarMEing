import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { resetLocalDatabase } from '../db';
import { getCurrentUser, loginUser, registerUser } from '../services/authService';
import useSettingsStore from './useSettingsStore';
import useBackendStore from './useBackendStore';
import useSyncStore from './useSyncStore';
import i18n from '../i18n';

const TOKEN_KEY = 'auth_token';
const USER_KEY  = 'auth_user';

const useAuthStore = create((set, get) => ({
  token:     null,
  user:      null,
  isLoading: true,   // true until hydration completes

  // ── Hydrate on app start ──────────────────────────────────────────────────
  // Reads token + user from SecureStore. Call once in App root.
  hydrate: async () => {
    try {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);

      if (!token) {
        set({ token: null, user: null, isLoading: false });
        return null;
      }

      const cachedUser = userJson ? JSON.parse(userJson) : null;
      set({ token, user: cachedUser, isLoading: true });

      try {
        const data = await getCurrentUser();
        const freshUser = data.user || cachedUser;
        if (freshUser) {
          await _persist(token, freshUser);
        }
        useBackendStore.getState().setOnline();
        set({ token, user: freshUser, isLoading: false });
        return freshUser;
      } catch (error) {
        if (error?.isBackendUnavailable && cachedUser) {
          useBackendStore.getState().setOffline(error.message);
          const lang = await useSettingsStore.getState().initializeLanguage(cachedUser);
          i18n.changeLanguage(lang);
          set({ token, user: cachedUser, isLoading: false });
          return cachedUser;
        }

        await Promise.all([
          SecureStore.deleteItemAsync(TOKEN_KEY),
          SecureStore.deleteItemAsync(USER_KEY),
        ]);
        set({ token: null, user: null, isLoading: false });
        return null;
      }
    } catch {
      set({ token: null, user: null, isLoading: false });
      return null;
    }
  },

  // ── Register ──────────────────────────────────────────────────────────────
  register: async ({ name, phone, password, role }) => {
    const data = await registerUser({ name, phone, password, role });
    await _persist(data.token, data.user);
    const lang = await useSettingsStore.getState().initializeLanguage(data.user);
    i18n.changeLanguage(lang);
    set({ token: data.token, user: data.user });
  },

  // ── Login ─────────────────────────────────────────────────────────────────
  login: async ({ phone, password }) => {
    const data = await loginUser({ phone, password });
    await _persist(data.token, data.user);
    const lang = await useSettingsStore.getState().initializeLanguage(data.user);
    i18n.changeLanguage(lang);
    set({ token: data.token, user: data.user });
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  logout: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);

    try {
      await resetLocalDatabase();
    } catch (error) {
      console.warn('[auth] failed to reset local database:', error.message);
    }

    useBackendStore.getState().reset();
    useSyncStore.getState().reset();
    set({ token: null, user: null, isLoading: false });
  },
}));

// ── Internal helper ───────────────────────────────────────────────────────────
async function _persist(token, user) {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, token),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  ]);
}

export default useAuthStore;
