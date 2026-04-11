import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { Colors, BorderRadius, Spacing } from '../../constants/theme';
import { API_URL, CATEGORIES } from '../../constants/config';

const fixImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
};

const TABS = ['Overview', 'Inventory', 'Orders', 'Billing', 'Reports', 'Settings'];

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
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
          {t('navigation.owner')}
        </Text>
        {selectedShop && (
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
            {selectedShop.name} {'\u2022'} {selectedShop.status}
          </Text>
        )}
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={{ backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border }}
        contentContainerStyle={{ paddingHorizontal: Spacing.md }}
      >
        {TABS.map(tb => (
          <TouchableOpacity
            key={tb}
            onPress={() => setActiveTab(tb)}
            style={{
              paddingVertical: 12, paddingHorizontal: 16,
              borderBottomWidth: activeTab === tb ? 2 : 0,
              borderBottomColor: Colors.primary,
            }}
          >
            <Text style={{
              fontSize: 13, fontWeight: '600',
              color: activeTab === tb ? Colors.primary : Colors.textMuted,
            }}>
              {tb}
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
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>{'\uD83C\uDFEA'}</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>No shop registered yet</Text>
                <TouchableOpacity
                  onPress={() => setShowShopModal(true)}
                  style={{ backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingHorizontal: 24, paddingVertical: 12 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Register Your Shop</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {analytics && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.lg }}>
                    <StatCard label="Total Orders" value={analytics.total_orders || 0} icon="\uD83D\uDCE6" />
                    <StatCard label="Revenue" value={`\u20B9${analytics.total_revenue?.toFixed(0) || 0}`} icon="\uD83D\uDCB0" />
                    <StatCard label="Products" value={analytics.total_products || 0} icon="\uD83D\uDCE6" />
                    <StatCard label="Low Stock" value={analytics.low_stock_count || 0} icon="\u26A0\uFE0F" />
                  </View>
                )}
                {shops.length > 1 && (
                  <View style={{ marginBottom: Spacing.lg }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Your Shops</Text>
                    {shops.map(s => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => { setSelectedShop(s); populateSettingsForm(s); }}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 10,
                          padding: 12, borderRadius: BorderRadius.md, marginBottom: 6,
                          backgroundColor: selectedShop?.id === s.id ? 'rgba(90,90,64,0.08)' : Colors.white,
                          borderWidth: 1,
                          borderColor: selectedShop?.id === s.id ? Colors.primary : Colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '600', flex: 1 }}>{s.name}</Text>
                        <Text style={{ fontSize: 11, color: Colors.textMuted }}>{s.status}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => setShowShopModal(true)}
                  style={{
                    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
                    borderStyle: 'dashed',
                  }}
                >
                  <Text style={{ color: Colors.primary, fontWeight: '600' }}>+ Register Another Shop</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ─── Inventory Tab ─── */}
        {activeTab === 'Inventory' && selectedShop && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>Products ({products.length})</Text>
              <TouchableOpacity
                onPress={() => {
                  setEditingProduct(null);
                  setProdImageUri(null);
                  setProdForm({ name: '', price: '', mrp: '', unit: 'kg', category: 'Grocery', stock: '', description: '', low_stock_threshold: '' });
                  setShowProductModal(true);
                }}
                style={{ backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingHorizontal: 16, paddingVertical: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>+ Add Product</Text>
              </TouchableOpacity>
            </View>
            {prodLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
            ) : (
              products.map(p => (
                <View key={p.id} style={{
                  backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                  padding: Spacing.md, marginBottom: Spacing.sm,
                  flexDirection: 'row', gap: Spacing.md,
                }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: BorderRadius.md,
                    backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
                  }}>
                    {p.image ? (
                      <Image source={{ uri: fixImageUrl(p.image) }} style={{ width: 56, height: 56 }} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 22 }}>{'\uD83D\uDCE6'}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600' }}>{p.name}</Text>
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                      {'\u20B9'}{p.price} {'\u2022'} Stock: {p.stock ?? '-'}
                      {p.low_stock_threshold ? ` (alert: ${p.low_stock_threshold})` : ''}
                    </Text>
                    {p.stock != null && p.low_stock_threshold != null && p.stock <= p.low_stock_threshold && (
                      <Text style={{ fontSize: 11, color: Colors.danger }}>Low stock!</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => {
                      setEditingProduct(p);
                      setProdImageUri(null);
                      setProdForm({
                        name: p.name, price: String(p.price), mrp: p.mrp ? String(p.mrp) : '',
                        unit: p.unit || 'kg', category: p.category || 'Grocery',
                        stock: p.stock != null ? String(p.stock) : '',
                        description: p.description || '',
                        low_stock_threshold: p.low_stock_threshold != null ? String(p.low_stock_threshold) : '',
                      });
                      setShowProductModal(true);
                    }}>
                      <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteProduct(p)}>
                      <Text style={{ color: Colors.danger, fontSize: 12, fontWeight: '600' }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ─── Orders Tab ─── */}
        {activeTab === 'Orders' && selectedShop && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
              {['all', 'pending', 'accepted', 'ready', 'out_for_delivery', 'delivered', 'rejected'].map(f => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setOrderFilter(f)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 6, borderRadius: BorderRadius.full,
                    marginRight: 8, borderWidth: 1,
                    borderColor: orderFilter === f ? Colors.primary : Colors.border,
                    backgroundColor: orderFilter === f ? 'rgba(90,90,64,0.08)' : 'transparent',
                  }}
                >
                  <Text style={{
                    fontSize: 12, fontWeight: '600', textTransform: 'capitalize',
                    color: orderFilter === f ? Colors.primary : Colors.textSecondary,
                  }}>
                    {f === 'all' ? 'All' : f.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {ordersLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
            ) : filteredOrders.length === 0 ? (
              <Text style={{ textAlign: 'center', color: Colors.textMuted, marginTop: 30 }}>No orders</Text>
            ) : (
              filteredOrders.map(order => (
                <View key={order.id} style={{
                  backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
                  padding: Spacing.md, marginBottom: Spacing.sm,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700' }}>
                      #{order.id} {order.order_type === 'walkin' ? '(Walk-in)' : ''}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>
                      {'\u20B9'}{order.total?.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 4 }}>
                    {order.customer_name || 'Customer'} {'\u2022'} {(order.items || []).length} items
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                      {new Date(order.created_at).toLocaleDateString('en-IN')}
                    </Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                      Pay: {order.payment_method || 'cash'} {'\u2022'} {order.payment_status || 'pending'}
                    </Text>
                  </View>
                  {/* Status actions */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.sm }}>
                    {order.status === 'pending' && (
                      <>
                        <TouchableOpacity
                          onPress={() => handleOrderStatus(order.id, 'accepted')}
                          style={{ backgroundColor: Colors.successBg, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 6 }}
                        >
                          <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '600' }}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleOrderStatus(order.id, 'rejected')}
                          style={{ backgroundColor: Colors.dangerBg, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 6 }}
                        >
                          <Text style={{ color: Colors.danger, fontSize: 12, fontWeight: '600' }}>Reject</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {order.status === 'accepted' && (
                      <TouchableOpacity
                        onPress={() => handleOrderStatus(order.id, 'ready')}
                        style={{ backgroundColor: Colors.infoBg, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 6 }}
                      >
                        <Text style={{ color: Colors.info, fontSize: 12, fontWeight: '600' }}>Mark Ready</Text>
                      </TouchableOpacity>
                    )}
                    {order.status === 'ready' && (
                      <TouchableOpacity
                        onPress={() => handleOrderStatus(order.id, 'out_for_delivery')}
                        style={{ backgroundColor: Colors.infoBg, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 6 }}
                      >
                        <Text style={{ color: Colors.info, fontSize: 12, fontWeight: '600' }}>Out for Delivery</Text>
                      </TouchableOpacity>
                    )}
                    {order.status === 'out_for_delivery' && (
                      <TouchableOpacity
                        onPress={() => handleOrderStatus(order.id, 'delivered')}
                        style={{ backgroundColor: Colors.successBg, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 6 }}
                      >
                        <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '600' }}>Mark Delivered</Text>
                      </TouchableOpacity>
                    )}
                    {order.payment_status !== 'paid' && order.status !== 'rejected' && (
                      <TouchableOpacity
                        onPress={() => handleMarkPaymentStatus(order.id, 'paid')}
                        style={{ backgroundColor: Colors.successBg, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 6 }}
                      >
                        <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '600' }}>Mark Paid</Text>
                      </TouchableOpacity>
                    )}
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
                <TouchableOpacity onPress={() => setWalkinItems(prev => prev.filter((_, i) => i !== idx))}>
                  <Text style={{ color: Colors.danger, fontSize: 18, fontWeight: '700' }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={() => setWalkinItems(prev => [...prev, { product_id: '', quantity: '1', name: '', price: '' }])}
              style={{ borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: BorderRadius.md, padding: 10, alignItems: 'center', marginBottom: Spacing.md }}
            >
              <Text style={{ color: Colors.primary, fontWeight: '600' }}>+ Add Item</Text>
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
              style={{ backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: 'center', opacity: walkinLoading ? 0.6 : 1 }}
            >
              {walkinLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Record Sale</Text>}
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
                <Text style={{ fontSize: 16, fontWeight: '700' }}>Suppliers ({suppliers.length})</Text>
                <TouchableOpacity
                  onPress={() => { setEditingSupplier(null); setSupplierForm({ name: '', contact_name: '', phone: '', email: '' }); setShowSupplierModal(true); }}
                  style={{ backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {suppliers.map(s => (
                <View key={s.id} style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600' }}>{s.name}</Text>
                    {s.contact_name && <Text style={{ fontSize: 12, color: Colors.textMuted }}>{s.contact_name}</Text>}
                    {s.phone && <Text style={{ fontSize: 12, color: Colors.textMuted }}>{s.phone}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => { setEditingSupplier(s); setSupplierForm({ name: s.name, contact_name: s.contact_name || '', phone: s.phone || '', email: s.email || '' }); setShowSupplierModal(true); }} style={{ marginRight: 10 }}>
                    <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '600' }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteSupplier(s)}>
                    <Text style={{ color: Colors.danger, fontSize: 12, fontWeight: '600' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Discounts section */}
            <View style={{ marginTop: Spacing.xl }}>
              <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: Spacing.md }}>Discounts</Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textSecondary }}>Product Discounts</Text>
                <TouchableOpacity onPress={() => setShowProductDiscountModal(true)} style={{ backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {productDiscounts.map(d => (
                <View key={d.id} style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: 10, marginBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, fontSize: 13, color: Colors.textPrimary }}>
                    Product #{d.product_id} — {d.discount_percent}% off (min qty: {d.min_quantity || 1})
                  </Text>
                  <TouchableOpacity onPress={async () => { await deleteProductDiscount(selectedShop.id, d.id); loadDiscounts(); }}>
                    <Text style={{ color: Colors.danger, fontSize: 12, fontWeight: '600' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: Spacing.md }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textSecondary }}>Order Discounts</Text>
                <TouchableOpacity onPress={() => setShowOrderDiscountModal(true)} style={{ backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {orderDiscounts.map(d => (
                <View key={d.id} style={{ backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: 10, marginBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, fontSize: 13, color: Colors.textPrimary }}>
                    Orders over {'\u20B9'}{d.min_order_amount} —{' '}
                    {d.discount_percent ? `${d.discount_percent}%` : `\u20B9${d.discount_amount}`} off
                  </Text>
                  <TouchableOpacity onPress={async () => { await deleteOrderDiscount(selectedShop.id, d.id); loadDiscounts(); }}>
                    <Text style={{ color: Colors.danger, fontSize: 12, fontWeight: '600' }}>Remove</Text>
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
              style={{ backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center', marginBottom: Spacing.lg, opacity: reportsLoading ? 0.6 : 1 }}
            >
              {reportsLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Load Report</Text>}
            </TouchableOpacity>

            {reports && (
              <View style={{ gap: 10 }}>
                <StatCard label="Total Orders" value={reports.total_orders || 0} icon="\uD83D\uDCE6" />
                <StatCard label="Total Revenue" value={`\u20B9${(reports.total_revenue || 0).toFixed(2)}`} icon="\uD83D\uDCB0" />
                <StatCard label="Avg Order Value" value={`\u20B9${(reports.avg_order_value || 0).toFixed(2)}`} icon="\uD83D\uDCC8" />
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
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: Spacing.md }}>Shop Settings</Text>
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
              style={{ backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: 'center', opacity: shopSettingsSaving ? 0.6 : 1 }}
            >
              {shopSettingsSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Save Settings</Text>}
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
              <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: Spacing.lg }}>Register Shop</Text>
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
              <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: Spacing.lg }}>
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </Text>
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
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: Spacing.lg }}>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</Text>
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
