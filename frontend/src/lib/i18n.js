// src/lib/i18n.js
// Lightweight i18n solution - loads translation JSON files

let currentLanguage = localStorage.getItem('hypermart_language') || 'en';
let languageChangeListeners = [];

// Language names for display
const languageNames = {
  en: 'English',
  hi: 'हिन्दी',
  te: 'తెలుగు',
};

// Import translations statically to work with Vite
import enTranslations from '../../public/locales/en/translation.json';
import hiTranslations from '../../public/locales/hi/translation.json';
import teTranslations from '../../public/locales/te/translation.json';

const translations = {
  en: enTranslations,
  hi: hiTranslations,
  te: teTranslations,
};

// Initialize translations
export async function initI18n() {
  try {
    // Validate current language is available
    if (!translations[currentLanguage]) {
      currentLanguage = 'en';
      localStorage.setItem('hypermart_language', 'en');
    }
  } catch (error) {
    console.error('Failed to initialize i18n:', error);
  }
}

// Get translation key
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

// Get current language
export function getCurrentLanguage() {
  return currentLanguage;
}

// Subscribe to language changes
export function onLanguageChange(callback) {
  languageChangeListeners.push(callback);
  return () => {
    languageChangeListeners = languageChangeListeners.filter(cb => cb !== callback);
  };
}

// Notify all listeners of language change
function notifyLanguageChange(lang) {
  languageChangeListeners.forEach(cb => cb(lang));
}

// Set language
export function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    localStorage.setItem('hypermart_language', lang);
    notifyLanguageChange(lang);
    return true;
  }
  return false;
}

// Get available languages
export function getAvailableLanguages() {
  return Object.keys(translations).map(code => ({
    code,
    name: languageNames[code],
  }));
}

// Get all language codes
export function getLanguageCodes() {
  return Object.keys(translations);
}
