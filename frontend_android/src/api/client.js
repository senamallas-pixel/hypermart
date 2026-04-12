import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/config';

export const api = axios.create({ baseURL: API_URL });

// Attach JWT Bearer token on every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('hypermart_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);

// ── Users ─────────────────────────────────────────────────────────
export const getMe = () => api.get('/users/me');
export const updateMe = (data) => api.patch('/users/me', data);
export const changePassword = (data) => api.post('/users/me/change-password', data);
export const deleteMyAccount = () => api.delete('/users/me');
export const listUsers = () => api.get('/users');
export const changeRole = (id, role) => api.patch(`/users/${id}/role`, { role });
export const deleteUser = (id) => api.delete(`/users/${id}`);

// ── Subscriptions ─────────────────────────────────────────────────
export const getMySubscription = () => api.get('/subscriptions/me');
export const activateSubscription = () => api.post('/subscriptions/activate');
export const listSubscriptions = () => api.get('/subscriptions');

// ── Shops ─────────────────────────────────────────────────────────
export const listShops = (params = {}) => api.get('/shops', { params });
export const nearbyShops = (lat, lng, radius = 2, params = {}) =>
  api.get('/shops/nearby', { params: { lat, lng, radius, ...params } });
export const createShop = (data) => api.post('/shops', data);
export const getShop = (id) => api.get(`/shops/${id}`);
export const updateShop = (id, data) => api.patch(`/shops/${id}`, data);
export const updateShopStatus = (id, status) => api.patch(`/shops/${id}/status`, { status });
export const deleteShop = (id) => api.delete(`/shops/${id}`);
export const getMyShops = () => api.get('/owners/me/shops');

// ── Products ──────────────────────────────────────────────────────
export const listProducts = (shopId, activeOnly = true) =>
  api.get(`/shops/${shopId}/products`, { params: { active_only: activeOnly } });
export const createProduct = (shopId, data) => api.post(`/shops/${shopId}/products`, data);
export const updateProduct = (shopId, productId, data) => api.patch(`/shops/${shopId}/products/${productId}`, data);
export const deleteProduct = (shopId, productId) => api.delete(`/shops/${shopId}/products/${productId}`);

// ── Orders ────────────────────────────────────────────────────────
export const placeOrder = (data) => api.post('/orders', data);
export const placeWalkinOrder = (shopId, data) => api.post(`/shops/${shopId}/walkin-order`, data);
export const getMyOrders = (page = 1) => api.get('/orders/me', { params: { page } });
export const getShopOrders = (shopId, page = 1, params = {}) => api.get(`/shops/${shopId}/orders`, { params: { page, ...params } });
export const updateOrderStatus = (orderId, status) => api.patch(`/orders/${orderId}/status`, { status });
export const cancelOrder = (orderId) => api.post(`/orders/${orderId}/cancel`);
export const getOrderPaymentStatus = (orderId) => api.get(`/orders/${orderId}/payment-status`);
export const markOrderPaymentStatus = (orderId, status) => api.patch(`/orders/${orderId}/payment-status`, { payment_status: status });

// ── Payments ─────────────────────────────────────────────────────
export const createRazorpayOrder = (orderId) => api.post('/payments/create-order', { order_id: orderId });
export const verifyRazorpayPayment = (data) => api.post('/payments/verify', data);
export const getShopUPI = (shopId) => api.get(`/shops/${shopId}/upi`);

// ── Analytics ─────────────────────────────────────────────────────
export const getPlatformAnalytics = () => api.get('/analytics/platform');
export const getShopAnalytics = (shopId) => api.get(`/shops/${shopId}/analytics`);
export const getShopReports = (shopId, from, to) =>
  api.get(`/shops/${shopId}/reports`, { params: { date_from: from, date_to: to } });

