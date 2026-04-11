import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, ActivityIndicator, RefreshControl, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listShops, listProducts } from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';
import { LOCATIONS, CATEGORIES, API_URL } from '../../constants/config';

const fixImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
};

export default function MarketplaceScreen({ navigation }) {
  const { currentUser, search, setSearch, activeLocation, setActiveLocation, addToCart, cart, clearCart } = useApp();
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
      setShops(res.data || []);
    } catch {
      Alert.alert(t('common.error'), t('messages.failedToLoadShops'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeLocation, search, selectedCategory, t]);

  useEffect(() => { loadShops(); }, [loadShops]);

  const onRefresh = () => { setRefreshing(true); loadShops(); };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const openCount = shops.filter(s => s.is_open).length;

  const handleAddToCart = (shop, product) => {
    if (cart.shopId && cart.shopId !== shop.id) {
      Alert.alert(
        'Different Shop',
        `${t('messages.cartHasItems')} ${shop.name}?`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: 'Clear & Add', onPress: () => { clearCart(); doAdd(shop, product); } },
        ]
      );
    } else {
      doAdd(shop, product);
    }
  };

  const doAdd = (shop, product) => {
    addToCart(shop.id, shop.name, {
      productId: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      image: product.image,
    });
  };

  const renderShopCard = ({ item: shop }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('ShopDetail', { shop })}
      style={{
        backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
        marginBottom: Spacing.md, overflow: 'hidden',
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
      }}
    >
      {/* Shop header */}
      <View style={{ flexDirection: 'row', padding: Spacing.lg, gap: Spacing.md }}>
        <View style={{
          width: 56, height: 56, borderRadius: BorderRadius.lg,
          backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center',
          overflow: 'hidden',
        }}>
          {shop.logo ? (
            <Image source={{ uri: fixImageUrl(shop.logo) }} style={{ width: 56, height: 56 }} />
          ) : (
            <Text style={{ fontSize: 24 }}>{'\uD83C\uDFEA'}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }} numberOfLines={1}>
              {shop.name}
            </Text>
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full,
              backgroundColor: shop.is_open ? Colors.successBg : Colors.dangerBg,
            }}>
              <Text style={{
                fontSize: 10, fontWeight: '700',
                color: shop.is_open ? Colors.success : Colors.danger,
              }}>
                {shop.is_open ? t('common.open').toUpperCase() : t('common.closed').toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
            {shop.category} {shop.location_name ? `\u2022 ${shop.location_name}` : ''}
          </Text>
          {shop.rating > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
              <Text style={{ fontSize: 12 }}>{'\u2B50'}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textPrimary }}>
                {shop.rating?.toFixed(1)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

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
      <View style={{ backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
          <View>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              Good {greeting}, {currentUser?.display_name?.split(' ')[0] || 'there'}
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
              {t('common.appName')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Cart')}
            style={{ position: 'relative', padding: 8 }}
          >
            <Text style={{ fontSize: 24 }}>{'\uD83D\uDED2'}</Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <TextInput
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.lg,
            paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
            color: '#fff',
          }}
          placeholder={t('common.searchPlaceholder')}
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={search}
          onChangeText={setSearch}
        />

        {/* Location filter */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={{ marginTop: Spacing.sm }}
        >
          {LOCATIONS.map(loc => (
            <TouchableOpacity
              key={loc}
              onPress={() => setActiveLocation(loc)}
              style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: BorderRadius.full,
                marginRight: 8,
                backgroundColor: activeLocation === loc ? '#fff' : 'rgba(255,255,255,0.12)',
              }}
            >
              <Text style={{
                fontSize: 12, fontWeight: '600',
                color: activeLocation === loc ? Colors.primary : 'rgba(255,255,255,0.7)',
              }}>
                {loc === 'All' ? t('common.all') : loc}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stats bar */}
      <View style={{
        flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
      }}>
        <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
          {openCount} {t('marketplace.shopsOpen')} {'\u2022'} {shops.length} {t('common.shops')}
        </Text>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: Colors.white, paddingVertical: Spacing.sm }}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
      >
        <TouchableOpacity
          onPress={() => setSelectedCategory(null)}
          style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full,
            marginRight: 8, borderWidth: 1,
            borderColor: !selectedCategory ? Colors.primary : Colors.border,
            backgroundColor: !selectedCategory ? 'rgba(90,90,64,0.08)' : 'transparent',
          }}
        >
          <Text style={{
            fontSize: 12, fontWeight: '600',
            color: !selectedCategory ? Colors.primary : Colors.textSecondary,
          }}>
            {t('common.all')}
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full,
              marginRight: 8, borderWidth: 1,
              borderColor: selectedCategory === cat ? Colors.primary : Colors.border,
              backgroundColor: selectedCategory === cat ? 'rgba(90,90,64,0.08)' : 'transparent',
            }}
          >
            <Text style={{
              fontSize: 12, fontWeight: '600',
              color: selectedCategory === cat ? Colors.primary : Colors.textSecondary,
            }}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Shop list */}
      <FlatList
        data={shops}
        keyExtractor={item => String(item.id)}
        renderItem={renderShopCard}
        contentContainerStyle={{ padding: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>{'\uD83C\uDFEA'}</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.textSecondary }}>
              {t('messages.noShopsFound')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
