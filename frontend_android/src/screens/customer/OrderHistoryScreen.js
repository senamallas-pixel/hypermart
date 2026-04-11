import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyOrders, cancelOrder } from '../../api/client';
import { useTranslation } from '../../hooks/useTranslation';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';

const STATUS_COLORS = {
  pending: { bg: '#FEF3C7', text: '#D97706' },
  accepted: { bg: '#DBEAFE', text: '#2563EB' },
  ready: { bg: '#D1FAE5', text: '#059669' },
  out_for_delivery: { bg: '#E0E7FF', text: '#4F46E5' },
  delivered: { bg: '#D1FAE5', text: '#059669' },
  rejected: { bg: '#FEE2E2', text: '#DC2626' },
  cancelled: { bg: '#F3F4F6', text: '#6B7280' },
};

export default function OrderHistoryScreen() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');

  const loadOrders = useCallback(async () => {
    try {
      const res = await getMyOrders(page);
      setOrders(res.data?.items || res.data?.orders || (Array.isArray(res.data) ? res.data : []));
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const onRefresh = () => { setRefreshing(true); loadOrders(); };

  const handleCancel = (orderId) => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelOrder(orderId);
            loadOrders();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.detail || 'Cannot cancel this order');
          }
        },
      },
    ]);
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const renderOrder = ({ item: order }) => {
    const isExpanded = expanded === order.id;
    const sc = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
    const canCancel = ['pending', 'accepted'].includes(order.status);

    return (
      <TouchableOpacity
        onPress={() => setExpanded(isExpanded ? null : order.id)}
        activeOpacity={0.7}
        style={{
          backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
          marginBottom: Spacing.sm, overflow: 'hidden',
          shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
        }}
      >
        <View style={{ padding: Spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>
                #{order.id}
              </Text>
              <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
                {order.shop_name || 'Shop'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
                backgroundColor: sc.bg,
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: sc.text, textTransform: 'uppercase' }}>
                  {order.status?.replace('_', ' ')}
                </Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.primary, marginTop: 4 }}>
                {'\u20B9'}{order.total?.toFixed(2)}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 6 }}>
            {new Date(order.created_at).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </View>

        {isExpanded && (
          <View style={{
            borderTopWidth: 1, borderTopColor: Colors.border,
            padding: Spacing.lg, backgroundColor: Colors.background,
          }}>
            {(order.items || []).map((item, i) => (
              <View key={i} style={{
                flexDirection: 'row', justifyContent: 'space-between',
                paddingVertical: 4,
              }}>
                <Text style={{ fontSize: 13, color: Colors.textPrimary, flex: 1 }}>
                  {item.name} x{item.quantity}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textPrimary }}>
                  {'\u20B9'}{(item.price * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
            {canCancel && (
              <TouchableOpacity
                onPress={() => handleCancel(order.id)}
                style={{
                  backgroundColor: Colors.dangerBg, borderRadius: BorderRadius.md,
                  paddingVertical: 10, alignItems: 'center', marginTop: Spacing.md,
                }}
              >
                <Text style={{ color: Colors.danger, fontWeight: '600', fontSize: 13 }}>
                  Cancel Order
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={{ padding: Spacing.lg, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.textPrimary }}>
          {t('orders.orderHistory')}
        </Text>
      </View>

      {/* Filter chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={['all', 'pending', 'accepted', 'delivered', 'cancelled']}
        keyExtractor={item => item}
        style={{ backgroundColor: Colors.white, paddingVertical: 8, maxHeight: 48 }}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
        renderItem={({ item: status }) => (
          <TouchableOpacity
            onPress={() => setFilter(status)}
            style={{
              paddingHorizontal: 14, paddingVertical: 6, borderRadius: BorderRadius.full,
              marginRight: 8, borderWidth: 1,
              borderColor: filter === status ? Colors.primary : Colors.border,
              backgroundColor: filter === status ? 'rgba(90,90,64,0.08)' : 'transparent',
            }}
          >
            <Text style={{
              fontSize: 12, fontWeight: '600', textTransform: 'capitalize',
              color: filter === status ? Colors.primary : Colors.textSecondary,
            }}>
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={renderOrder}
        contentContainerStyle={{ padding: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>{'\uD83D\uDCE6'}</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.textSecondary }}>
              {t('orders.noOrders')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
