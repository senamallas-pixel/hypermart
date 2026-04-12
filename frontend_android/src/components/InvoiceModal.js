import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, Shadow } from '../constants/theme';

export default function InvoiceModal({ order, visible, onClose }) {
  if (!order) return null;

  const invoiceNo = `INV-${String(order.id).padStart(6, '0')}`;
  const orderDate = new Date(order.created_at);
  const items = order.items || [];
  const subtotal = items.reduce((s, i) => s + (i.line_total ?? i.price * i.quantity), 0);
  const total = order.total ?? subtotal;

  const payLabel = order.payment_method === 'razorpay' ? 'Online'
    : order.payment_method === 'upi' ? 'UPI' : 'Cash';

  const STATUS_COLORS = {
    delivered: { bg: Colors.successBg, text: Colors.success },
    pending: { bg: Colors.warningBg, text: Colors.warningDark },
    accepted: { bg: Colors.infoBg, text: Colors.info },
    rejected: { bg: Colors.dangerBg, text: Colors.danger },
    cancelled: { bg: Colors.dangerBg, text: Colors.danger },
  };
  const sc = STATUS_COLORS[order.status] || STATUS_COLORS.pending;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: Colors.white,
          borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl,
          maxHeight: '90%',
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
            borderBottomWidth: 1, borderBottomColor: Colors.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="receipt-outline" size={18} color={Colors.primary} />
              <Text style={{ fontSize: 17, fontWeight: '800', color: Colors.textPrimary }}>Invoice</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
            {/* Invoice header */}
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
              paddingBottom: Spacing.md, borderBottomWidth: 2, borderBottomColor: Colors.primary,
              marginBottom: Spacing.lg,
            }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{
                    width: 32, height: 32, borderRadius: BorderRadius.md,
                    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Ionicons name="storefront" size={14} color="#fff" />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.primary }}>HyperMart</Text>
                </View>
                <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 3 }}>Your neighbourhood marketplace</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.primary }}>INVOICE</Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '600' }}>{invoiceNo}</Text>
              </View>
            </View>

            {/* Meta info */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.lg }}>
              <View style={{ minWidth: '45%' }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 3 }}>ORDER DATE</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>
                  {orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
                <Text style={{ fontSize: 10, color: Colors.textMuted }}>
                  {orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </Text>
              </View>
              <View style={{ minWidth: '45%' }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 3 }}>SHOP</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>{order.shop_name}</Text>
              </View>
              <View style={{ minWidth: '45%' }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 3 }}>STATUS</Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, backgroundColor: sc.bg, alignSelf: 'flex-start' }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: sc.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {(order.status || 'pending').replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
              <View style={{ minWidth: '45%' }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 3 }}>PAYMENT</Text>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, alignSelf: 'flex-start',
                  backgroundColor: order.payment_status === 'paid' ? Colors.successBg : Colors.warningBg,
                }}>
                  <Text style={{
                    fontSize: 9, fontWeight: '700', letterSpacing: 0.5,
                    color: order.payment_status === 'paid' ? Colors.success : Colors.warningDark,
                  }}>
                    {payLabel} — {order.payment_status || 'pending'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Items table */}
            <View style={{
              borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg,
              overflow: 'hidden', marginBottom: Spacing.lg,
            }}>
              {/* Table header */}
              <View style={{
                flexDirection: 'row', backgroundColor: Colors.backgroundAlt,
                paddingVertical: 8, paddingHorizontal: 12,
              }}>
                <Text style={{ flex: 0.1, fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 }}>#</Text>
                <Text style={{ flex: 0.45, fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 }}>ITEM</Text>
                <Text style={{ flex: 0.12, fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, textAlign: 'center' }}>QTY</Text>
                <Text style={{ flex: 0.15, fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, textAlign: 'right' }}>PRICE</Text>
                <Text style={{ flex: 0.18, fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, textAlign: 'right' }}>AMOUNT</Text>
              </View>
              {/* Rows */}
              {items.map((item, i) => (
                <View key={item.id || i} style={{
                  flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12,
                  borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'center',
                }}>
                  <Text style={{ flex: 0.1, fontSize: 11, color: Colors.textMuted }}>{i + 1}</Text>
                  <Text style={{ flex: 0.45, fontSize: 12, fontWeight: '600', color: Colors.textPrimary }} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ flex: 0.12, fontSize: 12, color: Colors.textPrimary, textAlign: 'center' }}>{item.quantity}</Text>
                  <Text style={{ flex: 0.15, fontSize: 11, color: Colors.textMuted, textAlign: 'right' }}>₹{item.price}</Text>
                  <Text style={{ flex: 0.18, fontSize: 12, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' }}>
                    ₹{(item.line_total ?? item.price * item.quantity).toFixed(0)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={{ alignItems: 'flex-end', marginBottom: Spacing.lg }}>
              <View style={{ width: 200, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>Subtotal</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textPrimary }}>₹{subtotal.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>Delivery</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.success }}>FREE</Text>
                </View>
                <View style={{ height: 2, backgroundColor: Colors.textPrimary, marginVertical: 4 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.textPrimary }}>Total</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.primary }}>₹{total}</Text>
                </View>
              </View>
            </View>

            {/* Footer */}
            <View style={{ alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md }}>
              <Text style={{ fontSize: 10, color: Colors.textMuted }}>Thank you for shopping with HyperMart!</Text>
              <Text style={{ fontSize: 9, color: Colors.textLight, marginTop: 2 }}>This is a computer-generated invoice.</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
