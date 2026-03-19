import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const LANG_KEY = 'user_language';

const getSystemLanguage = () => {
  try {
    // Lazy-require to prevent crash if native module is not yet registered
    const Localization = require('expo-localization');
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      return locales[0].languageCode;
    }
  } catch (err) {
    console.warn('ExpoLocalization not found or not ready, falling back to en');
  }
  return 'en';
};

const useSettingsStore = create((set) => ({
  language: null, // 'en' or 'sw'
  
  loadSettings: async () => {
    try {
      let lang = await SecureStore.getItemAsync(LANG_KEY);
      if (!lang) {
        // Default to system language if available in our list, else 'en'
        const systemLang = getSystemLanguage();
        lang = ['en', 'sw'].includes(systemLang) ? systemLang : 'en';
      }
      set({ language: lang });
      return lang;
    } catch (err) {
      set({ language: 'en' });
      return 'en';
    }
  },

  setLanguage: async (lang) => {
    try {
      await SecureStore.setItemAsync(LANG_KEY, lang);
      set({ language: lang });
    } catch (err) {
      console.warn('Failed to save language preference');
    }
  },

  initializeLanguage: async (user) => {
    try {
      const storedLang = await SecureStore.getItemAsync(LANG_KEY);
      if (storedLang) {
        set({ language: storedLang });
        return storedLang;
      }

      // Default based on role if no preference stored
      const defaultLang = user?.role === 'WORKER' ? 'sw' : 'en';
      await SecureStore.setItemAsync(LANG_KEY, defaultLang);
      set({ language: defaultLang });
      return defaultLang;
    } catch (err) {
      set({ language: 'en' });
      return 'en';
    }
  },
}));

export default useSettingsStore;
