import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import te from '../locales/te.json';

let currentLanguage = 'en';
let languageChangeListeners = [];

const languageNames = {
  en: 'English',
  hi: '\u0939\u093F\u0928\u094D\u0926\u0940',
  te: '\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41',
};

const translations = { en, hi, te };

export async function initI18n() {
  try {
    const saved = await AsyncStorage.getItem('hypermart_language');
    if (saved && translations[saved]) {
      currentLanguage = saved;
    }
  } catch {}
}

export function t(key, defaultValue = key) {
  const keys = key.split('.');
  let value = translations[currentLanguage];
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return defaultValue;
    }
  }
  return value || defaultValue;
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function onLanguageChange(callback) {
  languageChangeListeners.push(callback);
  return () => {
    languageChangeListeners = languageChangeListeners.filter(cb => cb !== callback);
  };
}

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    AsyncStorage.setItem('hypermart_language', lang).catch(() => {});
    languageChangeListeners.forEach(cb => cb(lang));
    return true;
  }
  return false;
}

export function getAvailableLanguages() {
  return Object.keys(translations).map(code => ({
    code,
    name: languageNames[code],
  }));
}
