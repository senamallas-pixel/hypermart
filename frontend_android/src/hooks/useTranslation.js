import { useCallback, useEffect, useState } from 'react';
import { t as getTranslation, getCurrentLanguage, setLanguage as setLang, getAvailableLanguages, onLanguageChange } from '../lib/i18n';
import { useApp } from '../context/AppContext';

export function useTranslation() {
  const { language, setLanguage } = useApp();
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());

  useEffect(() => {
    const unsubscribe = onLanguageChange((lang) => {
      setCurrentLang(lang);
      setLanguage(lang);
    });
    return unsubscribe;
  }, [setLanguage]);

  const t = useCallback((key, defaultValue = key) => {
    return getTranslation(key, defaultValue);
  }, [currentLang]);

  const changeLanguage = useCallback((lang) => {
    if (setLang(lang)) {
      setLanguage(lang);
      setCurrentLang(lang);
      return true;
    }
    return false;
  }, [setLanguage]);

  return {
    t,
    language: currentLang,
    changeLanguage,
    availableLanguages: getAvailableLanguages(),
  };
}
