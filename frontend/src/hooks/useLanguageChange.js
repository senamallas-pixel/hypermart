// src/hooks/useLanguageChange.js
// Hook that forces re-render when language changes

import { useEffect, useState } from 'react';
import { onLanguageChange } from '../lib/i18n';

export function useLanguageChange() {
  const [, setUpdateTrigger] = useState(0);

  useEffect(() => {
    // Subscribe to language changes and trigger re-render
    const unsubscribe = onLanguageChange(() => {
      setUpdateTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, []);

  return null; // No render needed, just side effects
}
