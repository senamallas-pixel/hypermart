import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { updateMe, uploadFile } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';
import { API_URL } from '../../constants/config';

export default function CustomerProfileScreen() {
  const { currentUser, setCurrentUser, signOut } = useApp();
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const handlePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      try {
        const uploadRes = await uploadFile(asset.uri, 'profile.jpg', 'image/jpeg');
        const photoUrl = uploadRes.data?.url || uploadRes.data?.path;
        if (photoUrl) {
          const res = await updateMe({ photo_url: photoUrl });
          setCurrentUser(res.data);
          Alert.alert(t('common.success'), t('profile.photoUploadSuccess'));
        }
      } catch {
        Alert.alert(t('common.error'), t('profile.photoUploadError'));
      }
    }
  };

  const photoUri = currentUser?.photo_url
    ? (currentUser.photo_url.startsWith('http') ? currentUser.photo_url : `${API_URL}${currentUser.photo_url}`)
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
        {/* Header */}
        <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.lg }}>
          {t('profile.myProfile')}
        </Text>

        {/* Avatar */}
        <View style={{ alignItems: 'center', marginBottom: Spacing.xxl }}>
          <TouchableOpacity onPress={handlePhoto}>
            <View style={{
              width: 96, height: 96, borderRadius: 48,
              backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
              overflow: 'hidden',
            }}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={{ width: 96, height: 96 }} />
              ) : (
                <Text style={{ fontSize: 36, color: '#fff', fontWeight: '700' }}>
                  {(currentUser?.display_name || '?')[0].toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{
              position: 'absolute', bottom: 0, right: 0,
              backgroundColor: Colors.white, borderRadius: 12,
              width: 28, height: 28, justifyContent: 'center', alignItems: 'center',
              borderWidth: 2, borderColor: Colors.background,
            }}>
              <Text style={{ fontSize: 12 }}>{'\uD83D\uDCF7'}</Text>
            </View>
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.md }}>
            {currentUser?.display_name}
          </Text>
          <Text style={{ fontSize: 13, color: Colors.textSecondary }}>{currentUser?.email}</Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
            paddingHorizontal: 10, paddingVertical: 3, backgroundColor: Colors.successBg,
            borderRadius: BorderRadius.full,
          }}>
            <Text style={{ fontSize: 10, color: Colors.success, fontWeight: '600' }}>
              {currentUser?.role?.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Info card */}
        <View style={{
          backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
          padding: Spacing.lg,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>Personal Info</Text>
            {!editing && (
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '600' }}>
                  {t('profile.editProfile')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 4 }}>{t('common.fullName')}</Text>
          <TextInput
            style={{
              backgroundColor: Colors.background, borderRadius: BorderRadius.md,
              paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
              color: Colors.textPrimary, marginBottom: Spacing.md,
            }}
            value={name}
            onChangeText={setName}
            editable={editing}
          />

          <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 4 }}>{t('common.email')}</Text>
          <View style={{
            backgroundColor: Colors.background, borderRadius: BorderRadius.md,
            paddingHorizontal: 14, paddingVertical: 12, marginBottom: Spacing.md,
          }}>
            <Text style={{ fontSize: 14, color: Colors.textSecondary }}>{currentUser?.email}</Text>
          </View>

          <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 4 }}>{t('common.phone')}</Text>
          <TextInput
            style={{
              backgroundColor: Colors.background, borderRadius: BorderRadius.md,
              paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
              color: Colors.textPrimary, marginBottom: Spacing.md,
            }}
            value={phone}
            onChangeText={setPhone}
            editable={editing}
            keyboardType="phone-pad"
            placeholder="Not set"
            placeholderTextColor={Colors.textLight}
          />

          <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 4 }}>{t('common.address')}</Text>
          <TextInput
            style={{
              backgroundColor: Colors.background, borderRadius: BorderRadius.md,
              paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
              color: Colors.textPrimary, marginBottom: Spacing.md, minHeight: 60,
              textAlignVertical: 'top',
            }}
            value={address}
            onChangeText={setAddress}
            editable={editing}
            multiline
            placeholder="Not set"
            placeholderTextColor={Colors.textLight}
          />

          {editing && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setEditing(false); setName(currentUser?.display_name || ''); setPhone(currentUser?.phone || ''); setAddress(currentUser?.address || ''); }}
                style={{
                  flex: 1, borderRadius: BorderRadius.md, paddingVertical: 12,
                  alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
                }}
              >
                <Text style={{ fontWeight: '600', color: Colors.textSecondary }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={loading}
                style={{
                  flex: 1, backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
                  paddingVertical: 12, alignItems: 'center', opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ fontWeight: '600', color: '#fff' }}>{t('profile.saveChanges')}</Text>
                )}
              </TouchableOpacity>
            </View>
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
            marginTop: Spacing.xxl, backgroundColor: Colors.dangerBg,
            borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: 'center',
          }}
        >
          <Text style={{ color: Colors.danger, fontWeight: '600' }}>{t('common.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
