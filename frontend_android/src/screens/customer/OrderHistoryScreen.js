import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getMyOrders, cancelOrder } from '../../api/client';
import { useTranslation } from '../../hooks/useTranslation';
import { Colors, BorderRadius, Spacing, Shadow } from '../../constants/theme';

const STATUS_CONFIG = {
  pending:          { bg: '#FEF3C7', text: '#D97706', icon: 'time-outline',          label: 'Pending' },
  accepted:         { bg: '#DBEAFE', text: '#2563EB', icon: 'checkmark-circle-outline', label: 'Accepted' },
  ready:            { bg: '#D1FAE5', text: '#059669', icon: 'bag-check-outline',      label: 'Ready' },
  out_for_delivery: { bg: '#E0E7FF', text: '#4F46E5', icon: 'bicycle-outline',        label: 'On the way' },
  delivered:        { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-done-outline', label: 'Delivered' },
  rejected:         { bg: '#FEE2E2', text: '#DC2626', icon: 'close-circle-outline',   label: 'Rejected' },
  cancelled:        { bg: '#F3F4F6', text: '#6B7280', icon: 'ban-outline',            label: 'Cancelled' },
};

const ORDER_PIPELINE = ['pending', 'accepted', 'ready', 'out_for_delivery', 'delivered'];

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function OrderHistoryScreen() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');

  const loadOrders = useCallback(async () => {
    try {
      const res = await getMyOrders();
      setOrders(res.data?.items || res.data?.orders || (Array.isArray(res.data) ? res.data : []));
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const filtered = filter === 'all'
    ? orders
    : filter === 'accepted'
      ? orders.filter(o => ['accepted', 'ready', 'out_for_delivery'].includes(o.status))
      : orders.filter(o => o.status === filter);

  const renderStatusDot = (status, currentStatus) => {
    const currentIdx = ORDER_PIPELINE.indexOf(currentStatus);
    const dotIdx = ORDER_PIPELINE.indexOf(status);
    const isDone = dotIdx < currentIdx;
    const isCurrent = dotIdx === currentIdx;
    const isFuture = dotIdx > currentIdx;

    return (
      <View key={status} style={{ alignItems: 'center', flex: 1 }}>
        <View style={{
          width: 20, height: 20, borderRadius: 10,
          backgroundColor: isDone || isCurrent ? Colors.primary : Colors.border,
          justifyContent: 'center', alignItems: 'center',
          borderWidth: isCurrent ? 2 : 0,
          borderColor: Colors.primaryLight,
        }}>
          {(isDone || isCurrent) && (
            <Ionicons name={isDone ? 'checkmark' : 'ellipse'} size={10} color="#fff" />
          )}
        </View>
        <Text style={{
          fontSize: 7, marginTop: 3, fontWeight: '600', textAlign: 'center',
          color: isDone || isCurrent ? Colors.primary : Colors.textMuted,
        }}>
          {STATUS_CONFIG[status]?.label?.split(' ')[0]}
        </Text>
      </View>
    );
  };

  const renderOrder = ({ item: order }) => {
    const isExpanded = expanded === order.id;
    const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const canCancel = ['pending', 'accepted'].includes(order.status);
    const isTerminal = ['delivered', 'rejected', 'cancelled'].includes(order.status);
    const showPipeline = !['rejected', 'cancelled'].includes(order.status);

    return (
      <TouchableOpacity
        onPress={() => setExpanded(isExpanded ? null : order.id)}
        activeOpacity={0.7}
        style={{
          backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
          marginBottom: Spacing.md, overflow: 'hidden', ...Shadow.sm,
        }}
      >
        {/* Status stripe */}
        <View style={{ height: 3, backgroundColor: sc.text }} />

        <View style={{ padding: Spacing.lg }}>
          {/* Top row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.textPrimary }}>
                Order #{order.id}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <Ionicons name="storefront-outline" size={11} color={Colors.textMuted} />
                <Text style={{ fontSize: 12, color: Colors.textSecondary }}>{order.shop_name || 'Shop'}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 9, paddingVertical: 4, borderRadius: BorderRadius.full,
                backgroundColor: sc.bg,
              }}>
                <Ionicons name={sc.icon} size={11} color={sc.text} />
                <Text style={{ fontSize: 10, fontWeight: '800', color: sc.text, textTransform: 'uppercase' }}>
                  {sc.label}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.primary }}>
                ₹{order.total?.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Date + items count */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                {new Date(order.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </Text>
            </View>
            {order.items?.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="cube-outline" size={11} color={Colors.textMuted} />
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                  {order.items.length} item{order.items.length > 1 ? 's' : ''}
                </Text>
              </View>
            )}
            {order.payment_method && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons
                  name={order.payment_method === 'cash' ? 'cash-outline' : order.payment_method === 'upi' ? 'phone-portrait-outline' : 'card-outline'}
                  size={11}
                  color={Colors.textMuted}
                />
                <Text style={{ fontSize: 11, color: Colors.textMuted, textTransform: 'capitalize' }}>
                  {order.payment_method}
                </Text>
              </View>
            )}
          </View>

          {/* Status pipeline */}
          {showPipeline && !isTerminal && (
            <View style={{
              flexDirection: 'row', alignItems: 'flex-start',
              marginTop: Spacing.md, paddingTop: Spacing.sm,
              borderTopWidth: 1, borderTopColor: Colors.border,
            }}>
              {ORDER_PIPELINE.map((status, idx) => (
                <View key={status} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start' }}>
                  {idx > 0 && (
                    <View style={{
                      flex: 1, height: 2, marginTop: 9,
                      backgroundColor: ORDER_PIPELINE.indexOf(order.status) >= idx ? Colors.primary : Colors.border,
                    }} />
                  )}
                  {renderStatusDot(status, order.status)}
                </View>
              ))}
            </View>
          )}

          {/* Expand indicator */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
          </View>
        </View>

        {/* Expanded items */}
        {isExpanded && (
          <View style={{ borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background }}>
            <View style={{ padding: Spacing.lg }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: Spacing.sm }}>
                ORDER ITEMS
              </Text>
              {(order.items || []).map((item, i) => (
                <View key={i} style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingVertical: 6,
                  borderBottomWidth: i < order.items.length - 1 ? 1 : 0,
                  borderBottomColor: Colors.border,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View style={{
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: Colors.primary,
                    }} />
                    <Text style={{ fontSize: 13, color: Colors.textPrimary, flex: 1 }}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>×{item.quantity}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginLeft: 12 }}>
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
              {/* Total row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>Total</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.primary }}>₹{order.total?.toFixed(2)}</Text>
              </View>
            </View>

            {canCancel && (
              <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }}>
                <TouchableOpacity
                  onPress={() => handleCancel(order.id)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                    backgroundColor: Colors.dangerBg, borderRadius: BorderRadius.md,
                    paddingVertical: 11, borderWidth: 1, borderColor: Colors.danger + '40',
                  }}
                >
                  <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
                  <Text style={{ color: Colors.danger, fontWeight: '700', fontSize: 13 }}>Cancel Order</Text>
                </TouchableOpacity>
              </View>
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

  const getCount = (key) => {
    if (key === 'all') return orders.length;
    if (key === 'accepted') return orders.filter(o => ['accepted', 'ready', 'out_for_delivery'].includes(o.status)).length;
    return orders.filter(o => o.status === key).length;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{
        backgroundColor: Colors.white,
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 0,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
      }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md }}>
          {t('orders.orderHistory')}
        </Text>

        {/* Filter chips */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: Spacing.sm }}
        >
          {FILTER_TABS.map(ft => {
            const count = getCount(ft.key);
            return (
              <TouchableOpacity
                key={ft.key}
                onPress={() => setFilter(ft.key)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: BorderRadius.full,
                  borderWidth: 1.5,
                  borderColor: filter === ft.key ? Colors.primary : Colors.border,
                  backgroundColor: filter === ft.key ? Colors.primaryBg : 'transparent',
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: '600',
                  color: filter === ft.key ? Colors.primary : Colors.textMuted,
                }}>
                  {ft.label}
                </Text>
                {count > 0 && (
                  <View style={{
                    backgroundColor: filter === ft.key ? Colors.primary : Colors.border,
                    borderRadius: 8, minWidth: 16, height: 16,
                    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
                  }}>
                    <Text style={{ color: filter === ft.key ? '#fff' : Colors.textSecondary, fontSize: 9, fontWeight: '700' }}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={renderOrder}
        contentContainerStyle={{ padding: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="receipt-outline" size={56} color={Colors.border} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textSecondary, marginTop: 16 }}>
              {t('orders.noOrders')}
            </Text>
            <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 4 }}>
              Your orders will appear here
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
