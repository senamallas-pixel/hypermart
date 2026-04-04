// src/components/LanguageSelector.jsx
// Language selector dropdown component

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
];

export default function LanguageSelector() {
  const { language, setLanguage } = useApp();
  const [showDropdown, setShowDropdown] = useState(false);

  const currentLang = languages.find(l => l.code === language);

  const handleLanguageChange = (langCode) => {
    setLanguage(langCode);
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 bg-[#F5F5F0] rounded-lg border border-[#1A1A1A]/10 hover:bg-[#EBEBDB] transition-colors text-[#5A5A40] font-medium text-sm"
        title="Change language"
      >
        <Globe size={16} />
        <span>{currentLang?.flag} {currentLang?.name}</span>
      </motion.button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 right-0 bg-white border border-[#1A1A1A]/10 rounded-lg shadow-lg z-50 min-w-max"
          >
            {languages.map(lang => (
              <motion.button
                key={lang.code}
                whileHover={{ x: 4 }}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#F5F5F0] transition-colors border-b border-[#1A1A1A]/5 last:border-b-0 ${
                  language === lang.code ? 'bg-[#F5F5F0]' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span className="font-medium text-[#1A1A1A]">{lang.name}</span>
                </div>
                {language === lang.code && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <Check size={16} className="text-[#5A5A40]" />
                  </motion.div>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
