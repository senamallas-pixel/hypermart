# Multi-Language Support Setup Guide

## Overview
HyperMart now supports multiple languages: English, Hindi (हिन्दी), and Telugu (తెలుగు).

## How It Works

### 1. Translation Files
Translation files are located in `public/locales/[language]/translation.json`:
- `public/locales/en/translation.json` - English
- `public/locales/hi/translation.json` - Hindi
- `public/locales/te/translation.json` - Telugu

### 2. Using Translations in Components

#### Method 1: Using Translation Directly
```jsx
import { t } from '../lib/i18n';

export default function MyComponent() {
  return <h1>{t('common.appName')}</h1>; // Renders "HyperMart", "हाइपरमार्ट", or "హైపర్మార్ట్"
}
```

#### Method 2: Using useTranslation Hook
```jsx
import { useTranslation } from '../hooks/useTranslation';

export default function MyComponent() {
  const { t, language, changeLanguage, availableLanguages } = useTranslation();

  return (
    <div>
      <h1>{t('common.appName')}</h1>
      <p>Current language: {language}</p>
      <button onClick={() => changeLanguage('hi')}>
        Switch to Hindi
      </button>
    </div>
  );
}
```

### 3. Translation Keys Structure
All keys follow a hierarchy:
```
common.*          - Common words (appName, home, profile, etc.)
navigation.*      - Navigation labels
marketplace.*     - Marketplace specific strings
profile.*         - Profile page strings
orders.*          - Orders page strings
settings.*        - Settings page strings
validation.*      - Validation messages
messages.*        - Generic messages
```

### 4. Language Selector Component
The `LanguageSelector` component is already integrated in the navbar. Users can click it to switch languages.

```jsx
import LanguageSelector from '../components/LanguageSelector';

export default function Navbar() {
  return (
    <nav>
      {/* ... */}
      <LanguageSelector />
      {/* ... */}
    </nav>
  );
}
```

## Adding New Translations

### Step 1: Add to All Language Files
Add the same key to all translation files with the translated text:

**English (`en/translation.json`):**
```json
{
  "mySection": {
    "myKey": "English text"
  }
}
```

**Hindi (`hi/translation.json`):**
```json
{
  "mySection": {
    "myKey": "हिंदी पाठ"
  }
}
```

**Telugu (`te/translation.json`):**
```json
{
  "mySection": {
    "myKey": "తెలుగు పాఠం"
  }
}
```

### Step 2: Use in Your Component
```jsx
import { t } from '../lib/i18n';

export default function MyComponent() {
  return <p>{t('mySection.myKey')}</p>;
}
```

## Supported Languages
- `en` - English 🇺🇸
- `hi` - Hindi (हिन्दी) 🇮🇳
- `te` - Telugu (తెలుగు) 🇮🇳

## Technical Details

### i18n Library
- Uses a lightweight custom i18n solution (no external dependencies required)
- Loads translations from JSON files in `public/locales/`
- Stores user language preference in localStorage

### Components
- **`src/lib/i18n.js`** - Core i18n library functions
- **`src/hooks/useTranslation.js`** - React hook for translations
- **`src/components/LanguageSelector.jsx`** - Language selector UI component
- **`src/context/AppContext.jsx`** - Updated to include language state

### How Language Changes Work
1. User clicks language selector
2. Language code is saved to localStorage
3. Page reloads to apply translations
4. App loads with new language from localStorage

## Adding More Languages

To add a new language (e.g., Spanish):

1. Create `public/locales/es/translation.json` with all keys from English
2. Update `src/lib/i18n.js` to include the new language:
   ```javascript
   const languages = {
     en: () => import('../../public/locales/en/translation.json'),
     hi: () => import('../../public/locales/hi/translation.json'),
     te: () => import('../../public/locales/te/translation.json'),
     es: () => import('../../public/locales/es/translation.json'), // Add this
   };
   
   const languageNames = {
     en: 'English',
     hi: 'हिन्दी',
     te: 'తెలుగు',
     es: 'Español', // Add this
   };
   ```
3. Update `src/components/LanguageSelector.jsx` with the new language:
   ```javascript
   const languages = [
     { code: 'en', name: 'English', flag: '🇺🇸' },
     { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
     { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
     { code: 'es', name: 'Español', flag: '🇪🇸' }, // Add this
   ];
   ```

## Best Practices

1. **Use consistent key naming**: Use dot notation for hierarchy
2. **Keep translations updated**: Always update all language files when adding new strings
3. **Test missing keys**: If a translation key is missing, the original key is shown
4. **Use meaningful keys**: Use descriptive names that show the context

Example good keys:
- ✅ `orders.orderHistory` - Clear section and meaning
- ✅ `profile.myProfile` - Specific and hierarchical
- ❌ `text1` - Not descriptive
- ❌ `homepage.stuff` - Too vague

## Troubleshooting

### Translations not appearing?
1. Check browser localStorage - language might be set to wrong code
2. Verify translation JSON files are in correct location
3. Check console for i18n initialization errors
4. Try clearing localStorage and reloading

### Specific key showing instead of translation?
1. Check if key exists in all language files
2. Verify correct JSON syntax (quotes, commas, etc.)
3. Check for typos in key path
4. Use browser DevTools to verify translations loaded

### Language not switching?
1. Make sure language code is correct (en, hi, te)
2. Check if localStorage is accessible
3. Try hard refresh (Ctrl+F5 or Cmd+Shift+R)

## Default Language
- **English (en)** is the default language
- Stored in localStorage as `hypermart_language`
- Can be overridden by user selection

## Supported Regions
- **English**: Neutral/International
- **Hindi**: India (हिन्दी)
- **Telugu**: India (తెలుగు)

---

For questions or issues with translations, check the translation JSON files in `public/locales/` directory.
