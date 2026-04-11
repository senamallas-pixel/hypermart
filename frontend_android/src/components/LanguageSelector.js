import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { useTranslation } from '../hooks/useTranslation';
import { Colors, BorderRadius, Spacing } from '../constants/theme';

export default function LanguageSelector() {
  const { language, changeLanguage, availableLanguages } = useTranslation();
  const [visible, setVisible] = useState(false);

  const current = availableLanguages.find(l => l.code === language);

  return (
    <View>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.md,
          paddingHorizontal: 10, paddingVertical: 6,
        }}
      >
        <Text style={{ fontSize: 12 }}>{'\uD83C\uDF10'}</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>
          {current?.name || 'EN'}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={{
            backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
            padding: Spacing.lg, width: 200,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: Spacing.md }}>
              {'\uD83C\uDF10'} Language
            </Text>
            {availableLanguages.map(lang => (
              <TouchableOpacity
                key={lang.code}
                onPress={() => { changeLanguage(lang.code); setVisible(false); }}
                style={{
                  paddingVertical: 10, paddingHorizontal: 12,
                  borderRadius: BorderRadius.md, marginBottom: 4,
                  backgroundColor: language === lang.code ? 'rgba(90,90,64,0.08)' : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 14, fontWeight: language === lang.code ? '700' : '400',
                  color: language === lang.code ? Colors.primary : Colors.textPrimary,
                }}>
                  {lang.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
