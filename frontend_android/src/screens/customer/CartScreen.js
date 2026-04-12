import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  ActivityIndicator, Alert, Modal, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { placeOrder, getShopUPI, createRazorpayOrder, verifyRazorpayPayment, getShopDiscounts } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Colors, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import { API_URL } from '../../constants/config';

const fixImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
};

const PAYMENT_OPTIONS = [
  { key: 'cash', label: 'Cash on Delivery', icon: 'cash-outline', desc: 'Pay when you receive' },
  { key: 'upi', label: 'UPI', icon: 'phone-portrait-outline', desc: 'Pay via UPI app / QR' },
  { key: 'razorpay', label: 'Online', icon: 'card-outline', desc: 'Credit / Debit / Net banking' },
];

export default function CartScreen({ navigation }) {
  const { cart, cartItemCount, cartTotal, updateQuantity, removeFromCart, clearCart, currentUser } = useApp();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [shopUPI, setShopUPI] = useState(null);
  const [showUPIModal, setShowUPIModal] = useState(false);
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);
  const [razorpayHtml, setRazorpayHtml] = useState('');
  const [discounts, setDiscounts] = useState({ product_discounts: [], order_discounts: [] });

  useEffect(() => {
    if (cart.shopId) {
      getShopUPI(cart.shopId).then(r => setShopUPI(r.data)).catch(() => {});
      getShopDiscounts(cart.shopId).then(r => setDiscounts(r.data || {})).catch(() => {});
    }
  }, [cart.shopId]);

  // Calculate discounts
  const savings = (() => {
    let itemDiscount = 0;
    const prodDiscounts = discounts.product_discounts || [];
    cart.items.forEach(item => {
      const d = prodDiscounts.find(pd =>
        pd.product_id === item.productId && pd.status === 'active' &&
        (!pd.valid_till || new Date(pd.valid_till) >= new Date()) &&
        item.quantity >= (pd.min_quantity || 1)
      );
      if (d?.discount_percent) {
        itemDiscount += (item.price * item.quantity * d.discount_percent) / 100;
      }
    });

    let billDiscount = 0;
    const orderDiscounts = discounts.order_discounts || [];
    const afterItemDiscount = cartTotal - itemDiscount;
    const applicableOD = orderDiscounts
      .filter(d => d.status === 'active' && afterItemDiscount >= d.min_order_amount && (!d.valid_till || new Date(d.valid_till) >= new Date()))
      .sort((a, b) => b.min_order_amount - a.min_order_amount)[0];
    if (applicableOD) {
      if (applicableOD.discount_amount) billDiscount = applicableOD.discount_amount;
      else if (applicableOD.discount_percent) billDiscount = (afterItemDiscount * applicableOD.discount_percent) / 100;
    }

    return {
      itemDiscount: Math.round(itemDiscount * 100) / 100,
      billDiscount: Math.round(billDiscount * 100) / 100,
      total: Math.round((itemDiscount + billDiscount) * 100) / 100,
    };
  })();

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
      const res = await placeOrder({
        shop_id: cart.shopId,
        items: cart.items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
        payment_method: paymentMethod,
      });

      // Razorpay: open checkout in WebView
      if (paymentMethod === 'razorpay') {
        try {
          const rzRes = await createRazorpayOrder(res.data.id);
          const rz = rzRes.data;
          const html = `<!DOCTYPE html><html><head>
            <meta name="viewport" content="width=device-width,initial-scale=1"/>
            <script src="https://checkout.razorpay.com/v1/checkout.js"><\/script>
            <style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;background:#F5F5F0;}</style>
          </head><body>
            <p>Loading payment…</p>
            <script>
              var options = {
                key: '${rz.key_id}',
                amount: ${rz.amount},
                currency: '${rz.currency || 'INR'}',
                name: 'HyperMart',
                description: 'Order #${res.data.id}',
                order_id: '${rz.razorpay_order_id}',
                handler: function(r) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type:'success', order_id:${res.data.id},
                    razorpay_order_id:r.razorpay_order_id,
                    razorpay_payment_id:r.razorpay_payment_id,
                    razorpay_signature:r.razorpay_signature
                  }));
                },
                modal: { ondismiss: function() {
                  window.ReactNativeWebView.postMessage(JSON.stringify({type:'dismiss'}));
                }},
                prefill: { email:'${currentUser.email || ''}', contact:'${currentUser.phone || ''}' }
              };
              var rzp = new Razorpay(options);
              rzp.on('payment.failed', function(r) {
                window.ReactNativeWebView.postMessage(JSON.stringify({type:'failed', reason:r.error.description}));
              });
              rzp.open();
            <\/script>
          </body></html>`;
          setRazorpayHtml(html);
          setShowRazorpayModal(true);
          setLoading(false);
          return;
        } catch {
          // Razorpay order creation failed — order still placed, user can pay later
          clearCart();
          Alert.alert(t('common.success'), 'Order placed. Complete payment online later.');
          navigation.goBack();
          setLoading(false);
          return;
        }
      }

      clearCart();
      Alert.alert(t('common.success'), t('messages.orderPlaced'));
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.detail || 'Failed to place order');
    } finally { setLoading(false); }
  };

  const handleRazorpayMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      setShowRazorpayModal(false);
      if (data.type === 'success') {
        try {
          await verifyRazorpayPayment({
            order_id: data.order_id,
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature,
          });
        } catch { /* verification on server side */ }
        clearCart();
        Alert.alert('Payment Successful', 'Your order has been placed and paid.');
        navigation.goBack();
      } else if (data.type === 'failed') {
        clearCart();
        Alert.alert('Payment Failed', data.reason || 'Payment could not be completed. Order placed — pay later.');
        navigation.goBack();
      } else {
        // dismissed
        clearCart();
        Alert.alert(t('common.success'), 'Order placed. Complete payment online if needed.');
        navigation.goBack();
      }
    } catch { setShowRazorpayModal(false); }
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
      marginBottom: Spacing.sm, flexDirection: 'row',
      overflow: 'hidden', ...Shadow.sm,
    }}>
      {/* Image */}
      <View style={{
        width: 72, height: 72,
        backgroundColor: Colors.backgroundAlt,
        justifyContent: 'center', alignItems: 'center',
      }}>
        {item.image ? (
          <Image source={{ uri: fixImageUrl(item.image) }} style={{ width: 72, height: 72 }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: 24 }}>📦</Text>
        )}
      </View>

      <View style={{ flex: 1, padding: Spacing.md, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: 8 }} numberOfLines={2}>
            {item.name}
          </Text>
          <TouchableOpacity
            onPress={() => removeFromCart ? removeFromCart(item.productId) : updateQuantity(item.productId, 0)}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="trash-outline" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>₹{item.price}{item.unit ? ` / ${item.unit}` : ''}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
            <TouchableOpacity
              onPress={() => updateQuantity(item.productId, item.quantity - 1)}
              style={{
                width: 28, height: 28, borderRadius: BorderRadius.sm,
                borderWidth: 1, borderColor: Colors.border,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Ionicons name="remove" size={14} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={{ fontWeight: '800', color: Colors.textPrimary, width: 30, textAlign: 'center', fontSize: 14 }}>
              {item.quantity}
            </Text>
            <TouchableOpacity
              onPress={() => updateQuantity(item.productId, item.quantity + 1)}
              style={{
                width: 28, height: 28, borderRadius: BorderRadius.sm,
                backgroundColor: Colors.primary,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Ionicons name="add" size={14} color="#fff" />
            </TouchableOpacity>
            <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.primary, marginLeft: 10, minWidth: 50, textAlign: 'right' }}>
              ₹{(item.price * item.quantity).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (cartItemCount === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
          backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
          gap: 8,
        }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.textPrimary }}>Your Cart</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: Colors.primaryBg,
            justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
          }}>
            <Ionicons name="cart-outline" size={36} color={Colors.primary} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.textPrimary }}>Your cart is empty</Text>
          <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center' }}>
            Add items from a shop to get started
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              marginTop: Spacing.xl, backgroundColor: Colors.primary,
              borderRadius: BorderRadius.lg, paddingVertical: 12, paddingHorizontal: 28,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Browse Shops</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const deliveryFee = 0;
  const grandTotal = Math.max(0, cartTotal - savings.total + deliveryFee);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: 14,
        backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.primary }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.textPrimary }}>
          {t('marketplace.yourCart')}
        </Text>
        <TouchableOpacity onPress={() => Alert.alert('Clear Cart', 'Remove all items?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: clearCart },
        ])}>
          <Text style={{ fontSize: 13, color: Colors.danger, fontWeight: '600' }}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Shop label */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: Spacing.lg, paddingVertical: 10,
        backgroundColor: Colors.white,
      }}>
        <Ionicons name="storefront-outline" size={14} color={Colors.textMuted} />
        <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
          From: <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{cart.shopName}</Text>
        </Text>
      </View>

      {/* Items */}
      <FlatList
        data={cart.items}
        keyExtractor={item => String(item.productId)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 4 }}
      />

      {/* Bottom panel */}
      <View style={{
        backgroundColor: Colors.white,
        borderTopWidth: 1, borderTopColor: Colors.border,
        padding: Spacing.lg,
        ...Shadow.md,
      }}>
        {/* Bill summary */}
        <View style={{
          backgroundColor: Colors.background, borderRadius: BorderRadius.lg,
          padding: Spacing.md, marginBottom: Spacing.md,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: Spacing.sm }}>
            BILL SUMMARY
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 13, color: Colors.textSecondary }}>
              Items ({cartItemCount})
            </Text>
            <Text style={{ fontSize: 13, color: Colors.textPrimary, fontWeight: '600' }}>₹{cartTotal.toFixed(2)}</Text>
          </View>
          {savings.itemDiscount > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="pricetag-outline" size={12} color={Colors.success} />
                <Text style={{ fontSize: 12, color: Colors.success, fontWeight: '600' }}>Item Discounts</Text>
              </View>
              <Text style={{ fontSize: 12, color: Colors.success, fontWeight: '700' }}>-₹{savings.itemDiscount.toFixed(2)}</Text>
            </View>
          )}
          {savings.billDiscount > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="gift-outline" size={12} color={Colors.success} />
                <Text style={{ fontSize: 12, color: Colors.success, fontWeight: '600' }}>Bill Offer</Text>
              </View>
              <Text style={{ fontSize: 12, color: Colors.success, fontWeight: '700' }}>-₹{savings.billDiscount.toFixed(2)}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Delivery</Text>
            <Text style={{ fontSize: 12, color: Colors.success, fontWeight: '700' }}>FREE</Text>
          </View>
          {savings.total > 0 && (
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4,
              paddingTop: 4, borderTopWidth: 1, borderTopColor: Colors.border, borderStyle: 'dashed',
            }}>
              <Text style={{ fontSize: 11, color: Colors.danger, fontWeight: '700' }}>Total Savings</Text>
              <Text style={{ fontSize: 11, color: Colors.danger, fontWeight: '700' }}>₹{savings.total.toFixed(2)}</Text>
            </View>
          )}
          <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 6 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.textPrimary }}>Total</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.primary }}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment Method */}
        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 8 }}>
          PAYMENT METHOD
        </Text>
        <View style={{ gap: 6, marginBottom: Spacing.md }}>
          {PAYMENT_OPTIONS.map(m => (
            <TouchableOpacity
              key={m.key}
              onPress={() => setPaymentMethod(m.key)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5,
                borderColor: paymentMethod === m.key ? Colors.primary : Colors.border,
                backgroundColor: paymentMethod === m.key ? Colors.primaryBg : Colors.white,
              }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: paymentMethod === m.key ? Colors.primary : Colors.backgroundAlt,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Ionicons name={m.icon} size={18} color={paymentMethod === m.key ? '#fff' : Colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: paymentMethod === m.key ? Colors.primary : Colors.textPrimary }}>
                  {m.label}
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>{m.desc}</Text>
              </View>
              <View style={{
                width: 18, height: 18, borderRadius: 9,
                borderWidth: 2, borderColor: paymentMethod === m.key ? Colors.primary : Colors.border,
                backgroundColor: paymentMethod === m.key ? Colors.primary : 'transparent',
                justifyContent: 'center', alignItems: 'center',
              }}>
                {paymentMethod === m.key && <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' }} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {paymentMethod === 'upi' && !shopUPI?.upi_id && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Ionicons name="warning-outline" size={14} color={Colors.warning} />
            <Text style={{ fontSize: 11, color: Colors.warning, fontWeight: '600' }}>
              This shop hasn't set up UPI payments yet.
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={loading || (paymentMethod === 'upi' && !shopUPI?.upi_id)}
          style={{
            backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
            paddingVertical: 15, alignItems: 'center',
            flexDirection: 'row', justifyContent: 'center', gap: 8,
            opacity: (loading || (paymentMethod === 'upi' && !shopUPI?.upi_id)) ? 0.6 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons
                name={paymentMethod === 'razorpay' ? 'card' : paymentMethod === 'upi' ? 'phone-portrait' : 'checkmark-circle'}
                size={18} color="#fff"
              />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 }}>
                {paymentMethod === 'razorpay' ? 'Pay Online' : paymentMethod === 'upi' ? 'Pay via UPI' : 'Place Order (COD)'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Razorpay WebView Modal */}
      <Modal visible={showRazorpayModal} animationType="slide" onRequestClose={() => setShowRazorpayModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: Spacing.lg, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: Colors.border,
          }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>Complete Payment</Text>
            <TouchableOpacity
              onPress={() => {
                setShowRazorpayModal(false);
                clearCart();
                Alert.alert(t('common.success'), 'Order placed. Complete payment online if needed.');
                navigation.goBack();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          {razorpayHtml ? (
            <WebView
              source={{ html: razorpayHtml }}
              onMessage={handleRazorpayMessage}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              renderLoading={() => (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.background }}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 13 }}>Loading payment…</Text>
                </View>
              )}
            />
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* UPI Payment Modal */}
      <Modal visible={showUPIModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: Colors.white,
            borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl,
            padding: Spacing.xxl,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.textPrimary }}>Pay via UPI</Text>
              <TouchableOpacity onPress={() => setShowUPIModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {shopUPI?.upi_id && (
              <View style={{ alignItems: 'center', marginBottom: Spacing.xl }}>
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${encodeURIComponent(shopUPI.upi_id)}&pn=${encodeURIComponent(shopUPI.shop_name || '')}&am=${cartTotal}&cu=INR` }}
                  style={{ width: 180, height: 180, borderRadius: BorderRadius.lg }}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md }}>
                  <Ionicons name="phone-portrait-outline" size={14} color={Colors.textMuted} />
                  <Text style={{ fontSize: 13, fontWeight: '700', fontFamily: 'monospace', color: Colors.textPrimary }}>
                    {shopUPI.upi_id}
                  </Text>
                </View>
              </View>
            )}

            <View style={{ alignItems: 'center', marginBottom: Spacing.xl }}>
              <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '700', letterSpacing: 1 }}>AMOUNT TO PAY</Text>
              <Text style={{ fontSize: 32, fontWeight: '800', color: Colors.primary, marginTop: 4 }}>₹{grandTotal.toFixed(2)}</Text>
            </View>

            <TouchableOpacity onPress={openUPIApp} style={{
              backgroundColor: Colors.primaryBg, borderRadius: BorderRadius.lg,
              paddingVertical: 13, alignItems: 'center', marginBottom: 10,
              borderWidth: 1.5, borderColor: Colors.primary,
              flexDirection: 'row', justifyContent: 'center', gap: 8,
            }}>
              <Ionicons name="phone-portrait-outline" size={16} color={Colors.primary} />
              <Text style={{ fontWeight: '700', fontSize: 13, color: Colors.primary }}>Open UPI App</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={confirmUPIPayment} style={{
              backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
              paddingVertical: 15, alignItems: 'center', marginBottom: 10,
              flexDirection: 'row', justifyContent: 'center', gap: 8,
            }}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>I've Paid — Confirm Order</Text>
            </TouchableOpacity>

            <Text style={{ textAlign: 'center', fontSize: 11, color: Colors.textMuted, lineHeight: 17 }}>
              After paying in your UPI app, tap "I've Paid" to confirm your order.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
