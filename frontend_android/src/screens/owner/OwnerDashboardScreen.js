import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  getMyShops, createShop, updateShop, listProducts, createProduct, updateProduct,
  deleteProduct, getShopOrders, updateOrderStatus, getShopAnalytics, getShopReports,
  uploadFile, suggestProducts, generateDescription, getLowStockInsight, aiSalesForecast,
  placeWalkinOrder, getOrderPaymentStatus, markOrderPaymentStatus,
  listSuppliers, createSupplier, updateSupplier, deleteSupplier,
  listProductDiscounts, createProductDiscount, deleteProductDiscount,
  listOrderDiscounts, createOrderDiscount, deleteOrderDiscount,
  bulkUpdateProducts,
} from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import StatCard from '../../components/StatCard';
import { Colors, BorderRadius, Spacing, Shadow } from '../../constants/theme';
import { API_URL, CATEGORIES } from '../../constants/config';

const fixImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
};

const TABS = [
  { key: 'Overview',   label: 'Overview',   icon: 'grid-outline' },
  { key: 'Inventory',  label: 'Products',   icon: 'cube-outline' },
  { key: 'Orders',     label: 'Orders',     icon: 'receipt-outline' },
  { key: 'Billing',    label: 'Billing',    icon: 'calculator-outline' },
  { key: 'Reports',    label: 'Reports',    icon: 'bar-chart-outline' },
  { key: 'Settings',   label: 'Settings',   icon: 'settings-outline' },
];

const inputStyle = {
  backgroundColor: Colors.background,
  borderRadius: BorderRadius.md,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 14,
  color: Colors.textPrimary,
  marginBottom: 10,
};

