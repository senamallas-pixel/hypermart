import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  listShops, listUsers, updateShopStatus, changeRole,
  deleteUser, toggleMultiLocation, getPlatformAnalytics,
} from '../../api/client';
import { useTranslation } from '../../hooks/useTranslation';
import StatCard from '../../components/StatCard';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';

const TABS = ['Pending', 'Shops', 'Users', 'Analytics'];

export default function AdminPanelScreen() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('Pending');
  const [shops, setShops] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const [shopRes, userRes] = await Promise.all([listShops(), listUsers()]);
      setShops(shopRes.data?.items || (Array.isArray(shopRes.data) ? shopRes.data : []));
      setUsers(Array.isArray(userRes.data) ? userRes.data : []);
      try {
        const analyticsRes = await getPlatformAnalytics();
        setAnalytics(analyticsRes.data);
      } catch {}
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingShops = shops.filter(s => s.status === 'pending');
  const approvedShops = shops.filter(s => s.status === 'approved');

  const handleShopStatus = async (shopId, status) => {
    try {
      await updateShopStatus(shopId, status);
      load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update shop status');
    }
  };

  const handleRoleChange = (user, newRole) => {
    Alert.alert('Change Role', `Change ${user.display_name}'s role to ${newRole}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await changeRole(user.id, newRole);
            load();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed to change role');
          }
        },
      },
    ]);
  };

  const handleDeleteUser = (user) => {
    Alert.alert(t('admin.deleteUser'), t('admin.deleteConfirm'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUser(user.id);
            load();
            Alert.alert('Success', t('admin.userDeleted'));
          } catch (err) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed to delete user');
          }
        },
      },
    ]);
  };

  const handleMultiLocation = async (userId, enabled) => {
    try {
      await toggleMultiLocation(userId, enabled);
      load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to toggle');
    }
  };

  const filteredUsers = searchQuery
    ? users.filter(u =>
        (u.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
          {t('navigation.admin')}
        </Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
          {users.length} users {'\u2022'} {shops.length} shops {'\u2022'} {pendingShops.length} pending
        </Text>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border }}
        contentContainerStyle={{ paddingHorizontal: Spacing.md }}
      >
        {TABS.map(tb => (
          <TouchableOpacity
            key={tb}
            onPress={() => setActiveTab(tb)}
            style={{
              paddingVertical: 12, paddingHorizontal: 16,
              borderBottomWidth: activeTab === tb ? 2 : 0,
              borderBottomColor: Colors.primary,
            }}
          >
            <Text style={{
              fontSize: 13, fontWeight: '600',
              color: activeTab === tb ? Colors.primary : Colors.textMuted,
            }}>
              {tb}{tb === 'Pending' ? ` (${pendingShops.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={Colors.primary} />}
      >
        {/* ─── Pending Approvals ─── */}
        {activeTab === 'Pending' && (
          pendingShops.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>{'\u2705'}</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.textSecondary }}>No pending approvals</Text>
            </View>
          ) : (
            pendingShops.map(shop => (
              <View key={shop.id} style={{
                backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                padding: Spacing.lg, marginBottom: Spacing.sm,
              }}>
                <Text style={{ fontSize: 16, fontWeight: '700' }}>{shop.name}</Text>
                <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
                  {shop.category} {'\u2022'} {shop.address || shop.location_name || 'No address'}
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4 }}>
                  Owner ID: {shop.owner_id} {'\u2022'} {new Date(shop.created_at).toLocaleDateString('en-IN')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: Spacing.md }}>
                  <TouchableOpacity
                    onPress={() => handleShopStatus(shop.id, 'approved')}
                    style={{ flex: 1, backgroundColor: Colors.success, borderRadius: BorderRadius.md, paddingVertical: 10, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleShopStatus(shop.id, 'rejected')}
                    style={{ flex: 1, backgroundColor: Colors.danger, borderRadius: BorderRadius.md, paddingVertical: 10, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        )}

        {/* ─── All Shops ─── */}
        {activeTab === 'Shops' && (
          approvedShops.length === 0 ? (
            <Text style={{ textAlign: 'center', color: Colors.textMuted, marginTop: 30 }}>No shops yet</Text>
          ) : (
            approvedShops.map(shop => (
              <View key={shop.id} style={{
                backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                padding: Spacing.md, marginBottom: Spacing.sm,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600' }}>{shop.name}</Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                    {shop.category} {'\u2022'} {shop.location_name || shop.city || 'Unknown'}
                  </Text>
                </View>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full,
                  backgroundColor: shop.is_open ? Colors.successBg : Colors.dangerBg,
                }}>
                  <Text style={{
                    fontSize: 10, fontWeight: '600',
                    color: shop.is_open ? Colors.success : Colors.danger,
                  }}>
                    {shop.is_open ? 'OPEN' : 'CLOSED'}
                  </Text>
                </View>
              </View>
            ))
          )
        )}

        {/* ─── Users ─── */}
        {activeTab === 'Users' && (
          <View>
            <TextInput
              style={{
                backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                paddingHorizontal: 16, paddingVertical: 12, fontSize: 14,
                marginBottom: Spacing.md, color: Colors.textPrimary,
              }}
              placeholder={t('admin.searchUsers')}
              placeholderTextColor={Colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {filteredUsers.map(user => (
              <View key={user.id} style={{
                backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                padding: Spacing.md, marginBottom: Spacing.sm,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600' }}>{user.display_name || 'No name'}</Text>
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>{user.email}</Text>
                  </View>
                  <View style={{
                    paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full,
                    backgroundColor: user.role === 'admin' ? Colors.infoBg : user.role === 'owner' ? Colors.warningBg : Colors.successBg,
                  }}>
                    <Text style={{
                      fontSize: 10, fontWeight: '600', textTransform: 'uppercase',
                      color: user.role === 'admin' ? Colors.info : user.role === 'owner' ? Colors.warning : Colors.success,
                    }}>
                      {user.role}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.sm }}>
                  {user.role !== 'admin' && (
                    <>
                      {user.role === 'customer' && (
                        <TouchableOpacity onPress={() => handleRoleChange(user, 'owner')}
                          style={{ backgroundColor: Colors.warningBg, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ color: Colors.warning, fontSize: 11, fontWeight: '600' }}>Make Owner</Text>
                        </TouchableOpacity>
                      )}
                      {user.role === 'owner' && (
                        <>
                          <TouchableOpacity onPress={() => handleRoleChange(user, 'customer')}
                            style={{ backgroundColor: Colors.successBg, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Text style={{ color: Colors.success, fontSize: 11, fontWeight: '600' }}>Make Customer</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleMultiLocation(user.id, !user.multi_location_enabled)}
                            style={{ backgroundColor: Colors.infoBg, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Text style={{ color: Colors.info, fontSize: 11, fontWeight: '600' }}>
                              {user.multi_location_enabled ? 'Disable' : 'Enable'} Multi-Location
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity onPress={() => handleDeleteUser(user)}
                        style={{ backgroundColor: Colors.dangerBg, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Text style={{ color: Colors.danger, fontSize: 11, fontWeight: '600' }}>Delete</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ─── Analytics ─── */}
        {activeTab === 'Analytics' && (
          analytics ? (
            <View style={{ gap: 10 }}>
              <StatCard label="Total Users" value={analytics.total_users || 0} icon="\uD83D\uDC65" />
              <StatCard label="Total Shops" value={analytics.total_shops || 0} icon="\uD83C\uDFEA" />
              <StatCard label="Total Orders" value={analytics.total_orders || 0} icon="\uD83D\uDCE6" />
              <StatCard label="Total Revenue" value={`\u20B9${analytics.total_revenue?.toFixed(0) || 0}`} icon="\uD83D\uDCB0" />
              <StatCard label="Active Subscriptions" value={analytics.active_subscriptions || 0} icon="\u2B50" />
            </View>
          ) : (
            <Text style={{ textAlign: 'center', color: Colors.textMuted, marginTop: 30 }}>
              No analytics data
            </Text>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
