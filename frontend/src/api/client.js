// src/api/client.js
// HyperMart — Axios REST client (JWT Bearer auth)

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT Bearer token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hypermart_token");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────

export const register = (data) => api.post("/auth/register", data);
export const login    = (data) => api.post("/auth/login",    data);

// ── Users ─────────────────────────────────────────────────────────

export const getMe      = ()         => api.get("/users/me");
export const updateMe   = (data)     => api.patch("/users/me",        data);
export const listUsers  = ()         => api.get("/users");
export const changeRole = (id, role) => api.patch(`/users/${id}/role`, { role });

// ── Subscriptions ─────────────────────────────────────────────────

export const getMySubscription    = ()  => api.get("/subscriptions/me");
export const activateSubscription = ()  => api.post("/subscriptions/activate");
export const listSubscriptions    = ()  => api.get("/subscriptions");

// ── Shops ─────────────────────────────────────────────────────────

export const listShops        = (params = {}) => api.get("/shops",              { params });
export const createShop       = (data)        => api.post("/shops",              data);
export const getShop          = (id)          => api.get(`/shops/${id}`);
export const updateShop       = (id, data)    => api.patch(`/shops/${id}`,       data);
export const updateShopStatus = (id, status)  => api.patch(`/shops/${id}/status`,{ status });
export const deleteShop       = (id)          => api.delete(`/shops/${id}`);
export const getMyShops       = ()            => api.get("/owners/me/shops");

// ── Products ──────────────────────────────────────────────────────

export const listProducts  = (shopId, activeOnly = true) =>
  api.get(`/shops/${shopId}/products`, { params: { active_only: activeOnly } });
export const createProduct = (shopId, data)            => api.post(`/shops/${shopId}/products`, data);
export const updateProduct = (shopId, productId, data) => api.patch(`/shops/${shopId}/products/${productId}`, data);
export const deleteProduct = (shopId, productId)       => api.delete(`/shops/${shopId}/products/${productId}`);

// ── Orders ────────────────────────────────────────────────────────

export const placeOrder        = (data)             => api.post('/orders', data);
export const placeWalkinOrder  = (shopId, data)     => api.post(`/shops/${shopId}/walkin-order`, data);
export const getMyOrders       = (page = 1)         => api.get('/orders/me', { params: { page } });
export const getShopOrders     = (shopId, page = 1) => api.get(`/shops/${shopId}/orders`, { params: { page } });
export const updateOrderStatus = (orderId, status)  => api.patch(`/orders/${orderId}/status`, { status });

// ── Analytics ─────────────────────────────────────────────────────

export const getPlatformAnalytics = ()       => api.get('/analytics/platform');
export const getShopAnalytics     = (shopId) => api.get(`/shops/${shopId}/analytics`);
