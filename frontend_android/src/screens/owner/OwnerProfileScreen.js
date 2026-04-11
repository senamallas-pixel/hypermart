import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateMe, getMyShops, updateShop } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';

export default function OwnerProfileScreen() {
  const { currentUser, setCurrentUser, signOut } = useApp();
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(currentUser?.display_name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [shops, setShops] = useState([]);

  useEffect(() => {
    getMyShops().then(res => setShops(res.data || [])).catch(() => {});
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await updateMe({ display_name: name.trim(), phone: phone.trim() || undefined });
      setCurrentUser(res.data);
      setEditing(false);
      Alert.alert(t('common.success'), t('profile.profileUpdated'));
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.detail || t('profile.updateFailed'));
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.lg }}>
          {t('profile.myProfile')}
        </Text>

        {/* Avatar */}
        <View style={{ alignItems: 'center', marginBottom: Spacing.xxl }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 32, color: '#fff', fontWeight: '700' }}>
              {(currentUser?.display_name || '?')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', marginTop: Spacing.md }}>{currentUser?.display_name}</Text>
          <Text style={{ fontSize: 13, color: Colors.textSecondary }}>{currentUser?.email}</Text>
          <View style={{
            paddingHorizontal: 10, paddingVertical: 3, marginTop: 4,
            backgroundColor: Colors.warningBg, borderRadius: BorderRadius.full,
          }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.warning }}>SHOP OWNER</Text>
          </View>
        </View>

        {/* Personal info */}
        <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>Personal Info</Text>
            {!editing && (
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 13 }}>{t('common.edit')}</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 4 }}>Name</Text>
          <TextInput
            style={inputStyle}
            value={name} onChangeText={setName} editable={editing}
          />
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 4 }}>Phone</Text>
          <TextInput
            style={inputStyle}
            value={phone} onChangeText={setPhone} editable={editing}
            keyboardType="phone-pad" placeholder="Not set" placeholderTextColor={Colors.textLight}
          />

          {editing && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setEditing(false); setName(currentUser?.display_name || ''); setPhone(currentUser?.phone || ''); }}
                style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ fontWeight: '600', color: Colors.textSecondary }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave} disabled={loading}
                style={{ flex: 1, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center', opacity: loading ? 0.6 : 1 }}
              >
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontWeight: '600', color: '#fff' }}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Shops list */}
        <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: Spacing.md }}>My Shops</Text>
          {shops.map(s => (
            <View key={s.id} style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600' }}>{s.name}</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>{s.category}</Text>
              </View>
              <View style={{
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full,
                backgroundColor: s.status === 'approved' ? Colors.successBg : Colors.warningBg,
              }}>
                <Text style={{
                  fontSize: 10, fontWeight: '600',
                  color: s.status === 'approved' ? Colors.success : Colors.warning,
                }}>
                  {s.status?.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
          {shops.length === 0 && (
            <Text style={{ color: Colors.textMuted, textAlign: 'center' }}>No shops registered</Text>
          )}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          onPress={() => {
            Alert.alert(t('common.logout'), t('settings.logoutConfirm'), [
              { text: t('settings.no'), style: 'cancel' },
              { text: t('settings.yes'), onPress: signOut },
            ]);
          }}
          style={{
            backgroundColor: Colors.dangerBg, borderRadius: BorderRadius.lg,
            paddingVertical: 14, alignItems: 'center',
          }}
        >
          <Text style={{ color: Colors.danger, fontWeight: '600' }}>{t('common.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const inputStyle = {
  backgroundColor: Colors.background,
  borderRadius: BorderRadius.md,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 14,
  color: Colors.textPrimary,
  marginBottom: 10,
};
