import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { updateMe, uploadFile } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Colors, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import { API_URL } from '../../constants/config';

const ROLE_CONFIG = {
  customer: { bg: Colors.successBg, text: Colors.success, icon: 'person-outline', label: 'Customer' },
  owner:    { bg: Colors.warningBg, text: Colors.warningDark, icon: 'storefront-outline', label: 'Shop Owner' },
  admin:    { bg: Colors.infoBg,    text: Colors.infoDark, icon: 'shield-outline', label: 'Admin' },
};

function Field({ label, icon, value, onChangeText, editable, keyboardType, multiline, placeholder }) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 5 }}>
        {label.toUpperCase()}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center',
        backgroundColor: Colors.background, borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        borderColor: editable ? Colors.primary + '60' : 'transparent',
        paddingHorizontal: 12, paddingVertical: multiline ? 10 : 0,
        minHeight: multiline ? 72 : 48,
      }}>
        {icon && (
          <Ionicons
            name={icon}
            size={15}
            color={editable ? Colors.primary : Colors.textMuted}
            style={{ marginRight: 8, marginTop: multiline ? 2 : 0 }}
          />
        )}
        {editable ? (
          <TextInput
            style={{
              flex: 1, fontSize: 14, color: Colors.textPrimary,
              textAlignVertical: multiline ? 'top' : 'auto',
              paddingVertical: multiline ? 0 : 12,
            }}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType || 'default'}
            multiline={multiline}
            placeholder={placeholder || 'Not set'}
            placeholderTextColor={Colors.textLight}
          />
        ) : (
          <Text style={{ flex: 1, fontSize: 14, color: value ? Colors.textPrimary : Colors.textLight, paddingVertical: multiline ? 0 : 12 }}>
            {value || placeholder || 'Not set'}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function CustomerProfileScreen() {
  const { currentUser, setCurrentUser, signOut } = useApp();
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [name, setName] = useState(currentUser?.display_name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [address, setAddress] = useState(currentUser?.address || '');

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.display_name || '');
      setPhone(currentUser.phone || '');
      setAddress(currentUser.address || '');
    }
  }, [currentUser]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await updateMe({
        display_name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      setCurrentUser(res.data);
      setEditing(false);
      Alert.alert(t('common.success'), t('profile.profileUpdated'));
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.detail || t('profile.updateFailed'));
    } finally { setLoading(false); }
  };

  const handleCancel = () => {
    setEditing(false);
    setName(currentUser?.display_name || '');
    setPhone(currentUser?.phone || '');
    setAddress(currentUser?.address || '');
  };

  const handlePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setUploadingPhoto(true);
      try {
        const uploadRes = await uploadFile(asset.uri, 'profile.jpg', 'image/jpeg');
        const photoUrl = uploadRes.data?.url || uploadRes.data?.path;
        if (photoUrl) {
          const res = await updateMe({ photo_url: photoUrl });
          setCurrentUser(res.data);
        }
      } catch {
        Alert.alert(t('common.error'), t('profile.photoUploadError'));
      } finally { setUploadingPhoto(false); }
    }
  };

  const photoUri = currentUser?.photo_url
    ? (currentUser.photo_url.startsWith('http') ? currentUser.photo_url : `${API_URL}${currentUser.photo_url}`)
    : null;

  const roleConf = ROLE_CONFIG[currentUser?.role] || ROLE_CONFIG.customer;
  const initials = (currentUser?.display_name || '?').substring(0, 2).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Hero header */}
        <View style={{
          backgroundColor: Colors.primary,
          paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 50,
        }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>{t('profile.myProfile')}</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            Manage your account details
          </Text>
        </View>

        {/* Avatar card - overlaps the header */}
        <View style={{
          marginHorizontal: Spacing.lg, marginTop: -36,
          backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
          padding: Spacing.lg, alignItems: 'center', ...Shadow.md,
        }}>
          <TouchableOpacity onPress={handlePhoto} disabled={uploadingPhoto} style={{ marginBottom: Spacing.md }}>
            <View style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: Colors.primary,
              justifyContent: 'center', alignItems: 'center',
              overflow: 'hidden',
              borderWidth: 3, borderColor: Colors.white,
              ...Shadow.sm,
            }}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={{ width: 88, height: 88 }} />
              ) : (
                <Text style={{ fontSize: 30, color: '#fff', fontWeight: '800' }}>{initials}</Text>
              )}
            </View>
            <View style={{
              position: 'absolute', bottom: 0, right: 0,
              backgroundColor: Colors.primary, borderRadius: 14,
              width: 28, height: 28,
              justifyContent: 'center', alignItems: 'center',
              borderWidth: 2, borderColor: Colors.white,
            }}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={13} color="#fff" />
              )}
            </View>
          </TouchableOpacity>

          <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.textPrimary }}>
            {currentUser?.display_name}
          </Text>
          <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 2 }}>{currentUser?.email}</Text>

          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8,
            paddingHorizontal: 12, paddingVertical: 5,
            backgroundColor: roleConf.bg, borderRadius: BorderRadius.full,
          }}>
            <Ionicons name={roleConf.icon} size={12} color={roleConf.text} />
            <Text style={{ fontSize: 11, color: roleConf.text, fontWeight: '700' }}>
              {roleConf.label}
            </Text>
          </View>
        </View>

        {/* Info card */}
        <View style={{
          margin: Spacing.lg,
          backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
          padding: Spacing.lg, ...Shadow.sm,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>Personal Info</Text>
            {!editing ? (
              <TouchableOpacity
                onPress={() => setEditing(true)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 12, paddingVertical: 6,
                  backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.full,
                }}
              >
                <Ionicons name="create-outline" size={14} color={Colors.primary} />
                <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '700' }}>Edit</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Field
            label="Full Name"
            icon="person-outline"
            value={name}
            onChangeText={setName}
            editable={editing}
          />

          {/* Email — read-only always */}
          <View style={{ marginBottom: Spacing.md }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 5 }}>
              EMAIL
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: Colors.backgroundAlt, borderRadius: BorderRadius.md,
              paddingHorizontal: 12, paddingVertical: 12, gap: 8,
            }}>
              <Ionicons name="mail-outline" size={15} color={Colors.textMuted} />
              <Text style={{ flex: 1, fontSize: 14, color: Colors.textSecondary }}>{currentUser?.email}</Text>
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: Colors.successBg, borderRadius: BorderRadius.xs }}>
                <Text style={{ fontSize: 9, color: Colors.success, fontWeight: '700' }}>VERIFIED</Text>
              </View>
            </View>
          </View>

          <Field
            label="Phone"
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            editable={editing}
            keyboardType="phone-pad"
            placeholder="Add phone number"
          />

          <Field
            label="Address"
            icon="location-outline"
            value={address}
            onChangeText={setAddress}
            editable={editing}
            multiline
            placeholder="Add delivery address"
          />

          {editing && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: Spacing.sm }}>
              <TouchableOpacity
                onPress={handleCancel}
                style={{
                  flex: 1, borderRadius: BorderRadius.md, paddingVertical: 12,
                  alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border,
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                }}
              >
                <Ionicons name="close-outline" size={16} color={Colors.textSecondary} />
                <Text style={{ fontWeight: '700', color: Colors.textSecondary }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={loading}
                style={{
                  flex: 1, backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
                  paddingVertical: 12, alignItems: 'center', opacity: loading ? 0.6 : 1,
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={{ fontWeight: '700', color: '#fff' }}>{t('profile.saveChanges')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Sign out */}
        <View style={{ marginHorizontal: Spacing.lg }}>
          <TouchableOpacity
            onPress={() => {
              Alert.alert(t('common.logout'), t('settings.logoutConfirm'), [
                { text: t('settings.no'), style: 'cancel' },
                { text: t('settings.yes'), onPress: signOut },
              ]);
            }}
            style={{
              backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
              paddingVertical: 15, alignItems: 'center',
              flexDirection: 'row', justifyContent: 'center', gap: 8,
              borderWidth: 1.5, borderColor: Colors.danger + '40',
              ...Shadow.sm,
            }}
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            <Text style={{ color: Colors.danger, fontWeight: '700', fontSize: 14 }}>{t('common.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
