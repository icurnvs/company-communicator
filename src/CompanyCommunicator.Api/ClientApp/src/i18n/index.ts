import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './en-US.json';

export const defaultNS = 'translation';
export const resources = {
  'en-US': {
    translation: enUS,
  },
  en: {
    translation: enUS,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en-US',
  fallbackLng: 'en-US',
  defaultNS,
  interpolation: {
    escapeValue: false, // React already escapes by default
  },
  returnNull: false,
});

export default i18n;
