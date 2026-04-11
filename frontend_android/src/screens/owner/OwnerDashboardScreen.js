import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
  Image, ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  getMyShops, createShop, listProducts, createProduct, updateProduct,
  deleteProduct, getShopOrders, updateOrderStatus, getShopAnalytics,
  uploadFile, suggestProducts, generateDescription,
} from '../../api/client';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../hooks/useTranslation';
import StatCard from '../../components/StatCard';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';
import { API_URL, CATEGORIES } from '../../constants/config';

const TABS = ['Overview', 'Inventory', 'Orders', 'Analytics'];

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
  const [prodForm, setProdForm] = useState({ name: '', price: '', mrp: '', unit: 'kg', category: 'Grocery', stock: '', description: '' });
  const [prodSaving, setProdSaving] = useState(false);

  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all');

  // Analytics state
  const [analytics, setAnalytics] = useState(null);

  // Shop registration
  const [showShopModal, setShowShopModal] = useState(false);
  const [shopForm, setShopForm] = useState({ name: '', category: 'Grocery', address: '', location_name: '', pincode: '', city: '', upi_id: '' });
  const [shopSaving, setShopSaving] = useState(false);

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState([]);

  const loadShops = useCallback(async () => {
    try {
      const res = await getMyShops();
      const list = res.data || [];
      setShops(list);
      if (list.length > 0 && !selectedShop) setSelectedShop(list[0]);
    } catch {} finally { setLoading(false); }
  }, [selectedShop]);

  useEffect(() => { loadShops(); }, []);

  useEffect(() => {
    if (selectedShop) {
      loadProducts();
      loadOrders();
      loadAnalytics();
    }
  }, [selectedShop]);

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
      setOrders(res.data?.orders || res.data || []);
    } catch {} finally { setOrdersLoading(false); }
  };

  const loadAnalytics = async () => {
    if (!selectedShop) return;
    try {
      const res = await getShopAnalytics(selectedShop.id);
      setAnalytics(res.data);
    } catch {}
  };

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

  const handleSaveProduct = async () => {
    if (!prodForm.name || !prodForm.price) { Alert.alert('Error', 'Name and price are required'); return; }
    setProdSaving(true);
    try {
      const data = {
        name: prodForm.name, price: parseFloat(prodForm.price),
        mrp: prodForm.mrp ? parseFloat(prodForm.mrp) : undefined,
        unit: prodForm.unit, category: prodForm.category,
        stock: prodForm.stock ? parseInt(prodForm.stock) : 0,
        description: prodForm.description || undefined,
      };
      if (editingProduct) {
        await updateProduct(selectedShop.id, editingProduct.id, data);
      } else {
        await createProduct(selectedShop.id, data);
      }
      setShowProductModal(false);
      setEditingProduct(null);
      setProdForm({ name: '', price: '', mrp: '', unit: 'kg', category: 'Grocery', stock: '', description: '' });
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
      if (res.data?.description) {
        setProdForm(f => ({ ...f, description: res.data.description }));
      }
    } catch {}
  };

  const handleOrderStatus = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, status);
      loadOrders();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update status');
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

      <ScrollView contentContainerStyle={{ padding: Spacing.lg }} refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => { loadProducts(); loadOrders(); loadAnalytics(); }} tintColor={Colors.primary} />
      }>
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
                    <StatCard label="Avg Order" value={`\u20B9${analytics.avg_order_value?.toFixed(0) || 0}`} icon="\uD83D\uDCC8" />
                  </View>
                )}
                {/* Shop selector if multiple */}
                {shops.length > 1 && (
                  <View style={{ marginBottom: Spacing.lg }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Your Shops</Text>
                    {shops.map(s => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setSelectedShop(s)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 10,
                          padding: 12, borderRadius: BorderRadius.md, marginBottom: 6,
                          backgroundColor: selectedShop?.id === s.id ? 'rgba(90,90,64,0.08)' : Colors.white,
                          borderWidth: 1,
                          borderColor: selectedShop?.id === s.id ? Colors.primary : Colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '600' }}>{s.name}</Text>
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
                  setProdForm({ name: '', price: '', mrp: '', unit: 'kg', category: 'Grocery', stock: '', description: '' });
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
                      <Image source={{ uri: `${API_URL}${p.image}` }} style={{ width: 56, height: 56 }} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 22 }}>{'\uD83D\uDCE6'}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600' }}>{p.name}</Text>
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                      {'\u20B9'}{p.price} {'\u2022'} Stock: {p.stock ?? '-'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => {
                      setEditingProduct(p);
                      setProdForm({
                        name: p.name, price: String(p.price), mrp: p.mrp ? String(p.mrp) : '',
                        unit: p.unit || 'kg', category: p.category || 'Grocery',
                        stock: p.stock != null ? String(p.stock) : '', description: p.description || '',
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
              {['all', 'pending', 'accepted', 'ready', 'delivered'].map(f => (
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
                    {f === 'all' ? 'All' : f}
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
                    <Text style={{ fontSize: 13, fontWeight: '700' }}>#{order.id}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary }}>
                      {'\u20B9'}{order.total?.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 4 }}>
                    {order.customer_name || 'Customer'} {'\u2022'} {(order.items || []).length} items
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>
                    {new Date(order.created_at).toLocaleDateString('en-IN')}
                  </Text>
                  {/* Status actions */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.sm }}>
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
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ─── Analytics Tab ─── */}
        {activeTab === 'Analytics' && (
          <View>
            {analytics ? (
              <View style={{ gap: 10 }}>
                <StatCard label="Total Orders" value={analytics.total_orders || 0} icon="\uD83D\uDCE6" />
                <StatCard label="Total Revenue" value={`\u20B9${analytics.total_revenue?.toFixed(2) || 0}`} icon="\uD83D\uDCB0" />
                <StatCard label="Avg Order Value" value={`\u20B9${analytics.avg_order_value?.toFixed(2) || 0}`} icon="\uD83D\uDCC8" />
                <StatCard label="Total Products" value={analytics.total_products || 0} icon="\uD83D\uDCE6" />
                <StatCard label="Active Products" value={analytics.active_products || 0} icon="\u2705" />
                <StatCard label="Low Stock" value={analytics.low_stock_count || 0} icon="\u26A0\uFE0F" />
              </View>
            ) : (
              <Text style={{ textAlign: 'center', color: Colors.textMuted, marginTop: 30 }}>
                No analytics data available
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* ─── Shop Registration Modal ─── */}
      <Modal visible={showShopModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, padding: Spacing.xxl, maxHeight: '80%' }}>
            <ScrollView>
              <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: Spacing.lg }}>Register Shop</Text>
              <TextInput style={inputStyle} placeholder="Shop Name *" placeholderTextColor={Colors.textLight} value={shopForm.name} onChangeText={v => setShopForm(f => ({ ...f, name: v }))} />
              <TextInput style={inputStyle} placeholder="Address" placeholderTextColor={Colors.textLight} value={shopForm.address} onChangeText={v => setShopForm(f => ({ ...f, address: v }))} />
              <TextInput style={inputStyle} placeholder="Location Name" placeholderTextColor={Colors.textLight} value={shopForm.location_name} onChangeText={v => setShopForm(f => ({ ...f, location_name: v }))} />
              <TextInput style={inputStyle} placeholder="Pincode" placeholderTextColor={Colors.textLight} keyboardType="numeric" value={shopForm.pincode} onChangeText={v => setShopForm(f => ({ ...f, pincode: v }))} />
              <TextInput style={inputStyle} placeholder="City" placeholderTextColor={Colors.textLight} value={shopForm.city} onChangeText={v => setShopForm(f => ({ ...f, city: v }))} />
              <TextInput style={inputStyle} placeholder="UPI ID (e.g. shopname@upi)" placeholderTextColor={Colors.textLight} value={shopForm.upi_id} onChangeText={v => setShopForm(f => ({ ...f, upi_id: v }))} autoCapitalize="none" />
              <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: -6, marginBottom: 8, paddingHorizontal: 4 }}>
                Customers can pay you directly via UPI scan
              </Text>
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
          <View style={{ backgroundColor: Colors.white, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, padding: Spacing.xxl, maxHeight: '85%' }}>
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
              <TextInput style={[inputStyle, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="Description" placeholderTextColor={Colors.textLight} multiline value={prodForm.description} onChangeText={v => setProdForm(f => ({ ...f, description: v }))} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity onPress={() => { setShowProductModal(false); setAiSuggestions([]); }} style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' }}>
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
    </SafeAreaView>
  );
}

const inputStyle = {
  backgroundColor: Colors.background,
  borderRadius: BorderRadius.md,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 14,
  color: Colors.textPrimary,
  marginBottom: 10,
};
