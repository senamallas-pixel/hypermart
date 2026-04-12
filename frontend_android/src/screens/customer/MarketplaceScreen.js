import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { listShops } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Colors, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import { LOCATIONS, CATEGORIES, API_URL } from '../../constants/config';

const fixImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
};

const CATEGORY_ICONS = {
  'Grocery': '🛒', 'Dairy': '🥛', 'Vegetables & Fruits': '🥦',
  'Meat': '🥩', 'Bakery & Snacks': '🍞', 'Beverages': '🧃',
  'Household': '🏠', 'Personal Care': '🧴',
};

export default function MarketplaceScreen({ navigation }) {
  const { currentUser, search, setSearch, activeLocation, setActiveLocation, cartItemCount } = useApp();
  const { t } = useTranslation();

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const loadShops = useCallback(async () => {
    try {
      const params = {};
      if (activeLocation !== 'All') params.location = activeLocation;
      if (search) params.search = search;
      if (selectedCategory) params.category = selectedCategory;
      const res = await listShops(params);
      setShops(res.data?.items || (Array.isArray(res.data) ? res.data : []));
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeLocation, search, selectedCategory]);

  useEffect(() => { loadShops(); }, [loadShops]);

  const onRefresh = () => { setRefreshing(true); loadShops(); };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const openCount = shops.filter(s => s.is_open).length;

  const renderShopCard = ({ item: shop }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('ShopDetail', { shop })}
      activeOpacity={0.7}
      style={{
        backgroundColor: Colors.white,
        borderRadius: BorderRadius.xl,
        marginBottom: Spacing.md,
        overflow: 'hidden',
        ...Shadow.sm,
      }}
    >
      {/* Shop banner area */}
      <View style={{
        height: 80, backgroundColor: Colors.primaryBg,
        justifyContent: 'center', alignItems: 'center',
      }}>
        {shop.logo ? (
          <Image source={{ uri: fixImageUrl(shop.logo) }} style={{ width: '100%', height: 80 }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: 40 }}>{CATEGORY_ICONS[shop.category] || '🏪'}</Text>
        )}
        {/* Status badge */}
        <View style={{
          position: 'absolute', top: 8, right: 8,
          paddingHorizontal: 8, paddingVertical: 3,
          borderRadius: BorderRadius.full,
          backgroundColor: shop.is_open ? Colors.success : Colors.textMuted,
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
            {shop.is_open ? '● OPEN' : '● CLOSED'}
          </Text>
        </View>
      </View>

      {/* Shop info */}
      <View style={{ padding: Spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary }} numberOfLines={1}>
              {shop.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 }}>
              <View style={{
                backgroundColor: Colors.backgroundAlt, borderRadius: BorderRadius.xs,
                paddingHorizontal: 6, paddingVertical: 2,
              }}>
                <Text style={{ fontSize: 10, color: Colors.textSecondary, fontWeight: '600' }}>
                  {shop.category}
                </Text>
              </View>
              {shop.location_name && (
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                  📍 {shop.location_name}
                </Text>
              )}
            </View>
          </View>
          {shop.rating > 0 && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 3,
              backgroundColor: Colors.warningBg, borderRadius: BorderRadius.xs,
              paddingHorizontal: 6, paddingVertical: 3,
            }}>
              <Ionicons name="star" size={11} color={Colors.warning} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.warningDark }}>
                {shop.rating?.toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
          {shop.delivery_radius && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="bicycle-outline" size={12} color={Colors.textMuted} />
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>{shop.delivery_radius} km</Text>
            </View>
          )}
          {shop.review_count > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="chatbubble-outline" size={11} color={Colors.textMuted} />
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>{shop.review_count} reviews</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '600' }}>View Products</Text>
            <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 13 }}>Loading shops…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
          <View>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              {greeting}, {currentUser?.display_name?.split(' ')[0] || 'there'} 👋
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }}>
              HyperMart
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Cart')}
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.lg,
              width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Ionicons name="cart-outline" size={22} color="#fff" />
            {cartItemCount > 0 && (
              <View style={{
                position: 'absolute', top: 6, right: 6,
                backgroundColor: Colors.danger, borderRadius: 8,
                width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
                borderWidth: 1.5, borderColor: Colors.primary,
              }}>
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>
                  {cartItemCount > 9 ? '9+' : cartItemCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.lg,
          paddingHorizontal: 12, paddingVertical: 2,
        }}>
          <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: '#fff', paddingVertical: 10 }}
            placeholder="Search shops or products…"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Location filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.sm }} contentContainerStyle={{ gap: 6 }}>
          {LOCATIONS.map(loc => (
            <TouchableOpacity
              key={loc}
              onPress={() => setActiveLocation(loc)}
              style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: BorderRadius.full,
                backgroundColor: activeLocation === loc ? '#fff' : 'rgba(255,255,255,0.12)',
              }}
            >
              <Text style={{
                fontSize: 12, fontWeight: '600',
                color: activeLocation === loc ? Colors.primary : 'rgba(255,255,255,0.75)',
              }}>
                {loc === 'All' ? '📍 All Areas' : loc}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stats + Categories */}
      <View style={{ backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
        <View style={{ flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success }} />
            <Text style={{ fontSize: 12, color: Colors.textSecondary, fontWeight: '500' }}>
              {openCount} open
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginHorizontal: 6 }}>·</Text>
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>{shops.length} shops</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: Spacing.sm }} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 6 }}>
          <TouchableOpacity
            onPress={() => setSelectedCategory(null)}
            style={{
              paddingHorizontal: 14, paddingVertical: 7, borderRadius: BorderRadius.full,
              borderWidth: 1.5,
              borderColor: !selectedCategory ? Colors.primary : Colors.border,
              backgroundColor: !selectedCategory ? Colors.primaryBg : 'transparent',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: !selectedCategory ? Colors.primary : Colors.textMuted }}>All</Text>
          </TouchableOpacity>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.full,
                borderWidth: 1.5,
                borderColor: selectedCategory === cat ? Colors.primary : Colors.border,
                backgroundColor: selectedCategory === cat ? Colors.primaryBg : 'transparent',
              }}
            >
              <Text style={{ fontSize: 12 }}>{CATEGORY_ICONS[cat] || '🛍️'}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: selectedCategory === cat ? Colors.primary : Colors.textMuted }}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Shop list */}
      <FlatList
        data={shops}
        keyExtractor={item => String(item.id)}
        renderItem={renderShopCard}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="storefront-outline" size={56} color={Colors.border} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.textSecondary, marginTop: 16 }}>
              No shops found
            </Text>
            <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 4 }}>
              Try a different location or category
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
