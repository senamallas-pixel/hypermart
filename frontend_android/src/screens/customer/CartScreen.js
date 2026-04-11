import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  ActivityIndicator, Alert, Modal, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { placeOrder, getShopUPI, createRazorpayOrder, verifyRazorpayPayment } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';
import { API_URL } from '../../constants/config';

export default function CartScreen({ navigation }) {
  const { cart, cartItemCount, cartTotal, updateQuantity, removeFromCart, clearCart, currentUser } = useApp();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [shopUPI, setShopUPI] = useState(null);
  const [showUPIModal, setShowUPIModal] = useState(false);

  useEffect(() => {
    if (cart.shopId) {
      getShopUPI(cart.shopId).then(r => setShopUPI(r.data)).catch(() => {});
    }
  }, [cart.shopId]);

  const handlePlaceOrder = async () => {
    if (!currentUser) {
      Alert.alert(t('common.signIn'), t('messages.createAccountOrSignIn'));
      return;
    }
    if (paymentMethod === 'upi') {
      if (!shopUPI?.upi_id) { Alert.alert('UPI Unavailable', 'This shop has not set up UPI payments yet.'); return; }
      setShowUPIModal(true);
      return;
    }
    setLoading(true);
    try {
      await placeOrder({
        shop_id: cart.shopId,
        items: cart.items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
        payment_method: paymentMethod,
      });
      clearCart();
      Alert.alert(t('common.success'), t('messages.orderPlaced'));
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.detail || 'Failed to place order');
    } finally { setLoading(false); }
  };

  const confirmUPIPayment = async () => {
    setShowUPIModal(false);
    setLoading(true);
    try {
      await placeOrder({
        shop_id: cart.shopId,
        items: cart.items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
        payment_method: 'upi',
      });
      clearCart();
      Alert.alert(t('common.success'), t('messages.orderPlaced'));
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.detail || 'Failed to place order');
    } finally { setLoading(false); }
  };

  const openUPIApp = () => {
    if (!shopUPI?.upi_id) return;
    const uri = `upi://pay?pa=${encodeURIComponent(shopUPI.upi_id)}&pn=${encodeURIComponent(shopUPI.shop_name || '')}&am=${cartTotal}&cu=INR`;
    Linking.openURL(uri).catch(() => Alert.alert('Error', 'No UPI app found on this device'));
  };

  const renderItem = ({ item }) => (
    <View style={{
      backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
      padding: Spacing.md, marginBottom: Spacing.sm,
      flexDirection: 'row', gap: Spacing.md, alignItems: 'center',
    }}>
      <View style={{
        width: 56, height: 56, borderRadius: BorderRadius.md,
        backgroundColor: Colors.background, overflow: 'hidden',
        justifyContent: 'center', alignItems: 'center',
      }}>
        {item.image ? (
          <Image source={{ uri: `${API_URL}${item.image}` }} style={{ width: 56, height: 56 }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: 22 }}>{'\uD83D\uDCE6'}</Text>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>
          {'\u20B9'}{item.price} {item.unit ? `/ ${item.unit}` : ''}
        </Text>
      </View>

      {/* Quantity controls */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.background, borderRadius: BorderRadius.md,
      }}>
        <TouchableOpacity
          onPress={() => updateQuantity(item.productId, item.quantity - 1)}
          style={{ paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Text style={{ fontWeight: '700', color: Colors.primary }}>-</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: '700', color: Colors.textPrimary, minWidth: 20, textAlign: 'center' }}>
          {item.quantity}
        </Text>
        <TouchableOpacity
          onPress={() => updateQuantity(item.productId, item.quantity + 1)}
          style={{ paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Text style={{ fontWeight: '700', color: Colors.primary }}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Line total */}
      <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary, minWidth: 60, textAlign: 'right' }}>
        {'\u20B9'}{(item.price * item.quantity).toFixed(2)}
      </Text>
    </View>
  );

  if (cartItemCount === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: Spacing.lg }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ fontSize: 16, color: Colors.primary }}>{'\u2190'} Back</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>{'\uD83D\uDED2'}</Text>
          <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.textSecondary }}>Your cart is empty</Text>
          <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 4 }}>Add items from a shop to get started</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: Spacing.lg, backgroundColor: Colors.white,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 16, color: Colors.primary }}>{'\u2190'} Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>{t('marketplace.yourCart')}</Text>
        <TouchableOpacity onPress={clearCart}>
          <Text style={{ fontSize: 13, color: Colors.danger }}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Shop name */}
      <View style={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.white }}>
        <Text style={{ fontSize: 13, color: Colors.textSecondary }}>
          From: <Text style={{ fontWeight: '600', color: Colors.textPrimary }}>{cart.shopName}</Text>
        </Text>
      </View>

      {/* Items */}
      <FlatList
        data={cart.items}
        keyExtractor={item => String(item.productId)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: Spacing.lg }}
      />

      {/* Order summary */}
      <View style={{
        backgroundColor: Colors.white, padding: Spacing.lg,
        borderTopWidth: 1, borderTopColor: Colors.border,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm }}>
          <Text style={{ fontSize: 14, color: Colors.textSecondary }}>
            {cartItemCount} item{cartItemCount > 1 ? 's' : ''}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.primary }}>
            {'\u20B9'}{cartTotal.toFixed(2)}
          </Text>
        </View>

        {/* Payment Method Selector */}
        <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 6 }}>
          PAYMENT METHOD
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.md }}>
          {[
            { key: 'cash', label: 'Cash', icon: '\uD83D\uDCB5' },
            { key: 'upi',  label: 'UPI',  icon: '\uD83D\uDCF1' },
            { key: 'razorpay', label: 'Online', icon: '\uD83D\uDCB3' },
          ].map(m => (
            <TouchableOpacity
              key={m.key}
              onPress={() => setPaymentMethod(m.key)}
              style={{
                flex: 1, alignItems: 'center', paddingVertical: 10,
                borderRadius: BorderRadius.md, borderWidth: 1.5,
                borderColor: paymentMethod === m.key ? Colors.primary : Colors.border,
                backgroundColor: paymentMethod === m.key ? Colors.primary + '10' : Colors.white,
              }}
            >
              <Text style={{ fontSize: 18, marginBottom: 2 }}>{m.icon}</Text>
              <Text style={{
                fontSize: 11, fontWeight: '700',
                color: paymentMethod === m.key ? Colors.primary : Colors.textMuted,
              }}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {paymentMethod === 'upi' && !shopUPI?.upi_id && (
          <Text style={{ fontSize: 11, color: Colors.danger, marginBottom: 8 }}>
            This shop hasn't set up UPI payments yet.
          </Text>
        )}

        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={loading || (paymentMethod === 'upi' && !shopUPI?.upi_id)}
          style={{
            backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
            paddingVertical: 14, alignItems: 'center',
            opacity: (loading || (paymentMethod === 'upi' && !shopUPI?.upi_id)) ? 0.6 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 1 }}>
              {paymentMethod === 'razorpay' ? 'PAY ONLINE' : paymentMethod === 'upi' ? 'PAY VIA UPI' : 'PLACE ORDER (COD)'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* UPI Payment Modal */}
      <Modal visible={showUPIModal} animationType="slide" transparent>
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xxl,
            borderTopRightRadius: BorderRadius.xxl, padding: Spacing.xl,
          }}>
            <Text style={{ fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
              Scan & Pay
            </Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.lg }}>
              Pay the shop owner directly via UPI
            </Text>

            {shopUPI?.upi_id && (
              <View style={{ alignItems: 'center', marginBottom: Spacing.lg }}>
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${encodeURIComponent(shopUPI.upi_id)}&pn=${encodeURIComponent(shopUPI.shop_name || '')}&am=${cartTotal}&cu=INR` }}
                  style={{ width: 180, height: 180, borderRadius: BorderRadius.lg }}
                />
              </View>
            )}

            <View style={{ alignItems: 'center', marginBottom: Spacing.md }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 }}>UPI ID</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', fontFamily: 'monospace', marginTop: 4 }}>
                {shopUPI?.upi_id}
              </Text>
            </View>

            <Text style={{ fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.lg }}>
              {'\u20B9'}{cartTotal.toFixed(2)}
            </Text>

            <TouchableOpacity onPress={openUPIApp} style={{
              backgroundColor: Colors.background, borderRadius: BorderRadius.lg,
              paddingVertical: 12, alignItems: 'center', marginBottom: Spacing.sm,
              borderWidth: 1, borderColor: Colors.border,
            }}>
              <Text style={{ fontWeight: '700', fontSize: 13, color: Colors.primary }}>
                Open UPI App
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={confirmUPIPayment} style={{
              backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
              paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.sm,
            }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                I've Paid — Confirm Order
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowUPIModal(false)} style={{
              paddingVertical: 10, alignItems: 'center',
            }}>
              <Text style={{ fontSize: 13, color: Colors.textMuted, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
