import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  listShops, listUsers, updateShopStatus, changeRole,
  deleteUser, toggleMultiLocation, getPlatformAnalytics,
} from '../../api/client';
import { useTranslation } from '../../hooks/useTranslation';
import StatCard from '../../components/StatCard';
import { Colors, BorderRadius, Spacing, Shadow } from '../../constants/theme';

const TABS = [
  { key: 'Pending', label: 'Pending', icon: 'time-outline' },
  { key: 'Shops', label: 'Shops', icon: 'storefront-outline' },
  { key: 'Users', label: 'Users', icon: 'people-outline' },
  { key: 'Analytics', label: 'Analytics', icon: 'bar-chart-outline' },
];

const ROLE_COLORS = {
  admin:    { bg: Colors.infoBg,    text: Colors.infoDark },
  owner:    { bg: Colors.warningBg, text: Colors.warningDark },
  customer: { bg: Colors.successBg, text: Colors.successDark },
};

export default function AdminPanelScreen() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('Pending');
  const [shops, setShops] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

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
          try { await changeRole(user.id, newRole); load(); }
          catch (err) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
        },
      },
    ]);
  };

  const handleDeleteUser = (user) => {
    Alert.alert(t('admin.deleteUser'), t('admin.deleteConfirm'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteUser(user.id); load(); }
          catch (err) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
        },
      },
    ]);
  };

  const handleMultiLocation = async (userId, enabled) => {
    try { await toggleMultiLocation(userId, enabled); load(); }
    catch (err) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
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
      <View style={{
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="shield" size={20} color="rgba(255,255,255,0.8)" />
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>{t('navigation.admin')}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
          {[
            { label: `${users.length} users`, icon: 'people-outline' },
            { label: `${shops.length} shops`, icon: 'storefront-outline' },
            { label: `${pendingShops.length} pending`, icon: 'time-outline' },
          ].map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name={item.icon} size={12} color="rgba(255,255,255,0.5)" />
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row', backgroundColor: Colors.white,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
      }}>
        {TABS.map(tb => (
          <TouchableOpacity
            key={tb.key}
            onPress={() => setActiveTab(tb.key)}
            style={{
              flex: 1, paddingVertical: 11,
              alignItems: 'center', justifyContent: 'center',
              borderBottomWidth: activeTab === tb.key ? 2 : 0,
              borderBottomColor: Colors.primary,
              gap: 3,
            }}
          >
            <Ionicons
              name={tb.icon}
              size={16}
              color={activeTab === tb.key ? Colors.primary : Colors.textMuted}
            />
            <Text style={{
              fontSize: 10, fontWeight: '700',
              color: activeTab === tb.key ? Colors.primary : Colors.textMuted,
            }}>
              {tb.label}{tb.key === 'Pending' && pendingShops.length > 0 ? ` (${pendingShops.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* ─── Pending ─── */}
        {activeTab === 'Pending' && (
          pendingShops.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: Colors.successBg, justifyContent: 'center', alignItems: 'center',
                marginBottom: Spacing.lg,
              }}>
                <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textSecondary }}>
                All clear! No pending approvals.
              </Text>
            </View>
          ) : (
            pendingShops.map(shop => (
              <View key={shop.id} style={{
                backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
                padding: Spacing.lg, marginBottom: Spacing.md, ...Shadow.sm,
              }}>
                {/* Orange top stripe */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: Colors.warning, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: BorderRadius.md,
                    backgroundColor: Colors.warningBg,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Ionicons name="storefront-outline" size={20} color={Colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.textPrimary }}>{shop.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                      <Ionicons name="grid-outline" size={11} color={Colors.textMuted} />
                      <Text style={{ fontSize: 12, color: Colors.textMuted }}>{shop.category}</Text>
                    </View>
                  </View>
                </View>

                <View style={{ backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md, gap: 5 }}>
                  {(shop.address || shop.location_name) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
                      <Text style={{ fontSize: 12, color: Colors.textSecondary }}>{shop.address || shop.location_name}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
                    <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Owner ID: {shop.owner_id}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                    <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                      Applied {new Date(shop.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => handleShopStatus(shop.id, 'approved')}
                    style={{
                      flex: 1, backgroundColor: Colors.success, borderRadius: BorderRadius.md,
                      paddingVertical: 11, alignItems: 'center',
                      flexDirection: 'row', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleShopStatus(shop.id, 'rejected')}
                    style={{
                      flex: 1, backgroundColor: Colors.dangerBg, borderRadius: BorderRadius.md,
                      paddingVertical: 11, alignItems: 'center',
                      flexDirection: 'row', justifyContent: 'center', gap: 6,
                      borderWidth: 1.5, borderColor: Colors.danger + '40',
                    }}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
                    <Text style={{ color: Colors.danger, fontWeight: '800', fontSize: 13 }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        )}

        {/* ─── Shops ─── */}
        {activeTab === 'Shops' && (
          approvedShops.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="storefront-outline" size={56} color={Colors.border} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.textSecondary, marginTop: 16 }}>No approved shops yet</Text>
            </View>
          ) : (
            approvedShops.map(shop => (
              <View key={shop.id} style={{
                backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                padding: Spacing.md, marginBottom: Spacing.sm,
                flexDirection: 'row', alignItems: 'center', gap: 12, ...Shadow.sm,
              }}>
                <View style={{
                  width: 40, height: 40, borderRadius: BorderRadius.md,
                  backgroundColor: Colors.primaryBg, justifyContent: 'center', alignItems: 'center',
                }}>
                  <Ionicons name="storefront-outline" size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary }}>{shop.name}</Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                    {shop.category} · {shop.location_name || shop.city || 'Unknown'}
                  </Text>
                </View>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full,
                  backgroundColor: shop.is_open ? Colors.successBg : Colors.backgroundAlt,
                }}>
                  <Text style={{
                    fontSize: 10, fontWeight: '700',
                    color: shop.is_open ? Colors.success : Colors.textMuted,
                  }}>
                    {shop.is_open ? '● OPEN' : '● CLOSED'}
                  </Text>
                </View>
              </View>
            ))
          )
        )}

        {/* ─── Users ─── */}
        {activeTab === 'Users' && (
          <View>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
              paddingHorizontal: 14, paddingVertical: 2,
              marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
            }}>
              <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
              <TextInput
                style={{ flex: 1, fontSize: 14, color: Colors.textPrimary, paddingVertical: 12 }}
                placeholder={t('admin.searchUsers')}
                placeholderTextColor={Colors.textLight}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {filteredUsers.map(user => {
              const rc = ROLE_COLORS[user.role] || ROLE_COLORS.customer;
              return (
                <View key={user.id} style={{
                  backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                  padding: Spacing.md, marginBottom: Spacing.sm, ...Shadow.sm,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.sm }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: rc.bg, justifyContent: 'center', alignItems: 'center',
                    }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: rc.text }}>
                        {(user.display_name || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary }}>
                        {user.display_name || 'No name'}
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.textMuted }}>{user.email}</Text>
                    </View>
                    <View style={{
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full,
                      backgroundColor: rc.bg,
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: rc.text }}>
                        {user.role}
                      </Text>
                    </View>
                  </View>

                  {user.role !== 'admin' && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {user.role === 'customer' && (
                        <TouchableOpacity
                          onPress={() => handleRoleChange(user, 'owner')}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            backgroundColor: Colors.warningBg, borderRadius: BorderRadius.sm,
                            paddingHorizontal: 10, paddingVertical: 6,
                          }}
                        >
                          <Ionicons name="storefront-outline" size={11} color={Colors.warningDark} />
                          <Text style={{ color: Colors.warningDark, fontSize: 11, fontWeight: '700' }}>Make Owner</Text>
                        </TouchableOpacity>
                      )}
                      {user.role === 'owner' && (
                        <>
                          <TouchableOpacity
                            onPress={() => handleRoleChange(user, 'customer')}
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 4,
                              backgroundColor: Colors.successBg, borderRadius: BorderRadius.sm,
                              paddingHorizontal: 10, paddingVertical: 6,
                            }}
                          >
                            <Ionicons name="person-outline" size={11} color={Colors.successDark} />
                            <Text style={{ color: Colors.successDark, fontSize: 11, fontWeight: '700' }}>Make Customer</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleMultiLocation(user.id, !user.multi_location_enabled)}
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 4,
                              backgroundColor: Colors.infoBg, borderRadius: BorderRadius.sm,
                              paddingHorizontal: 10, paddingVertical: 6,
                            }}
                          >
                            <Ionicons name="location-outline" size={11} color={Colors.infoDark} />
                            <Text style={{ color: Colors.infoDark, fontSize: 11, fontWeight: '700' }}>
                              {user.multi_location_enabled ? 'Disable' : 'Enable'} Multi-Loc
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity
                        onPress={() => handleDeleteUser(user)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                          backgroundColor: Colors.dangerBg, borderRadius: BorderRadius.sm,
                          paddingHorizontal: 10, paddingVertical: 6,
                        }}
                      >
                        <Ionicons name="trash-outline" size={11} color={Colors.danger} />
                        <Text style={{ color: Colors.danger, fontSize: 11, fontWeight: '700' }}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}

            {filteredUsers.length === 0 && searchQuery ? (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="search-outline" size={40} color={Colors.border} />
                <Text style={{ fontSize: 14, color: Colors.textMuted, marginTop: 12 }}>No users match "{searchQuery}"</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ─── Analytics ─── */}
        {activeTab === 'Analytics' && (
          analytics ? (
            <View>
              {/* 2×2 grid */}
              <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md }}>
                <StatCard label="Total Users" value={String(analytics.total_users || 0)} icon="👥" />
                <StatCard label="Total Shops" value={String(analytics.total_shops || 0)} icon="🏪" />
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md }}>
                <StatCard label="Total Orders" value={String(analytics.total_orders || 0)} icon="📦" />
                <StatCard label="Revenue" value={`₹${(analytics.total_revenue || 0).toFixed(0)}`} icon="💰" />
              </View>
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <StatCard label="Subscriptions" value={String(analytics.active_subscriptions || 0)} icon="⭐" />
                <StatCard label="Pending" value={String(pendingShops.length)} icon="⏳" variant="warning" />
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="bar-chart-outline" size={56} color={Colors.border} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.textSecondary, marginTop: 16 }}>
                No analytics data available
              </Text>
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
