import { useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { placeOrder } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';
import { API_URL } from '../../constants/config';

export default function CartScreen({ navigation }) {
  const { cart, cartItemCount, cartTotal, updateQuantity, removeFromCart, clearCart, currentUser } = useApp();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handlePlaceOrder = async () => {
    if (!currentUser) {
      Alert.alert(t('common.signIn'), t('messages.createAccountOrSignIn'));
      return;
    }
    setLoading(true);
    try {
      await placeOrder({
        shop_id: cart.shopId,
        items: cart.items.map(i => ({
          product_id: i.productId,
          quantity: i.quantity,
        })),
      });
      clearCart();
      Alert.alert(t('common.success'), t('messages.orderPlaced'));
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.detail || 'Failed to place order');
    } finally { setLoading(false); }
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
        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={loading}
          style={{
            backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
            paddingVertical: 14, alignItems: 'center',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 1 }}>
              {t('marketplace.placeOrder').toUpperCase()}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
