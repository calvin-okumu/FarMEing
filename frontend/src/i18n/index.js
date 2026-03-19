import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import sw from './sw.json';

const resources = {
  en: { translation: en },
  sw: { translation: sw },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default, we'll change it dynamically on app load
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