// ── File Upload ───────────────────────────────────────────────────
export const uploadFile = (uri, name, type) => {
  const form = new FormData();
  form.append('file', { uri, name: name || 'upload.jpg', type: type || 'image/jpeg' });
  return api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ── Reviews ───────────────────────────────────────────────────────
export const getShopReviews = (shopId) => api.get(`/shops/${shopId}/reviews`);
export const createReview = (shopId, data) => api.post(`/shops/${shopId}/reviews`, data);

// ── Auth extras ──────────────────────────────────────────────────
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });
export const resetPassword = (token, new_password) => api.post('/auth/reset-password', { token, new_password });

// ── Product Search ───────────────────────────────────────────────
export const searchProducts = (q, params = {}) => api.get('/products/search', { params: { q, ...params } });

// ── AI ────────────────────────────────────────────────────────────
export const getAIStatus = () => api.get('/ai/status');
export const suggestProducts = (category, partial_name) => api.post('/ai/suggest-products', { category, partial_name });
export const generateDescription = (name, category) => api.post('/ai/generate-description', { name, category });
export const getLowStockInsight = (shop_id, shop_name, low_stock_items = []) => api.post('/ai/low-stock-insight', { shop_id, shop_name, low_stock_items });
export const aiSalesForecast = (shop_id) => api.post('/ai/sales-forecast', { shop_id });
export const aiChat = (message, shop_id, role, history) => api.post('/ai/chat', { message, shop_id, role, history });

// ── Suppliers ────────────────────────────────────────────────────
export const listSuppliers = (shopId) => api.get(`/shops/${shopId}/suppliers`);
export const createSupplier = (shopId, data) => api.post(`/shops/${shopId}/suppliers`, data);
export const updateSupplier = (shopId, id, data) => api.patch(`/shops/${shopId}/suppliers/${id}`, data);
export const deleteSupplier = (shopId, id) => api.delete(`/shops/${shopId}/suppliers/${id}`);

// ── Purchase Orders ──────────────────────────────────────────────
export const listPurchaseOrders = (shopId) => api.get(`/shops/${shopId}/purchase-orders`);
export const createPurchaseOrder = (shopId, data) => api.post(`/shops/${shopId}/purchase-orders`, data);
export const getPurchaseOrder = (shopId, id) => api.get(`/shops/${shopId}/purchase-orders/${id}`);
export const updatePOStatus = (shopId, id, status) => api.patch(`/shops/${shopId}/purchase-orders/${id}/status`, { status });

// ── Discounts ────────────────────────────────────────────────────
export const listProductDiscounts = (shopId) => api.get(`/shops/${shopId}/product-discounts`);
export const createProductDiscount = (shopId, data) => api.post(`/shops/${shopId}/product-discounts`, data);
export const updateProductDiscount = (shopId, id, data) => api.patch(`/shops/${shopId}/product-discounts/${id}`, data);
export const deleteProductDiscount = (shopId, id) => api.delete(`/shops/${shopId}/product-discounts/${id}`);
export const listOrderDiscounts = (shopId) => api.get(`/shops/${shopId}/order-discounts`);
export const createOrderDiscount = (shopId, data) => api.post(`/shops/${shopId}/order-discounts`, data);
export const updateOrderDiscount = (shopId, id, data) => api.patch(`/shops/${shopId}/order-discounts/${id}`, data);
export const deleteOrderDiscount = (shopId, id) => api.delete(`/shops/${shopId}/order-discounts/${id}`);
export const getShopDiscounts = (shopId) => api.get(`/shops/${shopId}/discounts`);

// ── Bulk Stock ───────────────────────────────────────────────────
export const bulkUpdateProducts = (shopId, items) => api.patch(`/shops/${shopId}/products/bulk-update`, { items });

// ── Multi-location Toggle ────────────────────────────────────────
export const toggleMultiLocation = (userId, enabled) => api.patch(`/users/${userId}/multi-location`, { multi_location_enabled: enabled ? 1 : 0 });
