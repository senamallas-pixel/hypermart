import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Switch, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { changePassword, deleteMyAccount } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import LanguageSelector from '../../components/LanguageSelector';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';

export default function CustomerSettingsScreen() {
  const { signOut } = useApp();
  const { t } = useTranslation();
  const [tab, setTab] = useState('password');

  // Password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  // Notification state
  const [emailOrders, setEmailOrders] = useState(true);
  const [emailPromo, setEmailPromo] = useState(false);
  const [smsOrders, setSmsOrders] = useState(true);

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { setPwError(t('settings.passwordMustMatch')); return; }
    if (newPw.length < 8) { setPwError(t('settings.passwordMinLength')); return; }
    setPwLoading(true); setPwError(''); setPwMsg('');
    try {
      await changePassword({ current_password: currentPw, new_password: newPw });
      setPwMsg(t('settings.passwordChangedSuccess'));
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwError(err.response?.data?.detail || t('settings.passwordChangeFailed'));
    } finally { setPwLoading(false); }
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('settings.deleteAccount'), t('settings.deleteAccountConfirm'), [
      { text: t('settings.no'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMyAccount();
            signOut();
          } catch (err) {
            Alert.alert(t('common.error'), err.response?.data?.detail || 'Failed to delete account');
          }
        },
      },
    ]);
  };

  const TABS = [
    { key: 'password', label: t('settings.password') },
    { key: 'notifications', label: t('settings.notifications') },
    { key: 'security', label: t('settings.security') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: Spacing.lg, backgroundColor: Colors.white,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
      }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.textPrimary }}>
          {t('settings.settings')}
        </Text>
        <LanguageSelector />
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row', backgroundColor: Colors.white,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
      }}>
        {TABS.map(tb => (
          <TouchableOpacity
            key={tb.key}
            onPress={() => setTab(tb.key)}
            style={{
              flex: 1, paddingVertical: 12, alignItems: 'center',
              borderBottomWidth: tab === tb.key ? 2 : 0,
              borderBottomColor: Colors.primary,
            }}
          >
            <Text style={{
              fontSize: 12, fontWeight: '600',
              color: tab === tb.key ? Colors.primary : Colors.textMuted,
            }}>
              {tb.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
        {tab === 'password' && (
          <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: Spacing.lg }}>
              {t('settings.changePassword')}
            </Text>
            <TextInput
              style={inputStyle}
              placeholder={t('settings.enterCurrentPassword')}
              placeholderTextColor={Colors.textLight}
              secureTextEntry
              value={currentPw}
              onChangeText={v => { setCurrentPw(v); setPwError(''); setPwMsg(''); }}
            />
            <TextInput
              style={inputStyle}
              placeholder={t('settings.enterNewPassword')}
              placeholderTextColor={Colors.textLight}
              secureTextEntry
              value={newPw}
              onChangeText={v => { setNewPw(v); setPwError(''); setPwMsg(''); }}
            />
            <TextInput
              style={inputStyle}
              placeholder={t('settings.confirmNewPassword')}
              placeholderTextColor={Colors.textLight}
              secureTextEntry
              value={confirmPw}
              onChangeText={v => { setConfirmPw(v); setPwError(''); setPwMsg(''); }}
            />
            {!!pwError && <Text style={{ color: Colors.danger, fontSize: 12, marginBottom: 8 }}>{pwError}</Text>}
            {!!pwMsg && <Text style={{ color: Colors.success, fontSize: 12, marginBottom: 8 }}>{pwMsg}</Text>}
            <TouchableOpacity
              onPress={handleChangePassword}
              disabled={pwLoading}
              style={{
                backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
                paddingVertical: 12, alignItems: 'center', opacity: pwLoading ? 0.6 : 1,
              }}
            >
              {pwLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '600' }}>{t('settings.updatePassword')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {tab === 'notifications' && (
          <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: Spacing.lg }}>
              {t('settings.notificationPreferences')}
            </Text>
            {[
              { label: t('settings.emailOrderNotifications'), desc: t('settings.ordersPlacedDelivered'), value: emailOrders, setter: setEmailOrders },
              { label: t('settings.promotionalEmails'), desc: t('settings.specialOffers'), value: emailPromo, setter: setEmailPromo },
              { label: t('settings.smsOrderNotifications'), desc: t('settings.smsStatusUpdates'), value: smsOrders, setter: setSmsOrders },
            ].map((item, i) => (
              <View key={i} style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingVertical: Spacing.md,
                borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: Colors.border,
              }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary }}>{item.label}</Text>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>{item.desc}</Text>
                </View>
                <Switch
                  value={item.value}
                  onValueChange={item.setter}
                  trackColor={{ true: Colors.primary, false: Colors.border }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </View>
        )}

        {tab === 'security' && (
          <View>
            <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg }}>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: Spacing.md }}>
                {t('settings.activeSessions')}
              </Text>
              <View style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                padding: Spacing.md, backgroundColor: Colors.background, borderRadius: BorderRadius.md,
              }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600' }}>{t('settings.thisDevice')}</Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>{t('settings.lastActive')}</Text>
                </View>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Colors.successBg,
                  borderRadius: BorderRadius.full,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.success }}>
                    {t('settings.current')}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                Alert.alert(t('common.logout'), t('settings.logoutConfirm'), [
                  { text: t('settings.no'), style: 'cancel' },
                  { text: t('settings.yes'), onPress: signOut },
                ]);
              }}
              style={{
                backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
                paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.md,
              }}
            >
              <Text style={{ color: Colors.primary, fontWeight: '600' }}>{t('settings.logoutButton')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDeleteAccount}
              style={{
                backgroundColor: Colors.dangerBg, borderRadius: BorderRadius.xl,
                paddingVertical: 14, alignItems: 'center',
              }}
            >
              <Text style={{ color: Colors.danger, fontWeight: '600' }}>{t('settings.deleteAccount')}</Text>
            </TouchableOpacity>
          </View>
        )}
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
