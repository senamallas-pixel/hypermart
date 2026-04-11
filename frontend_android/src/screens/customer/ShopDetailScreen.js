import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  ActivityIndicator, Alert, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listProducts, getShopReviews, createReview } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';
import { API_URL } from '../../constants/config';

const fixImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
};

export default function ShopDetailScreen({ route, navigation }) {
  const { shop } = route.params;
  const { addToCart, updateQuantity, cart, clearCart, currentUser, cartItemCount } = useApp();
  const { t } = useTranslation();

  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('products');
  const [selectedCat, setSelectedCat] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [prodRes, revRes] = await Promise.all([
          listProducts(shop.id),
          getShopReviews(shop.id),
        ]);
        setProducts(prodRes.data || []);
        setReviews(revRes.data || []);
      } catch {} finally { setLoading(false); }
    })();
  }, [shop.id]);

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const filtered = selectedCat
    ? products.filter(p => p.category === selectedCat)
    : products;

  const handleAdd = (product) => {
    if (cart.shopId && cart.shopId !== shop.id) {
      Alert.alert(
        'Different Shop',
        `${t('messages.cartHasItems')} ${shop.name}?`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: 'Clear & Add', onPress: () => { clearCart(); doAdd(product); } },
        ]
      );
    } else {
      doAdd(product);
    }
  };

  const doAdd = (product) => {
    addToCart(shop.id, shop.name, {
      productId: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      image: product.image,
    });
  };

  const handleReview = async () => {
    if (!reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      await createReview(shop.id, { rating: reviewRating, comment: reviewComment.trim() });
      const res = await getShopReviews(shop.id);
      setReviews(res.data || []);
      setReviewComment('');
      setReviewRating(5);
      Alert.alert(t('common.success'), 'Review submitted!');
    } catch (err) {
      Alert.alert(t('common.error'), err.response?.data?.detail || 'Failed to submit review');
    } finally { setSubmittingReview(false); }
  };

  const cartInThisShop = cart.shopId === shop.id ? cart.items : [];

  const getCartQty = (productId) => {
    const item = cartInThisShop.find(i => i.productId === productId);
    return item ? item.quantity : 0;
  };

  const renderProduct = ({ item: p }) => {
    const qty = getCartQty(p.id);
    return (
      <View style={{
        backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm, padding: Spacing.md,
        flexDirection: 'row', gap: Spacing.md,
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
      }}>
        <View style={{
          width: 72, height: 72, borderRadius: BorderRadius.md,
          backgroundColor: Colors.background, overflow: 'hidden',
          justifyContent: 'center', alignItems: 'center',
        }}>
          {p.image ? (
            <Image source={{ uri: fixImageUrl(p.image) }} style={{ width: 72, height: 72 }} resizeMode="cover" />
          ) : (
            <Text style={{ fontSize: 28 }}>{'\uD83D\uDCE6'}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary }} numberOfLines={2}>
            {p.name}
          </Text>
          <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>
            {p.category} {p.unit ? `\u2022 ${p.unit}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.primary }}>
                {'\u20B9'}{p.price}
              </Text>
              {p.mrp && p.mrp > p.price && (
                <Text style={{ fontSize: 12, color: Colors.textMuted, textDecorationLine: 'line-through' }}>
                  {'\u20B9'}{p.mrp}
                </Text>
              )}
            </View>
            {qty > 0 ? (
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: Colors.primary, borderRadius: BorderRadius.md, overflow: 'hidden',
              }}>
                <TouchableOpacity
                  onPress={() => updateQuantity(p.id, qty - 1)}
                  style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>-</Text>
                </TouchableOpacity>
                <Text style={{ color: '#fff', fontWeight: '700', paddingHorizontal: 8 }}>{qty}</Text>
                <TouchableOpacity
                  onPress={() => handleAdd(p)}
                  style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>+</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handleAdd(p)}
                style={{
                  backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
                  paddingHorizontal: 14, paddingVertical: 7,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                  {t('marketplace.addToCart')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
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
      {/* Shop header */}
      <View style={{
        backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm, paddingBottom: Spacing.lg,
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: Spacing.sm }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{'\u2190'} Back</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: Spacing.md }}>
          <View style={{
            width: 56, height: 56, borderRadius: BorderRadius.lg,
            backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center',
            alignItems: 'center', overflow: 'hidden',
          }}>
            {shop.logo ? (
              <Image source={{ uri: fixImageUrl(shop.logo) }} style={{ width: 56, height: 56 }} />
            ) : (
              <Text style={{ fontSize: 24 }}>{'\uD83C\uDFEA'}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>{shop.name}</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
              {shop.category} {'\u2022'} {shop.address || shop.location_name}
            </Text>
            {shop.rating > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                <Text style={{ fontSize: 12 }}>{'\u2B50'}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>
                  {shop.rating?.toFixed(1)} ({shop.review_count || 0})
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row', backgroundColor: Colors.white,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
      }}>
        {['products', 'reviews'].map(t2 => (
          <TouchableOpacity
            key={t2}
            onPress={() => setTab(t2)}
            style={{
              flex: 1, paddingVertical: 12, alignItems: 'center',
              borderBottomWidth: tab === t2 ? 2 : 0,
              borderBottomColor: Colors.primary,
            }}
          >
            <Text style={{
              fontSize: 13, fontWeight: '600',
              color: tab === t2 ? Colors.primary : Colors.textMuted,
            }}>
              {t2 === 'products' ? `${t('marketplace.products')} (${products.length})` : `Reviews (${reviews.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'products' ? (
        <>
          {/* Category filter */}
          {categories.length > 0 && (
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              style={{ backgroundColor: Colors.white, paddingVertical: 8 }}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
            >
              <TouchableOpacity
                onPress={() => setSelectedCat(null)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full,
                  marginRight: 8, borderWidth: 1,
                  borderColor: !selectedCat ? Colors.primary : Colors.border,
                  backgroundColor: !selectedCat ? 'rgba(90,90,64,0.08)' : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 11, fontWeight: '600',
                  color: !selectedCat ? Colors.primary : Colors.textSecondary,
                }}>All</Text>
              </TouchableOpacity>
              {categories.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setSelectedCat(selectedCat === c ? null : c)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full,
                    marginRight: 8, borderWidth: 1,
                    borderColor: selectedCat === c ? Colors.primary : Colors.border,
                    backgroundColor: selectedCat === c ? 'rgba(90,90,64,0.08)' : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 11, fontWeight: '600',
                    color: selectedCat === c ? Colors.primary : Colors.textSecondary,
                  }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <FlatList
            data={filtered}
            keyExtractor={item => String(item.id)}
            renderItem={renderProduct}
            contentContainerStyle={{ padding: Spacing.lg }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Text style={{ fontSize: 14, color: Colors.textMuted }}>No products available</Text>
              </View>
            }
          />
        </>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
          {/* Write review */}
          {currentUser && (
            <View style={{
              backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
              padding: Spacing.lg, marginBottom: Spacing.lg,
            }}>
              <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: Spacing.sm }}>Write a Review</Text>
              <View style={{ flexDirection: 'row', gap: 4, marginBottom: Spacing.sm }}>
                {[1, 2, 3, 4, 5].map(s => (
                  <TouchableOpacity key={s} onPress={() => setReviewRating(s)}>
                    <Text style={{ fontSize: 24 }}>{s <= reviewRating ? '\u2B50' : '\u2606'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={{
                  backgroundColor: Colors.background, borderRadius: BorderRadius.md,
                  padding: 12, fontSize: 13, minHeight: 60, textAlignVertical: 'top',
                  color: Colors.textPrimary, marginBottom: Spacing.sm,
                }}
                placeholder="Share your experience..."
                placeholderTextColor={Colors.textLight}
                multiline
                value={reviewComment}
                onChangeText={setReviewComment}
              />
              <TouchableOpacity
                onPress={handleReview}
                disabled={submittingReview || !reviewComment.trim()}
                style={{
                  backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
                  paddingVertical: 10, alignItems: 'center',
                  opacity: submittingReview || !reviewComment.trim() ? 0.5 : 1,
                }}
              >
                {submittingReview ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Submit Review</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Reviews list */}
          {reviews.map((r, i) => (
            <View key={i} style={{
              backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
              padding: Spacing.lg, marginBottom: Spacing.sm,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '600' }}>{r.customer_name || 'Anonymous'}</Text>
                <View style={{ flexDirection: 'row' }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Text key={s} style={{ fontSize: 12 }}>{s <= r.rating ? '\u2B50' : '\u2606'}</Text>
                  ))}
                </View>
              </View>
              <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 4 }}>{r.comment}</Text>
              <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 4 }}>
                {new Date(r.created_at).toLocaleDateString('en-IN')}
              </Text>
            </View>
          ))}

          {reviews.length === 0 && (
            <Text style={{ textAlign: 'center', color: Colors.textMuted, marginTop: 20 }}>
              No reviews yet
            </Text>
          )}
        </ScrollView>
      )}

      {/* Floating cart bar */}
      {cartItemCount > 0 && cart.shopId === shop.id && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Cart')}
          style={{
            position: 'absolute', bottom: 16, left: 16, right: 16,
            backgroundColor: Colors.primary, borderRadius: BorderRadius.xl,
            paddingVertical: 14, paddingHorizontal: 20,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {cartItemCount} item{cartItemCount > 1 ? 's' : ''} in cart
          </Text>
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {t('marketplace.viewCart')} {'\u2192'}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
