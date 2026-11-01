import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fa from './locales/fa.json';

const LOCALE_KEY = 'karnameh.locale';
const savedLocale = localStorage.getItem(LOCALE_KEY) ?? 'en';

/** Set `dir`/`lang` on <html> so RTL kicks in for Persian and LTR for English. */
export function applyDirection(locale: string): void {
  const dir = locale === 'fa' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', locale);
  localStorage.setItem(LOCALE_KEY, locale);
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fa: { translation: fa },
  },
  lng: savedLocale,
  fallbackLng: 'en',
  keySeparator: false,
  interpolation: { escapeValue: false },
});

applyDirection(savedLocale);

export default i18n;
