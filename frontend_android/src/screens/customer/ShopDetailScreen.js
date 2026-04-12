import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  ActivityIndicator, Alert, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { listProducts, getShopReviews, createReview } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Colors, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import { API_URL } from '../../constants/config';

const fixImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
};

export default function ShopDetailScreen({ route, navigation }) {
  const { shop } = route.params;
  const { addToCart, updateQuantity, cart, clearCart, currentUser, cartItemCount, cartTotal } = useApp();
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
        setProducts(prodRes.data?.items || (Array.isArray(prodRes.data) ? prodRes.data : []));
        setReviews(revRes.data?.items || (Array.isArray(revRes.data) ? revRes.data : []));
      } catch {} finally { setLoading(false); }
    })();
  }, [shop.id]);

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const filtered = selectedCat ? products.filter(p => p.category === selectedCat) : products;

  const handleAdd = (product) => {
    if (cart.shopId && cart.shopId !== shop.id) {
      Alert.alert(
        'Different Shop',
        `Clear current cart and add from ${shop.name}?`,
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
      setReviews(res.data?.items || (Array.isArray(res.data) ? res.data : []));
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

  const discountPct = (price, mrp) => mrp && mrp > price ? Math.round((1 - price / mrp) * 100) : 0;

  const renderProduct = ({ item: p }) => {
    const qty = getCartQty(p.id);
    const pct = discountPct(p.price, p.mrp);
    const isLowStock = p.stock > 0 && p.stock <= (p.low_stock_threshold || 5);
    const isOutOfStock = p.stock === 0;

    return (
      <View style={{
        backgroundColor: Colors.white,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
        flexDirection: 'row',
        overflow: 'hidden',
        ...Shadow.sm,
        opacity: isOutOfStock ? 0.6 : 1,
      }}>
        {/* Image area */}
        <View style={{
          width: 88, height: 88,
          backgroundColor: Colors.backgroundAlt,
          justifyContent: 'center', alignItems: 'center',
          position: 'relative',
        }}>
          {p.image ? (
            <Image source={{ uri: fixImageUrl(p.image) }} style={{ width: 88, height: 88 }} resizeMode="cover" />
          ) : (
            <Text style={{ fontSize: 30 }}>📦</Text>
          )}
          {pct > 0 && (
            <View style={{
              position: 'absolute', top: 0, left: 0,
              backgroundColor: Colors.danger,
              paddingHorizontal: 5, paddingVertical: 2,
              borderBottomRightRadius: BorderRadius.xs,
            }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{pct}% OFF</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1, padding: Spacing.md, justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }} numberOfLines={2}>
              {p.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              {p.category && (
                <Text style={{ fontSize: 10, color: Colors.textMuted }}>{p.category}</Text>
              )}
              {p.unit && (
                <Text style={{ fontSize: 10, color: Colors.textMuted }}>· {p.unit}</Text>
              )}
            </View>
            {isLowStock && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                <Ionicons name="alert-circle" size={10} color={Colors.warning} />
                <Text style={{ fontSize: 10, color: Colors.warning, fontWeight: '600' }}>Only {p.stock} left</Text>
              </View>
            )}
            {isOutOfStock && (
              <Text style={{ fontSize: 10, color: Colors.danger, fontWeight: '600', marginTop: 2 }}>Out of stock</Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.primary }}>₹{p.price}</Text>
              {pct > 0 && (
                <Text style={{ fontSize: 11, color: Colors.textMuted, textDecorationLine: 'line-through' }}>₹{p.mrp}</Text>
              )}
            </View>

            {isOutOfStock ? null : qty > 0 ? (
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
                overflow: 'hidden',
              }}>
                <TouchableOpacity
                  onPress={() => updateQuantity(p.id, qty - 1)}
                  style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                >
                  <Ionicons name="remove" size={14} color="#fff" />
                </TouchableOpacity>
                <Text style={{ color: '#fff', fontWeight: '800', paddingHorizontal: 6, fontSize: 13 }}>{qty}</Text>
                <TouchableOpacity
                  onPress={() => handleAdd(p)}
                  style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                >
                  <Ionicons name="add" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handleAdd(p)}
                style={{
                  backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
                  paddingHorizontal: 14, paddingVertical: 7,
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                }}
              >
                <Ionicons name="add" size={13} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>ADD</Text>
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

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Shop header */}
      <View style={{ backgroundColor: Colors.primary, paddingBottom: Spacing.lg }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: 6 }}
        >
          <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.8)" />
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' }}>Back</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.md, alignItems: 'center' }}>
          <View style={{
            width: 60, height: 60, borderRadius: BorderRadius.lg,
            backgroundColor: 'rgba(255,255,255,0.2)',
            justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
          }}>
            {shop.logo ? (
              <Image source={{ uri: fixImageUrl(shop.logo) }} style={{ width: 60, height: 60 }} resizeMode="cover" />
            ) : (
              <Text style={{ fontSize: 26 }}>🏪</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>{shop.name}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="grid-outline" size={11} color="rgba(255,255,255,0.6)" />
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{shop.category}</Text>
              </View>
              {(shop.address || shop.location_name) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.6)" />
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }} numberOfLines={1}>
                    {shop.address || shop.location_name}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 }}>
              <View style={{
                paddingHorizontal: 7, paddingVertical: 2, borderRadius: BorderRadius.full,
                backgroundColor: shop.is_open ? Colors.success : Colors.textMuted,
              }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                  {shop.is_open ? '● OPEN' : '● CLOSED'}
                </Text>
              </View>
              {(avgRating || shop.rating > 0) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="star" size={12} color={Colors.warning} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>
                    {avgRating || shop.rating?.toFixed(1)}
                    {reviews.length > 0 && <Text style={{ fontWeight: '400', fontSize: 10 }}> ({reviews.length})</Text>}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row', backgroundColor: Colors.white,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
      }}>
        {[
          { key: 'products', label: `Products (${products.length})`, icon: 'storefront-outline' },
          { key: 'reviews', label: `Reviews (${reviews.length})`, icon: 'chatbubbles-outline' },
        ].map(tb => (
          <TouchableOpacity
            key={tb.key}
            onPress={() => setTab(tb.key)}
            style={{
              flex: 1, paddingVertical: 12, alignItems: 'center',
              flexDirection: 'row', justifyContent: 'center', gap: 6,
              borderBottomWidth: tab === tb.key ? 2 : 0,
              borderBottomColor: Colors.primary,
            }}
          >
            <Ionicons
              name={tb.icon}
              size={14}
              color={tab === tb.key ? Colors.primary : Colors.textMuted}
            />
            <Text style={{
              fontSize: 13, fontWeight: '600',
              color: tab === tb.key ? Colors.primary : Colors.textMuted,
            }}>
              {tb.label}
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
              style={{ backgroundColor: Colors.white, maxHeight: 48 }}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingVertical: 8, gap: 6 }}
            >
              <TouchableOpacity
                onPress={() => setSelectedCat(null)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 6, borderRadius: BorderRadius.full,
                  borderWidth: 1.5,
                  borderColor: !selectedCat ? Colors.primary : Colors.border,
                  backgroundColor: !selectedCat ? Colors.primaryBg : 'transparent',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: !selectedCat ? Colors.primary : Colors.textMuted }}>All</Text>
              </TouchableOpacity>
              {categories.map(c => {
                const count = products.filter(p => p.category === c).length;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setSelectedCat(selectedCat === c ? null : c)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full,
                      borderWidth: 1.5,
                      borderColor: selectedCat === c ? Colors.primary : Colors.border,
                      backgroundColor: selectedCat === c ? Colors.primaryBg : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: selectedCat === c ? Colors.primary : Colors.textMuted }}>
                      {c} <Text style={{ fontSize: 10 }}>({count})</Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <FlatList
            data={filtered}
            keyExtractor={item => String(item.id)}
            renderItem={renderProduct}
            contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 48 }}>
                <Ionicons name="cube-outline" size={48} color={Colors.border} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.textSecondary, marginTop: 12 }}>
                  No products available
                </Text>
              </View>
            }
          />
        </>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }}>
          {/* Write review */}
          {currentUser && (
            <View style={{
              backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
              padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadow.sm,
            }}>
              <Text style={{ fontSize: 15, fontWeight: '700', marginBottom: Spacing.md, color: Colors.textPrimary }}>
                Write a Review
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: Spacing.md }}>
                {[1, 2, 3, 4, 5].map(s => (
                  <TouchableOpacity key={s} onPress={() => setReviewRating(s)}>
                    <Ionicons
                      name={s <= reviewRating ? 'star' : 'star-outline'}
                      size={28}
                      color={s <= reviewRating ? Colors.warning : Colors.border}
                    />
                  </TouchableOpacity>
                ))}
                <Text style={{ marginLeft: 8, fontSize: 13, color: Colors.textMuted, alignSelf: 'center' }}>
                  {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][reviewRating]}
                </Text>
              </View>
              <TextInput
                style={{
                  backgroundColor: Colors.background, borderRadius: BorderRadius.md,
                  padding: 12, fontSize: 13, minHeight: 72, textAlignVertical: 'top',
                  color: Colors.textPrimary, marginBottom: Spacing.md,
                  borderWidth: 1, borderColor: Colors.border,
                }}
                placeholder="Share your experience with this shop..."
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
                  paddingVertical: 12, alignItems: 'center',
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                  opacity: submittingReview || !reviewComment.trim() ? 0.5 : 1,
                }}
              >
                {submittingReview ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Submit Review</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Reviews list */}
          {reviews.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.border} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.textSecondary, marginTop: 12 }}>No reviews yet</Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 4 }}>Be the first to review this shop</Text>
            </View>
          ) : (
            reviews.map((r, i) => (
              <View key={i} style={{
                backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                padding: Spacing.lg, marginBottom: Spacing.sm, ...Shadow.sm,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: Colors.primaryBg,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.primary }}>
                      {(r.customer_name || 'A')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>
                      {r.customer_name || 'Anonymous'}
                    </Text>
                    <Text style={{ fontSize: 10, color: Colors.textMuted }}>
                      {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Ionicons name="star" size={12} color={Colors.warning} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>{r.rating}</Text>
                  </View>
                </View>
                {r.comment ? (
                  <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 10, lineHeight: 19 }}>
                    {r.comment}
                  </Text>
                ) : null}
              </View>
            ))
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
            ...Shadow.lg,
          }}
        >
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: BorderRadius.sm,
            paddingHorizontal: 8, paddingVertical: 3,
          }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{cartItemCount}</Text>
          </View>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
            View Cart · ₹{cartTotal?.toFixed(2)}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
