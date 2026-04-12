import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Switch, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { changePassword, deleteMyAccount } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import LanguageSelector from '../../components/LanguageSelector';
import { Colors, BorderRadius, Spacing, Shadow } from '../../constants/theme';

const TABS = [
  { key: 'password', label: 'Password', icon: 'key-outline' },
  { key: 'notifications', label: 'Alerts', icon: 'notifications-outline' },
  { key: 'security', label: 'Security', icon: 'shield-outline' },
];

function PasswordField({ label, icon, value, onChangeText, show, onToggleShow }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.background, borderRadius: BorderRadius.md,
        paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border,
      }}>
        <Ionicons name={icon} size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={{ flex: 1, fontSize: 14, color: Colors.textPrimary, paddingVertical: 13 }}
          placeholder={label}
          placeholderTextColor={Colors.textLight}
          secureTextEntry={!show}
          value={value}
          onChangeText={onChangeText}
        />
        <TouchableOpacity onPress={onToggleShow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SwitchRow({ label, desc, icon, value, onValueChange, isLast }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: Spacing.md,
      borderBottomWidth: isLast ? 0 : 1, borderBottomColor: Colors.border,
      gap: 12,
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: Colors.primaryBg,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Ionicons name={icon} size={17} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary }}>{label}</Text>
        {desc && <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>{desc}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: Colors.primary, false: Colors.border }}
        thumbColor="#fff"
        ios_backgroundColor={Colors.border}
      />
    </View>
  );
}

export default function CustomerSettingsScreen() {
  const { signOut } = useApp();
  const { t } = useTranslation();
  const [tab, setTab] = useState('password');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

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
        text: t('common.delete'), style: 'destructive',
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{
        backgroundColor: Colors.white,
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 0,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: Colors.textPrimary }}>
            {t('settings.settings')}
          </Text>
          <LanguageSelector />
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row' }}>
          {TABS.map(tb => (
            <TouchableOpacity
              key={tb.key}
              onPress={() => setTab(tb.key)}
              style={{
                flex: 1, paddingVertical: 10,
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: 5,
                borderBottomWidth: tab === tb.key ? 2 : 0,
                borderBottomColor: Colors.primary,
              }}
            >
              <Ionicons
                name={tb.icon}
                size={14}
                color={tab === tb.key ? Colors.primary : Colors.textMuted}
              />
              <Text style={{
                fontSize: 12, fontWeight: '700',
                color: tab === tb.key ? Colors.primary : Colors.textMuted,
              }}>
                {tb.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
        {/* ─── Password tab ─── */}
        {tab === 'password' && (
          <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadow.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg }}>
              <Ionicons name="key-outline" size={18} color={Colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>
                {t('settings.changePassword')}
              </Text>
            </View>

            <PasswordField
              label={t('settings.enterCurrentPassword')}
              icon="lock-closed-outline"
              value={currentPw}
              onChangeText={v => { setCurrentPw(v); setPwError(''); setPwMsg(''); }}
              show={showCurrent}
              onToggleShow={() => setShowCurrent(v => !v)}
            />
            <PasswordField
              label={t('settings.enterNewPassword')}
              icon="lock-open-outline"
              value={newPw}
              onChangeText={v => { setNewPw(v); setPwError(''); setPwMsg(''); }}
              show={showNew}
              onToggleShow={() => setShowNew(v => !v)}
            />
            <PasswordField
              label={t('settings.confirmNewPassword')}
              icon="checkmark-circle-outline"
              value={confirmPw}
              onChangeText={v => { setConfirmPw(v); setPwError(''); setPwMsg(''); }}
              show={showConfirm}
              onToggleShow={() => setShowConfirm(v => !v)}
            />

            {!!pwError && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
                <Text style={{ color: Colors.danger, fontSize: 12, fontWeight: '600', flex: 1 }}>{pwError}</Text>
              </View>
            )}
            {!!pwMsg && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
                <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '600', flex: 1 }}>{pwMsg}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleChangePassword}
              disabled={pwLoading || !currentPw || !newPw || !confirmPw}
              style={{
                backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
                paddingVertical: 13, alignItems: 'center', marginTop: 4,
                opacity: (pwLoading || !currentPw || !newPw || !confirmPw) ? 0.5 : 1,
                flexDirection: 'row', justifyContent: 'center', gap: 7,
              }}
            >
              {pwLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{t('settings.updatePassword')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Notifications tab ─── */}
        {tab === 'notifications' && (
          <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadow.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg }}>
              <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>
                {t('settings.notificationPreferences')}
              </Text>
            </View>
            <SwitchRow
              label={t('settings.emailOrderNotifications')}
              desc={t('settings.ordersPlacedDelivered')}
              icon="mail-outline"
              value={emailOrders}
              onValueChange={setEmailOrders}
            />
            <SwitchRow
              label={t('settings.promotionalEmails')}
              desc={t('settings.specialOffers')}
              icon="pricetag-outline"
              value={emailPromo}
              onValueChange={setEmailPromo}
            />
            <SwitchRow
              label={t('settings.smsOrderNotifications')}
              desc={t('settings.smsStatusUpdates')}
              icon="chatbubble-outline"
              value={smsOrders}
              onValueChange={setSmsOrders}
              isLast
            />
          </View>
        )}

        {/* ─── Security tab ─── */}
        {tab === 'security' && (
          <View style={{ gap: Spacing.md }}>
            {/* Active session */}
            <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadow.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md }}>
                <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>
                  {t('settings.activeSessions')}
                </Text>
              </View>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: Spacing.md, backgroundColor: Colors.background, borderRadius: BorderRadius.md,
              }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: Colors.successBg,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Ionicons name="phone-portrait-outline" size={16} color={Colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>
                    {t('settings.thisDevice')}
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>{t('settings.lastActive')}</Text>
                </View>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3,
                  backgroundColor: Colors.successBg, borderRadius: BorderRadius.full,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.success }}>
                    {t('settings.current')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Logout */}
            <TouchableOpacity
              onPress={() => {
                Alert.alert(t('common.logout'), t('settings.logoutConfirm'), [
                  { text: t('settings.no'), style: 'cancel' },
                  { text: t('settings.yes'), onPress: signOut },
                ]);
              }}
              style={{
                backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
                paddingVertical: 14, alignItems: 'center',
                flexDirection: 'row', justifyContent: 'center', gap: 8,
                ...Shadow.sm,
              }}
            >
              <Ionicons name="log-out-outline" size={18} color={Colors.primary} />
              <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 14 }}>{t('settings.logoutButton')}</Text>
            </TouchableOpacity>

            {/* Delete account */}
            <TouchableOpacity
              onPress={handleDeleteAccount}
              style={{
                backgroundColor: Colors.dangerBg, borderRadius: BorderRadius.xl,
                paddingVertical: 14, alignItems: 'center',
                flexDirection: 'row', justifyContent: 'center', gap: 8,
                borderWidth: 1.5, borderColor: Colors.danger + '30',
              }}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              <Text style={{ color: Colors.danger, fontWeight: '700', fontSize: 14 }}>{t('settings.deleteAccount')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
