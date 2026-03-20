import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const LANG_KEY = 'user_language';
const CURRENCY_KEY = 'user_currency';

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
  currency: 'USD',
  
  loadSettings: async () => {
    try {
      const [storedLang, storedCurrency] = await Promise.all([
        SecureStore.getItemAsync(LANG_KEY),
        SecureStore.getItemAsync(CURRENCY_KEY),
      ]);
      let lang = storedLang;
      if (!lang) {
        // Default to system language if available in our list, else 'en'
        const systemLang = getSystemLanguage();
        lang = ['en', 'sw'].includes(systemLang) ? systemLang : 'en';
      }
      set({ language: lang, currency: storedCurrency || 'USD' });
      return lang;
    } catch (err) {
      set({ language: 'en', currency: 'USD' });
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

  setCurrency: async (currency) => {
    try {
      await SecureStore.setItemAsync(CURRENCY_KEY, currency);
      set({ currency });
    } catch (err) {
      console.warn('Failed to save currency preference');
    }
  },

  initializeLanguage: async (user) => {
    try {
      const [storedLang, storedCurrency] = await Promise.all([
        SecureStore.getItemAsync(LANG_KEY),
        SecureStore.getItemAsync(CURRENCY_KEY),
      ]);
      if (storedLang) {
        set({ language: storedLang, currency: storedCurrency || user?.currency || 'USD' });
        return storedLang;
      }

      // Default based on role if no preference stored
      const defaultLang = user?.role === 'WORKER' ? 'sw' : 'en';
      const defaultCurrency = storedCurrency || user?.currency || 'USD';
      await Promise.all([
        SecureStore.setItemAsync(LANG_KEY, defaultLang),
        SecureStore.setItemAsync(CURRENCY_KEY, defaultCurrency),
      ]);
      set({ language: defaultLang, currency: defaultCurrency });
      return defaultLang;
    } catch (err) {
      set({ language: 'en', currency: user?.currency || 'USD' });
      return 'en';
    }
  },
}));

export default useSettingsStore;