export default function OwnerDashboardScreen() {
  const { currentUser, aiAvailable } = useApp();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('Overview');
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [loading, setLoading] = useState(true);

  // Products state
  const [products, setProducts] = useState([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodForm, setProdForm] = useState({
    name: '', price: '', mrp: '', unit: 'kg', category: 'Grocery',
    stock: '', description: '', low_stock_threshold: '',
  });
  const [prodSaving, setProdSaving] = useState(false);
  const [prodImageUri, setProdImageUri] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);

  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all');

  // Analytics state
  const [analytics, setAnalytics] = useState(null);

  // Reports state
  const [reports, setReports] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');

  // Billing (walk-in) state
  const [walkinItems, setWalkinItems] = useState([{ product_id: '', quantity: '1', name: '', price: '' }]);
  const [walkinPayMethod, setWalkinPayMethod] = useState('cash');
  const [walkinLoading, setWalkinLoading] = useState(false);
  const [billingOrders, setBillingOrders] = useState([]);

  // Settings / shop form state
  const [shopSettingsForm, setShopSettingsForm] = useState({
    name: '', address: '', location_name: '', pincode: '', city: '',
    upi_id: '', delivery_radius: '',
  });
  const [shopSettingsSaving, setShopSettingsSaving] = useState(false);

  // Shop registration modal
  const [showShopModal, setShowShopModal] = useState(false);
  const [shopForm, setShopForm] = useState({
    name: '', category: 'Grocery', address: '', location_name: '',
    pincode: '', city: '', upi_id: '',
  });
  const [shopSaving, setShopSaving] = useState(false);

  // Suppliers state
  const [suppliers, setSuppliers] = useState([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact_name: '', phone: '', email: '' });
  const [editingSupplier, setEditingSupplier] = useState(null);

  // Discounts state
  const [productDiscounts, setProductDiscounts] = useState([]);
  const [orderDiscounts, setOrderDiscounts] = useState([]);
  const [showProductDiscountModal, setShowProductDiscountModal] = useState(false);
  const [showOrderDiscountModal, setShowOrderDiscountModal] = useState(false);
  const [prodDiscountForm, setProdDiscountForm] = useState({ product_id: '', discount_percent: '', min_quantity: '1' });
  const [orderDiscountForm, setOrderDiscountForm] = useState({ min_order_amount: '', discount_percent: '', discount_amount: '' });

  const loadShops = useCallback(async () => {
    try {
      const res = await getMyShops();
      const list = res.data || [];
      setShops(list);
      if (list.length > 0 && !selectedShop) {
        setSelectedShop(list[0]);
        populateSettingsForm(list[0]);
      }
    } catch {} finally { setLoading(false); }
  }, [selectedShop]);

  useEffect(() => { loadShops(); }, []);

  useEffect(() => {
    if (selectedShop) {
      loadProducts();
      loadOrders();
      loadAnalytics();
      loadSuppliers();
      loadDiscounts();
      populateSettingsForm(selectedShop);
    }
  }, [selectedShop]);

  const populateSettingsForm = (shop) => {
    setShopSettingsForm({
      name: shop.name || '',
      address: shop.address || '',
      location_name: shop.location_name || '',
      pincode: shop.pincode || '',
      city: shop.city || '',
      upi_id: shop.upi_id || '',
      delivery_radius: shop.delivery_radius ? String(shop.delivery_radius) : '',
    });
  };

  const loadProducts = async () => {
    if (!selectedShop) return;
    setProdLoading(true);
    try {
      const res = await listProducts(selectedShop.id, false);
      setProducts(res.data || []);
    } catch {} finally { setProdLoading(false); }
  };

  const loadOrders = async () => {
    if (!selectedShop) return;
    setOrdersLoading(true);
    try {
      const res = await getShopOrders(selectedShop.id);
      const list = res.data?.items || res.data?.orders || (Array.isArray(res.data) ? res.data : []);
      setOrders(list);
      setBillingOrders(list.filter(o => o.order_type === 'walkin'));
    } catch {} finally { setOrdersLoading(false); }
  };

  const loadAnalytics = async () => {
    if (!selectedShop) return;
    try {
      const res = await getShopAnalytics(selectedShop.id);
      setAnalytics(res.data);
    } catch {}
  };

  const loadReports = async () => {
    if (!selectedShop) return;
    setReportsLoading(true);
    try {
      const res = await getShopReports(selectedShop.id, reportFrom || undefined, reportTo || undefined);
      setReports(res.data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to load reports');
    } finally { setReportsLoading(false); }
  };

  const loadSuppliers = async () => {
    if (!selectedShop) return;
    try {
      const res = await listSuppliers(selectedShop.id);
      setSuppliers(res.data || []);
    } catch {}
  };

  const loadDiscounts = async () => {
    if (!selectedShop) return;
    try {
      const [pd, od] = await Promise.all([
        listProductDiscounts(selectedShop.id),
        listOrderDiscounts(selectedShop.id),
      ]);
      setProductDiscounts(pd.data || []);
      setOrderDiscounts(od.data || []);
    } catch {}
  };

  // ── Shop Create / Settings ─────────────────────────────────────

  const handleCreateShop = async () => {
    if (!shopForm.name.trim()) { Alert.alert('Error', 'Shop name is required'); return; }
    setShopSaving(true);
    try {
      await createShop(shopForm);
      setShowShopModal(false);
      setShopForm({ name: '', category: 'Grocery', address: '', location_name: '', pincode: '', city: '', upi_id: '' });
      loadShops();
      Alert.alert('Success', 'Shop registration submitted for approval');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create shop');
    } finally { setShopSaving(false); }
  };

  const handleSaveSettings = async () => {
    if (!selectedShop) return;
    setShopSettingsSaving(true);
    try {
      const data = {
        name: shopSettingsForm.name,
        address: shopSettingsForm.address,
        location_name: shopSettingsForm.location_name,
        pincode: shopSettingsForm.pincode,
        city: shopSettingsForm.city,
        upi_id: shopSettingsForm.upi_id,
        delivery_radius: shopSettingsForm.delivery_radius ? parseFloat(shopSettingsForm.delivery_radius) : undefined,
      };
      const res = await updateShop(selectedShop.id, data);
      setSelectedShop(res.data);
      setShops(prev => prev.map(s => s.id === res.data.id ? res.data : s));
      Alert.alert('Success', 'Shop settings updated');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save settings');
    } finally { setShopSettingsSaving(false); }
  };

  // ── Products ──────────────────────────────────────────────────

  const handlePickProductImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to upload images'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) {
      setProdImageUri(result.assets[0].uri);
    }
  };

  const handleSaveProduct = async () => {
    if (!prodForm.name || !prodForm.price) { Alert.alert('Error', 'Name and price are required'); return; }
    setProdSaving(true);
    try {
      let imageUrl = editingProduct?.image || undefined;
      if (prodImageUri) {
        const fileName = prodImageUri.split('/').pop();
        const uploadRes = await uploadFile(prodImageUri, fileName, 'image/jpeg');
        imageUrl = uploadRes.data?.url || uploadRes.data?.path;
      }
      const data = {
        name: prodForm.name, price: parseFloat(prodForm.price),
        mrp: prodForm.mrp ? parseFloat(prodForm.mrp) : undefined,
        unit: prodForm.unit, category: prodForm.category,
        stock: prodForm.stock ? parseInt(prodForm.stock) : 0,
        description: prodForm.description || undefined,
        low_stock_threshold: prodForm.low_stock_threshold ? parseInt(prodForm.low_stock_threshold) : undefined,
        image: imageUrl,
      };
      if (editingProduct) {
        await updateProduct(selectedShop.id, editingProduct.id, data);
      } else {
        await createProduct(selectedShop.id, data);
      }
      setShowProductModal(false);
      setEditingProduct(null);
      setProdImageUri(null);
      setProdForm({ name: '', price: '', mrp: '', unit: 'kg', category: 'Grocery', stock: '', description: '', low_stock_threshold: '' });
      loadProducts();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save product');
    } finally { setProdSaving(false); }
  };

  const handleDeleteProduct = (product) => {
    Alert.alert('Delete Product', `Delete "${product.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(selectedShop.id, product.id);
            loadProducts();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const handleAISuggest = async () => {
    if (!aiAvailable) return;
    try {
      const res = await suggestProducts(prodForm.category, prodForm.name);
      setAiSuggestions(res.data?.suggestions || []);
    } catch {}
  };

  const handleAIDescription = async () => {
    if (!aiAvailable || !prodForm.name) return;
    try {
      const res = await generateDescription(prodForm.name, prodForm.category);
      if (res.data?.description) setProdForm(f => ({ ...f, description: res.data.description }));
    } catch {}
  };

  // ── Orders ────────────────────────────────────────────────────

  const handleOrderStatus = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, status);
      loadOrders();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleMarkPaymentStatus = async (orderId, status) => {
    try {
      await markOrderPaymentStatus(orderId, status);
      loadOrders();
    } catch {}
  };

  // ── Walk-in Billing ───────────────────────────────────────────

  const handleWalkinOrder = async () => {
    if (!selectedShop) return;
    const validItems = walkinItems.filter(i => i.product_id && i.quantity);
    if (validItems.length === 0) { Alert.alert('Error', 'Add at least one product'); return; }
    setWalkinLoading(true);
    try {
      await placeWalkinOrder(selectedShop.id, {
        items: validItems.map(i => ({
          product_id: parseInt(i.product_id),
          quantity: parseInt(i.quantity),
        })),
        payment_method: walkinPayMethod,
        payment_status: 'paid',
      });
      setWalkinItems([{ product_id: '', quantity: '1', name: '', price: '' }]);
      loadOrders();
      Alert.alert('Success', 'Walk-in order recorded');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to place walk-in order');
    } finally { setWalkinLoading(false); }
  };

  // ── Suppliers ─────────────────────────────────────────────────

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) { Alert.alert('Error', 'Supplier name required'); return; }
    try {
      if (editingSupplier) {
        await updateSupplier(selectedShop.id, editingSupplier.id, supplierForm);
      } else {
        await createSupplier(selectedShop.id, supplierForm);
      }
      setShowSupplierModal(false);
      setSupplierForm({ name: '', contact_name: '', phone: '', email: '' });
      setEditingSupplier(null);
      loadSuppliers();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save supplier');
    }
  };

  const handleDeleteSupplier = (s) => {
    Alert.alert('Delete Supplier', `Delete "${s.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteSupplier(selectedShop.id, s.id); loadSuppliers(); }
          catch (err) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
        },
      },
    ]);
  };

  // ── Discounts ─────────────────────────────────────────────────

  const handleCreateProductDiscount = async () => {
    if (!prodDiscountForm.product_id || !prodDiscountForm.discount_percent) {
      Alert.alert('Error', 'Product and discount % are required'); return;
    }
    try {
      await createProductDiscount(selectedShop.id, {
        product_id: parseInt(prodDiscountForm.product_id),
        discount_percent: parseFloat(prodDiscountForm.discount_percent),
        min_quantity: parseInt(prodDiscountForm.min_quantity) || 1,
      });
      setShowProductDiscountModal(false);
      setProdDiscountForm({ product_id: '', discount_percent: '', min_quantity: '1' });
      loadDiscounts();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create discount');
    }
  };

  const handleCreateOrderDiscount = async () => {
    if (!orderDiscountForm.min_order_amount) { Alert.alert('Error', 'Min order amount required'); return; }
    try {
      await createOrderDiscount(selectedShop.id, {
        min_order_amount: parseFloat(orderDiscountForm.min_order_amount),
        discount_percent: orderDiscountForm.discount_percent ? parseFloat(orderDiscountForm.discount_percent) : undefined,
        discount_amount: orderDiscountForm.discount_amount ? parseFloat(orderDiscountForm.discount_amount) : undefined,
      });
      setShowOrderDiscountModal(false);
      setOrderDiscountForm({ min_order_amount: '', discount_percent: '', discount_amount: '' });
      loadDiscounts();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create discount');
    }
  };

  const filteredOrders = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter);

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="briefcase" size={18} color="rgba(255,255,255,0.8)" />
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>
            {t('navigation.owner')}
          </Text>
        </View>
        {selectedShop && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 }}>
            <Ionicons name="storefront-outline" size={12} color="rgba(255,255,255,0.5)" />
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>
              {selectedShop.name}
            </Text>
            <View style={{
              paddingHorizontal: 7, paddingVertical: 2, borderRadius: BorderRadius.full,
              backgroundColor: selectedShop.status === 'approved' ? Colors.success + '40' : Colors.warning + '40',
            }}>
              <Text style={{
                fontSize: 9, fontWeight: '800',
                color: selectedShop.status === 'approved' ? '#6EE7B7' : '#FCD34D',
                textTransform: 'uppercase',
              }}>
                {selectedShop.status}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border, maxHeight: 60 }}
        contentContainerStyle={{ paddingHorizontal: Spacing.sm }}
      >
        {TABS.map(tb => (
          <TouchableOpacity
            key={tb.key}
            onPress={() => setActiveTab(tb.key)}
            style={{
              paddingVertical: 8, paddingHorizontal: 14,
              alignItems: 'center', justifyContent: 'center', gap: 3,
              borderBottomWidth: activeTab === tb.key ? 2 : 0,
              borderBottomColor: Colors.primary,
              minWidth: 72,
            }}
          >
            <Ionicons
              name={tb.icon}
              size={16}
              color={activeTab === tb.key ? Colors.primary : Colors.textMuted}
            />
            <Text style={{
              fontSize: 10, fontWeight: '700',
              color: activeTab === tb.key ? Colors.primary : Colors.textMuted,
            }}>
              {tb.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => { loadProducts(); loadOrders(); loadAnalytics(); loadSuppliers(); loadDiscounts(); }}
            tintColor={Colors.primary}
          />
        }
      >
        {/* ─── Overview Tab ─── */}
        {activeTab === 'Overview' && (
          <View>
            {shops.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <View style={{
                  width: 80, height: 80, borderRadius: 40,
                  backgroundColor: Colors.primaryBg,
                  justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
                }}>
                  <Ionicons name="storefront-outline" size={36} color={Colors.primary} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 }}>
                  No shop registered yet
                </Text>
                <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: Spacing.xl, textAlign: 'center' }}>
                  Register your shop to start selling
                </Text>
                <TouchableOpacity
                  onPress={() => setShowShopModal(true)}
                  style={{
                    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
                    paddingHorizontal: 28, paddingVertical: 13,
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    ...Shadow.md,
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Register Your Shop</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {analytics && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.lg }}>
                    <StatCard label="Total Orders" value={String(analytics.total_orders || 0)} icon="📦" />
                    <StatCard label="Revenue" value={`₹${analytics.total_revenue?.toFixed(0) || 0}`} icon="💰" />
                    <StatCard label="Products" value={String(analytics.total_products || 0)} icon="🛒" />
                    <StatCard label="Low Stock" value={String(analytics.low_stock_count || 0)} icon="⚠️" />
                  </View>
                )}
                {shops.length > 1 && (
                  <View style={{ marginBottom: Spacing.lg }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 8 }}>
                      YOUR SHOPS
                    </Text>
                    {shops.map(s => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => { setSelectedShop(s); populateSettingsForm(s); }}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 12,
                          padding: 14, borderRadius: BorderRadius.lg, marginBottom: 6,
                          backgroundColor: selectedShop?.id === s.id ? Colors.primaryBg : Colors.white,
                          borderWidth: 1.5,
                          borderColor: selectedShop?.id === s.id ? Colors.primary : Colors.border,
                          ...Shadow.sm,
                        }}
                      >
                        <View style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: selectedShop?.id === s.id ? Colors.primary : Colors.backgroundAlt,
                          justifyContent: 'center', alignItems: 'center',
                        }}>
                          <Ionicons name="storefront-outline" size={16} color={selectedShop?.id === s.id ? '#fff' : Colors.textMuted} />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '700', flex: 1, color: Colors.textPrimary }}>{s.name}</Text>
                        <View style={{
                          paddingHorizontal: 7, paddingVertical: 3,
                          borderRadius: BorderRadius.full,
                          backgroundColor: s.status === 'approved' ? Colors.successBg : Colors.warningBg,
                        }}>
                          <Text style={{
                            fontSize: 9, fontWeight: '800', textTransform: 'uppercase',
                            color: s.status === 'approved' ? Colors.success : Colors.warningDark,
                          }}>{s.status}</Text>
                        </View>
                        {selectedShop?.id === s.id && (
                          <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => setShowShopModal(true)}
                  style={{
                    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                    padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border,
                    borderStyle: 'dashed',
                    flexDirection: 'row', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Ionicons name="add" size={16} color={Colors.primary} />
                  <Text style={{ color: Colors.primary, fontWeight: '700' }}>Register Another Shop</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ─── Inventory Tab ─── */}
        {activeTab === 'Inventory' && selectedShop && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>
                Products <Text style={{ color: Colors.textMuted, fontWeight: '500' }}>({products.length})</Text>
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setEditingProduct(null);
                  setProdImageUri(null);
                  setProdForm({ name: '', price: '', mrp: '', unit: 'kg', category: 'Grocery', stock: '', description: '', low_stock_threshold: '' });
                  setShowProductModal(true);
                }}
                style={{
                  backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
                  paddingHorizontal: 14, paddingVertical: 8,
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                }}
              >
                <Ionicons name="add" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Add Product</Text>
              </TouchableOpacity>
            </View>
            {prodLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
            ) : products.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="cube-outline" size={48} color={Colors.border} />
                <Text style={{ fontSize: 14, color: Colors.textMuted, marginTop: 12 }}>No products yet</Text>
              </View>
            ) : (
              products.map(p => {
                const isLowStock = p.stock != null && p.low_stock_threshold != null && p.stock <= p.low_stock_threshold;
                const isOutOfStock = p.stock === 0;
                return (
                  <View key={p.id} style={{
                    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                    marginBottom: Spacing.sm, flexDirection: 'row', overflow: 'hidden',
                    ...Shadow.sm,
                  }}>
                    {/* Colored left stripe for low stock */}
                    {(isLowStock || isOutOfStock) && (
                      <View style={{ width: 3, backgroundColor: isOutOfStock ? Colors.danger : Colors.warning }} />
                    )}
                    <View style={{
                      width: 64, height: 64, margin: Spacing.md,
                      borderRadius: BorderRadius.md, backgroundColor: Colors.backgroundAlt,
                      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
                    }}>
                      {p.image ? (
                        <Image source={{ uri: fixImageUrl(p.image) }} style={{ width: 64, height: 64 }} resizeMode="cover" />
                      ) : (
                        <Ionicons name="cube-outline" size={24} color={Colors.textMuted} />
                      )}
                    </View>
                    <View style={{ flex: 1, paddingVertical: Spacing.md, paddingRight: Spacing.md, justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }} numberOfLines={1}>{p.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.primary }}>₹{p.price}</Text>
                          {p.mrp && p.mrp > p.price && (
                            <Text style={{ fontSize: 11, color: Colors.textMuted, textDecorationLine: 'line-through' }}>₹{p.mrp}</Text>
                          )}
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons
                            name={isOutOfStock ? 'close-circle' : isLowStock ? 'alert-circle' : 'checkmark-circle'}
                            size={12}
                            color={isOutOfStock ? Colors.danger : isLowStock ? Colors.warning : Colors.success}
                          />
                          <Text style={{ fontSize: 11, color: isOutOfStock ? Colors.danger : isLowStock ? Colors.warning : Colors.textMuted }}>
                            {isOutOfStock ? 'Out of stock' : isLowStock ? `Low: ${p.stock} left` : `Stock: ${p.stock ?? '—'}`}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity
                            onPress={() => {
                              setEditingProduct(p); setProdImageUri(null);
                              setProdForm({
                                name: p.name, price: String(p.price), mrp: p.mrp ? String(p.mrp) : '',
                                unit: p.unit || 'kg', category: p.category || 'Grocery',
                                stock: p.stock != null ? String(p.stock) : '',
                                description: p.description || '',
                                low_stock_threshold: p.low_stock_threshold != null ? String(p.low_stock_threshold) : '',
                              });
                              setShowProductModal(true);
                            }}
                            style={{ padding: 4 }}
                          >
                            <Ionicons name="create-outline" size={17} color={Colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteProduct(p)} style={{ padding: 4 }}>
                            <Ionicons name="trash-outline" size={17} color={Colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ─── Orders Tab ─── */}
        {activeTab === 'Orders' && selectedShop && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }} contentContainerStyle={{ gap: 6 }}>
              {[
                { key: 'all', label: 'All', icon: 'list-outline' },
                { key: 'pending', label: 'Pending', icon: 'time-outline' },
                { key: 'accepted', label: 'Accepted', icon: 'checkmark-outline' },
                { key: 'ready', label: 'Ready', icon: 'bag-check-outline' },
                { key: 'out_for_delivery', label: 'On Way', icon: 'bicycle-outline' },
                { key: 'delivered', label: 'Done', icon: 'checkmark-done-outline' },
                { key: 'rejected', label: 'Rejected', icon: 'close-outline' },
              ].map(f => (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setOrderFilter(f.key)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.full,
                    borderWidth: 1.5,
                    borderColor: orderFilter === f.key ? Colors.primary : Colors.border,
                    backgroundColor: orderFilter === f.key ? Colors.primaryBg : 'transparent',
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                  }}
                >
                  <Ionicons name={f.icon} size={12} color={orderFilter === f.key ? Colors.primary : Colors.textMuted} />
                  <Text style={{
                    fontSize: 12, fontWeight: '600',
                    color: orderFilter === f.key ? Colors.primary : Colors.textMuted,
                  }}>
                    {f.label}
                    {f.key !== 'all' && orders.filter(o => o.status === f.key).length > 0
                      ? ` (${orders.filter(o => o.status === f.key).length})`
                      : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {ordersLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
            ) : filteredOrders.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="receipt-outline" size={48} color={Colors.border} />
                <Text style={{ fontSize: 14, color: Colors.textMuted, marginTop: 12 }}>No orders</Text>
              </View>
            ) : (
              filteredOrders.map(order => (
                <View key={order.id} style={{
                  backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                  marginBottom: Spacing.sm, overflow: 'hidden', ...Shadow.sm,
                }}>
                  {/* Status stripe */}
                  <View style={{
                    height: 3,
                    backgroundColor: order.status === 'pending' ? Colors.warning
                      : order.status === 'delivered' ? Colors.success
                      : order.status === 'rejected' ? Colors.danger
                      : Colors.info,
                  }} />
                  <View style={{ padding: Spacing.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.textPrimary }}>
                            Order #{order.id}
                          </Text>
                          {order.order_type === 'walkin' && (
                            <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: Colors.purpleBg, borderRadius: BorderRadius.xs }}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.purple }}>WALK-IN</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                          <Ionicons name="person-outline" size={11} color={Colors.textMuted} />
                          <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                            {order.customer_name || 'Customer'} · {(order.items || []).length} items
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: Colors.primary }}>
                        ₹{order.total?.toFixed(2)}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
                        <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                          {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons
                          name={order.payment_method === 'cash' ? 'cash-outline' : order.payment_method === 'upi' ? 'phone-portrait-outline' : 'card-outline'}
                          size={11} color={Colors.textMuted}
                        />
                        <Text style={{ fontSize: 11, color: Colors.textMuted, textTransform: 'capitalize' }}>
                          {order.payment_method || 'cash'}
                        </Text>
                      </View>
                      <View style={{
                        paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.xs,
                        backgroundColor: order.payment_status === 'paid' ? Colors.successBg : Colors.warningBg,
                      }}>
                        <Text style={{
                          fontSize: 9, fontWeight: '700',
                          color: order.payment_status === 'paid' ? Colors.success : Colors.warningDark,
                          textTransform: 'uppercase',
                        }}>
                          {order.payment_status || 'unpaid'}
                        </Text>
                      </View>
                    </View>

                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: Spacing.sm }}>
                      {order.status === 'pending' && (
                        <>
                          <TouchableOpacity
                            onPress={() => handleOrderStatus(order.id, 'accepted')}
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 4,
                              backgroundColor: Colors.successBg, borderRadius: BorderRadius.sm,
                              paddingHorizontal: 10, paddingVertical: 7,
                            }}
                          >
                            <Ionicons name="checkmark" size={13} color={Colors.success} />
                            <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '700' }}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleOrderStatus(order.id, 'rejected')}
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 4,
                              backgroundColor: Colors.dangerBg, borderRadius: BorderRadius.sm,
                              paddingHorizontal: 10, paddingVertical: 7,
                            }}
                          >
                            <Ionicons name="close" size={13} color={Colors.danger} />
                            <Text style={{ color: Colors.danger, fontSize: 12, fontWeight: '700' }}>Reject</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {order.status === 'accepted' && (
                        <TouchableOpacity
                          onPress={() => handleOrderStatus(order.id, 'ready')}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            backgroundColor: Colors.infoBg, borderRadius: BorderRadius.sm,
                            paddingHorizontal: 10, paddingVertical: 7,
                          }}
                        >
                          <Ionicons name="bag-check-outline" size={13} color={Colors.info} />
                          <Text style={{ color: Colors.info, fontSize: 12, fontWeight: '700' }}>Mark Ready</Text>
                        </TouchableOpacity>
                      )}
                      {order.status === 'ready' && (
                        <TouchableOpacity
                          onPress={() => handleOrderStatus(order.id, 'out_for_delivery')}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            backgroundColor: Colors.infoBg, borderRadius: BorderRadius.sm,
                            paddingHorizontal: 10, paddingVertical: 7,
                          }}
                        >
                          <Ionicons name="bicycle-outline" size={13} color={Colors.info} />
                          <Text style={{ color: Colors.info, fontSize: 12, fontWeight: '700' }}>Out for Delivery</Text>
                        </TouchableOpacity>
                      )}
                      {order.status === 'out_for_delivery' && (
                        <TouchableOpacity
                          onPress={() => handleOrderStatus(order.id, 'delivered')}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            backgroundColor: Colors.successBg, borderRadius: BorderRadius.sm,
                            paddingHorizontal: 10, paddingVertical: 7,
                          }}
                        >
                          <Ionicons name="checkmark-done" size={13} color={Colors.success} />
                          <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '700' }}>Mark Delivered</Text>
                        </TouchableOpacity>
                      )}
                      {order.payment_status !== 'paid' && order.status !== 'rejected' && (
                        <TouchableOpacity
                          onPress={() => handleMarkPaymentStatus(order.id, 'paid')}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            backgroundColor: Colors.successBg, borderRadius: BorderRadius.sm,
                            paddingHorizontal: 10, paddingVertical: 7,
                          }}
                        >
                          <Ionicons name="cash-outline" size={13} color={Colors.success} />
                          <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '700' }}>Mark Paid</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ─── Billing Tab (Walk-in) ─── */}
        {activeTab === 'Billing' && selectedShop && (
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: Spacing.md }}>Walk-in / Counter Sale</Text>

            {/* Product picker rows */}
            {walkinItems.map((item, idx) => (
              <View key={idx} style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[inputStyle, { marginBottom: 4 }]}
                    placeholder="Product ID"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="numeric"
                    value={item.product_id}
                    onChangeText={v => {
                      const rows = [...walkinItems];
                      rows[idx] = { ...rows[idx], product_id: v };
                      const p = products.find(pr => String(pr.id) === v);
                      if (p) rows[idx] = { ...rows[idx], name: p.name, price: String(p.price) };
                      setWalkinItems(rows);
                    }}
                  />
                  {item.name ? <Text style={{ fontSize: 11, color: Colors.textSecondary, marginLeft: 4, marginTop: -2 }}>{item.name} — {'\u20B9'}{item.price}</Text> : null}
                </View>
                <TextInput
                  style={[inputStyle, { width: 60, marginBottom: 0, textAlign: 'center' }]}
                  placeholder="Qty"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="numeric"
                  value={item.quantity}
                  onChangeText={v => { const rows = [...walkinItems]; rows[idx].quantity = v; setWalkinItems(rows); }}
                />
                <TouchableOpacity onPress={() => setWalkinItems(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={() => setWalkinItems(prev => [...prev, { product_id: '', quantity: '1', name: '', price: '' }])}
              style={{
                borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
                borderRadius: BorderRadius.md, padding: 10, alignItems: 'center', marginBottom: Spacing.md,
                flexDirection: 'row', justifyContent: 'center', gap: 6,
              }}
            >
              <Ionicons name="add" size={16} color={Colors.primary} />
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>Add Item</Text>
            </TouchableOpacity>

            {/* Payment method */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, marginBottom: 8 }}>PAYMENT METHOD</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.md }}>
              {['cash', 'upi', 'card'].map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setWalkinPayMethod(m)}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1.5, alignItems: 'center',
                    borderColor: walkinPayMethod === m ? Colors.primary : Colors.border,
                    backgroundColor: walkinPayMethod === m ? Colors.primary + '10' : Colors.white,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'capitalize', color: walkinPayMethod === m ? Colors.primary : Colors.textMuted }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleWalkinOrder}
              disabled={walkinLoading}
              style={{
                backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
                paddingVertical: 14, alignItems: 'center', opacity: walkinLoading ? 0.6 : 1,
                flexDirection: 'row', justifyContent: 'center', gap: 8,
              }}
            >
              {walkinLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="receipt-outline" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Record Sale</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Quick product reference */}
            {products.length > 0 && (
              <View style={{ marginTop: Spacing.lg }}>
                <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 8, color: Colors.textSecondary }}>Products (tap ID to copy)</Text>
                {products.slice(0, 10).map(p => (
                  <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                    <Text style={{ fontSize: 13, color: Colors.textPrimary }}>#{p.id} {p.name}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.primary }}>{'\u20B9'}{p.price}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Suppliers section */}
            <View style={{ marginTop: Spacing.xl }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary }}>
                  Suppliers <Text style={{ color: Colors.textMuted, fontWeight: '500' }}>({suppliers.length})</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => { setEditingSupplier(null); setSupplierForm({ name: '', contact_name: '', phone: '', email: '' }); setShowSupplierModal(true); }}
                  style={{
                    backgroundColor: Colors.primary, borderRadius: BorderRadius.sm,
                    paddingHorizontal: 10, paddingVertical: 6,
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                  }}
                >
                  <Ionicons name="add" size={13} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Add Supplier</Text>
                </TouchableOpacity>
              </View>
              {suppliers.map(s => (
                <View key={s.id} style={{
                  backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                  padding: Spacing.md, marginBottom: 8,
                  flexDirection: 'row', alignItems: 'center', gap: 12, ...Shadow.sm,
                }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: Colors.infoBg, justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Ionicons name="person-outline" size={16} color={Colors.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textPrimary }}>{s.name}</Text>
                    {s.contact_name && <Text style={{ fontSize: 11, color: Colors.textMuted }}>{s.contact_name}</Text>}
                    {s.phone && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="call-outline" size={10} color={Colors.textMuted} />
                        <Text style={{ fontSize: 11, color: Colors.textMuted }}>{s.phone}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => { setEditingSupplier(s); setSupplierForm({ name: s.name, contact_name: s.contact_name || '', phone: s.phone || '', email: s.email || '' }); setShowSupplierModal(true); }}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="create-outline" size={17} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteSupplier(s)} style={{ padding: 6 }}>
                    <Ionicons name="trash-outline" size={17} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Discounts section */}
            <View style={{ marginTop: Spacing.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md }}>
                <Ionicons name="pricetag-outline" size={16} color={Colors.primary} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary }}>Discounts</Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textSecondary }}>Product Discounts</Text>
                <TouchableOpacity
                  onPress={() => setShowProductDiscountModal(true)}
                  style={{
                    backgroundColor: Colors.primary, borderRadius: BorderRadius.sm,
                    paddingHorizontal: 10, paddingVertical: 5,
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                  }}
                >
                  <Ionicons name="add" size={12} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Add</Text>
                </TouchableOpacity>
              </View>
              {productDiscounts.map(d => (
                <View key={d.id} style={{
                  backgroundColor: Colors.white, borderRadius: BorderRadius.md,
                  padding: 10, marginBottom: 6, flexDirection: 'row', alignItems: 'center',
                  gap: 10, ...Shadow.sm,
                }}>
                  <View style={{
                    backgroundColor: Colors.warningBg, borderRadius: BorderRadius.xs,
                    paddingHorizontal: 8, paddingVertical: 4,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.warningDark }}>
                      {d.discount_percent}% OFF
                    </Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 12, color: Colors.textSecondary }}>
                    Product #{d.product_id} · min qty: {d.min_quantity || 1}
                  </Text>
                  <TouchableOpacity onPress={async () => { await deleteProductDiscount(selectedShop.id, d.id); loadDiscounts(); }} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: Spacing.md }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textSecondary }}>Order Discounts</Text>
                <TouchableOpacity
                  onPress={() => setShowOrderDiscountModal(true)}
                  style={{
                    backgroundColor: Colors.primary, borderRadius: BorderRadius.sm,
                    paddingHorizontal: 10, paddingVertical: 5,
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                  }}
                >
                  <Ionicons name="add" size={12} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Add</Text>
                </TouchableOpacity>
              </View>
              {orderDiscounts.map(d => (
                <View key={d.id} style={{
                  backgroundColor: Colors.white, borderRadius: BorderRadius.md,
                  padding: 10, marginBottom: 6, flexDirection: 'row', alignItems: 'center',
                  gap: 10, ...Shadow.sm,
                }}>
                  <View style={{
                    backgroundColor: Colors.successBg, borderRadius: BorderRadius.xs,
                    paddingHorizontal: 8, paddingVertical: 4,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.successDark }}>
                      {d.discount_percent ? `${d.discount_percent}%` : `₹${d.discount_amount}`} OFF
                    </Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 12, color: Colors.textSecondary }}>
                    Orders over ₹{d.min_order_amount}
                  </Text>
                  <TouchableOpacity onPress={async () => { await deleteOrderDiscount(selectedShop.id, d.id); loadDiscounts(); }} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ─── Reports Tab ─── */}
        {activeTab === 'Reports' && selectedShop && (
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: Spacing.md }}>Sales Reports</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <TextInput
                style={[inputStyle, { flex: 1, marginBottom: 0 }]}
                placeholder="From (YYYY-MM-DD)"
                placeholderTextColor={Colors.textLight}
                value={reportFrom}
                onChangeText={setReportFrom}
              />
              <TextInput
                style={[inputStyle, { flex: 1, marginBottom: 0 }]}
                placeholder="To (YYYY-MM-DD)"
                placeholderTextColor={Colors.textLight}
                value={reportTo}
                onChangeText={setReportTo}
              />
            </View>
            <TouchableOpacity
              onPress={loadReports}
              disabled={reportsLoading}
              style={{
                backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
                paddingVertical: 13, alignItems: 'center', marginBottom: Spacing.lg,
                opacity: reportsLoading ? 0.6 : 1,
                flexDirection: 'row', justifyContent: 'center', gap: 7,
              }}
            >
              {reportsLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="bar-chart-outline" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Load Report</Text>
                </>
              )}
            </TouchableOpacity>

            {reports && (
              <View style={{ gap: 10, flexDirection: 'row', flexWrap: 'wrap' }}>
                <StatCard label="Total Orders" value={String(reports.total_orders || 0)} icon="📦" />
                <StatCard label="Total Revenue" value={`₹${(reports.total_revenue || 0).toFixed(0)}`} icon="💰" />
                <StatCard label="Avg Order Value" value={`₹${(reports.avg_order_value || 0).toFixed(0)}`} icon="📈" />
                {reports.top_products && reports.top_products.length > 0 && (
                  <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: Spacing.sm }}>Top Products</Text>
                    {reports.top_products.map((p, i) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                        <Text style={{ fontSize: 13, flex: 1 }}>{p.name}</Text>
                        <Text style={{ fontSize: 13, color: Colors.textMuted }}>{p.quantity_sold} sold</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ─── Settings Tab ─── */}
        {activeTab === 'Settings' && selectedShop && (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md }}>
              <Ionicons name="settings-outline" size={18} color={Colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>Shop Settings</Text>
            </View>
            <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg }}>
              <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 10 }}>Basic Info</Text>
              <TextInput style={inputStyle} placeholder="Shop Name" placeholderTextColor={Colors.textLight} value={shopSettingsForm.name} onChangeText={v => setShopSettingsForm(f => ({ ...f, name: v }))} />
              <TextInput style={inputStyle} placeholder="Address" placeholderTextColor={Colors.textLight} value={shopSettingsForm.address} onChangeText={v => setShopSettingsForm(f => ({ ...f, address: v }))} />
              <TextInput style={inputStyle} placeholder="Location Name" placeholderTextColor={Colors.textLight} value={shopSettingsForm.location_name} onChangeText={v => setShopSettingsForm(f => ({ ...f, location_name: v }))} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Pincode" placeholderTextColor={Colors.textLight} keyboardType="numeric" value={shopSettingsForm.pincode} onChangeText={v => setShopSettingsForm(f => ({ ...f, pincode: v }))} />
                <TextInput style={[inputStyle, { flex: 1 }]} placeholder="City" placeholderTextColor={Colors.textLight} value={shopSettingsForm.city} onChangeText={v => setShopSettingsForm(f => ({ ...f, city: v }))} />
              </View>
              <TextInput style={inputStyle} placeholder="Delivery Radius (km)" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" value={shopSettingsForm.delivery_radius} onChangeText={v => setShopSettingsForm(f => ({ ...f, delivery_radius: v }))} />
            </View>
            <View style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg }}>
              <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 4 }}>UPI Payment</Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 10 }}>Customers can pay you directly via UPI scan</Text>
              <TextInput
                style={inputStyle}
                placeholder="UPI ID (e.g. shopname@upi)"
                placeholderTextColor={Colors.textLight}
                value={shopSettingsForm.upi_id}
                onChangeText={v => setShopSettingsForm(f => ({ ...f, upi_id: v }))}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            <TouchableOpacity
              onPress={handleSaveSettings}
              disabled={shopSettingsSaving}
              style={{
                backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
                paddingVertical: 14, alignItems: 'center', opacity: shopSettingsSaving ? 0.6 : 1,
                flexDirection: 'row', justifyContent: 'center', gap: 8, ...Shadow.md,
              }}
            >
              {shopSettingsSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Save Settings</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Analytics Tab (if no shop, show nothing) ─── */}
        {/* Removed Analytics as separate tab; data shown in Overview */}
      </ScrollView>

      {/* ─── Shop Registration Modal ─── */}
      <Modal visible={showShopModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, padding: Spacing.xxl, maxHeight: '85%' }}>
            <ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.textPrimary }}>Register Shop</Text>
                <TouchableOpacity onPress={() => setShowShopModal(false)}>
                  <Ionicons name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <TextInput style={inputStyle} placeholder="Shop Name *" placeholderTextColor={Colors.textLight} value={shopForm.name} onChangeText={v => setShopForm(f => ({ ...f, name: v }))} />
              <TextInput style={inputStyle} placeholder="Address" placeholderTextColor={Colors.textLight} value={shopForm.address} onChangeText={v => setShopForm(f => ({ ...f, address: v }))} />
              <TextInput style={inputStyle} placeholder="Location Name" placeholderTextColor={Colors.textLight} value={shopForm.location_name} onChangeText={v => setShopForm(f => ({ ...f, location_name: v }))} />
              <TextInput style={inputStyle} placeholder="Pincode" placeholderTextColor={Colors.textLight} keyboardType="numeric" value={shopForm.pincode} onChangeText={v => setShopForm(f => ({ ...f, pincode: v }))} />
              <TextInput style={inputStyle} placeholder="City" placeholderTextColor={Colors.textLight} value={shopForm.city} onChangeText={v => setShopForm(f => ({ ...f, city: v }))} />
              <TextInput style={inputStyle} placeholder="UPI ID (e.g. shopname@upi)" placeholderTextColor={Colors.textLight} value={shopForm.upi_id} onChangeText={v => setShopForm(f => ({ ...f, upi_id: v }))} autoCapitalize="none" />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity onPress={() => setShowShopModal(false)} style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ fontWeight: '600', color: Colors.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCreateShop} disabled={shopSaving} style={{ flex: 1, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center', opacity: shopSaving ? 0.6 : 1 }}>
                  {shopSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontWeight: '600', color: '#fff' }}>Submit</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Product Modal ─── */}
      <Modal visible={showProductModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, padding: Spacing.xxl, maxHeight: '90%' }}>
            <ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.textPrimary }}>
                  {editingProduct ? 'Edit Product' : 'Add Product'}
                </Text>
                <TouchableOpacity onPress={() => { setShowProductModal(false); setAiSuggestions([]); setProdImageUri(null); }}>
                  <Ionicons name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <TextInput style={inputStyle} placeholder="Product Name *" placeholderTextColor={Colors.textLight} value={prodForm.name} onChangeText={v => setProdForm(f => ({ ...f, name: v }))} />
              {aiAvailable && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  <TouchableOpacity onPress={handleAISuggest} style={{ backgroundColor: Colors.infoBg, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: Colors.info, fontSize: 11, fontWeight: '600' }}>AI Suggest Names</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleAIDescription} style={{ backgroundColor: Colors.infoBg, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: Colors.info, fontSize: 11, fontWeight: '600' }}>AI Description</Text>
                  </TouchableOpacity>
                </View>
              )}
              {aiSuggestions.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {aiSuggestions.map((s, i) => (
                    <TouchableOpacity key={i} onPress={() => { setProdForm(f => ({ ...f, name: s })); setAiSuggestions([]); }}
                      style={{ backgroundColor: Colors.background, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 12, color: Colors.primary }}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Price *" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" value={prodForm.price} onChangeText={v => setProdForm(f => ({ ...f, price: v }))} />
                <TextInput style={[inputStyle, { flex: 1 }]} placeholder="MRP" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" value={prodForm.mrp} onChangeText={v => setProdForm(f => ({ ...f, mrp: v }))} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Unit (kg, L...)" placeholderTextColor={Colors.textLight} value={prodForm.unit} onChangeText={v => setProdForm(f => ({ ...f, unit: v }))} />
                <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Stock" placeholderTextColor={Colors.textLight} keyboardType="numeric" value={prodForm.stock} onChangeText={v => setProdForm(f => ({ ...f, stock: v }))} />
              </View>
              <TextInput style={inputStyle} placeholder="Low Stock Alert (qty)" placeholderTextColor={Colors.textLight} keyboardType="numeric" value={prodForm.low_stock_threshold} onChangeText={v => setProdForm(f => ({ ...f, low_stock_threshold: v }))} />
              <TextInput style={[inputStyle, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="Description" placeholderTextColor={Colors.textLight} multiline value={prodForm.description} onChangeText={v => setProdForm(f => ({ ...f, description: v }))} />

              {/* Image upload */}
              <TouchableOpacity
                onPress={handlePickProductImage}
                style={{ backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: 12, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' }}
              >
                {prodImageUri ? (
                  <Image source={{ uri: prodImageUri }} style={{ width: 80, height: 80, borderRadius: BorderRadius.md }} resizeMode="cover" />
                ) : editingProduct?.image ? (
                  <View style={{ alignItems: 'center' }}>
                    <Image source={{ uri: fixImageUrl(editingProduct.image) }} style={{ width: 80, height: 80, borderRadius: BorderRadius.md }} resizeMode="cover" />
                    <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4 }}>Tap to change image</Text>
                  </View>
                ) : (
                  <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 13 }}>Upload Product Image</Text>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity onPress={() => { setShowProductModal(false); setAiSuggestions([]); setProdImageUri(null); }} style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ fontWeight: '600', color: Colors.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveProduct} disabled={prodSaving} style={{ flex: 1, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center', opacity: prodSaving ? 0.6 : 1 }}>
                  {prodSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontWeight: '600', color: '#fff' }}>{editingProduct ? 'Update' : 'Add'}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Supplier Modal ─── */}
      <Modal visible={showSupplierModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, padding: Spacing.xxl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.textPrimary }}>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</Text>
              <TouchableOpacity onPress={() => setShowSupplierModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <TextInput style={inputStyle} placeholder="Supplier Name *" placeholderTextColor={Colors.textLight} value={supplierForm.name} onChangeText={v => setSupplierForm(f => ({ ...f, name: v }))} />
            <TextInput style={inputStyle} placeholder="Contact Person" placeholderTextColor={Colors.textLight} value={supplierForm.contact_name} onChangeText={v => setSupplierForm(f => ({ ...f, contact_name: v }))} />
            <TextInput style={inputStyle} placeholder="Phone" placeholderTextColor={Colors.textLight} keyboardType="phone-pad" value={supplierForm.phone} onChangeText={v => setSupplierForm(f => ({ ...f, phone: v }))} />
            <TextInput style={inputStyle} placeholder="Email" placeholderTextColor={Colors.textLight} keyboardType="email-address" autoCapitalize="none" value={supplierForm.email} onChangeText={v => setSupplierForm(f => ({ ...f, email: v }))} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity onPress={() => setShowSupplierModal(false)} style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontWeight: '600', color: Colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveSupplier} style={{ flex: 1, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontWeight: '600', color: '#fff' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Product Discount Modal ─── */}
      <Modal visible={showProductDiscountModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, padding: Spacing.xxl }}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: Spacing.lg }}>Product Discount</Text>
            <TextInput style={inputStyle} placeholder="Product ID *" placeholderTextColor={Colors.textLight} keyboardType="numeric" value={prodDiscountForm.product_id} onChangeText={v => setProdDiscountForm(f => ({ ...f, product_id: v }))} />
            <TextInput style={inputStyle} placeholder="Discount % *" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" value={prodDiscountForm.discount_percent} onChangeText={v => setProdDiscountForm(f => ({ ...f, discount_percent: v }))} />
            <TextInput style={inputStyle} placeholder="Min Quantity (default 1)" placeholderTextColor={Colors.textLight} keyboardType="numeric" value={prodDiscountForm.min_quantity} onChangeText={v => setProdDiscountForm(f => ({ ...f, min_quantity: v }))} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity onPress={() => setShowProductDiscountModal(false)} style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontWeight: '600', color: Colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateProductDiscount} style={{ flex: 1, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontWeight: '600', color: '#fff' }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Order Discount Modal ─── */}
      <Modal visible={showOrderDiscountModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, padding: Spacing.xxl }}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: Spacing.lg }}>Order Discount</Text>
            <TextInput style={inputStyle} placeholder="Min Order Amount *" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" value={orderDiscountForm.min_order_amount} onChangeText={v => setOrderDiscountForm(f => ({ ...f, min_order_amount: v }))} />
            <TextInput style={inputStyle} placeholder="Discount % (or leave blank)" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" value={orderDiscountForm.discount_percent} onChangeText={v => setOrderDiscountForm(f => ({ ...f, discount_percent: v }))} />
            <TextInput style={inputStyle} placeholder="Flat Discount Amount (₹)" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" value={orderDiscountForm.discount_amount} onChangeText={v => setOrderDiscountForm(f => ({ ...f, discount_amount: v }))} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity onPress={() => setShowOrderDiscountModal(false)} style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontWeight: '600', color: Colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateOrderDiscount} style={{ flex: 1, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontWeight: '600', color: '#fff' }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
