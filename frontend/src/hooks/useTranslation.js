// src/hooks/useTranslation.js
// Custom hook for translations with proper reactivity

import { useCallback, useEffect, useState } from 'react';
import { t as getTranslation, getCurrentLanguage, setLanguage as setLang, getAvailableLanguages, onLanguageChange } from '../lib/i18n';
import { useApp } from '../context/AppContext';

export function useTranslation() {
  const { language, setLanguage } = useApp();
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());

  // Subscribe to language changes from i18n library
  useEffect(() => {
    const unsubscribe = onLanguageChange((lang) => {
      setCurrentLang(lang);
      setLanguage(lang);
    });
    return unsubscribe;
  }, [setLanguage]);
  
  const t = useCallback((key, defaultValue = key) => {
    return getTranslation(key, defaultValue);
  }, [currentLang]); // Re-create function when language changes

  const changeLanguage = useCallback((lang) => {
    if (setLang(lang)) {
      setLanguage(lang);
      setCurrentLang(lang);
      return true;
    }
    return false;
  }, [setLanguage]);

  const getLanguages = useCallback(() => {
    return getAvailableLanguages();
  }, []);

  return {
    t,
    language: currentLang,
    changeLanguage,
    availableLanguages: getLanguages(),
  };
}
