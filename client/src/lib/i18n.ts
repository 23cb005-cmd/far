import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '@farmfair/shared';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import ta from '../locales/ta.json';

const STORAGE_KEY = 'farmfair.language';

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * Resolve the starting language: an explicit earlier choice wins, then the
 * browser preference, then English.
 */
function detectLanguage(): Language {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;

    const browser = window.navigator.language?.slice(0, 2);
    if (isLanguage(browser)) return browser;
  }
  return DEFAULT_LANGUAGE;
}

void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ta: { translation: ta },
  },
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...LANGUAGES],
  interpolation: {
    // React escapes for us; double-escaping would mangle Tamil punctuation.
    escapeValue: false,
  },
  returnNull: false,
});

/** Persist the choice and keep `<html lang>` in sync for screen readers. */
export function setLanguage(language: Language): void {
  void i18next.changeLanguage(language);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }
}

export function getLanguage(): Language {
  return isLanguage(i18next.language) ? i18next.language : DEFAULT_LANGUAGE;
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = getLanguage();
}

export default i18next;
