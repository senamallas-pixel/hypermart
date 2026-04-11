/**
 * Tests for API client — verifies endpoints hit the right URLs.
 * Axios and expo-secure-store are mocked via __mocks__/.
 */

// Grab the shared mock instance axios.create() returns
const axiosMock = require('../__mocks__/axios').__mockInstance;
const client = require('../src/api/client');

beforeEach(() => {
  axiosMock.get.mockReset();
  axiosMock.post.mockReset();
  axiosMock.patch.mockReset();
  axiosMock.delete.mockReset();
  axiosMock.get.mockResolvedValue({ data: {} });
  axiosMock.post.mockResolvedValue({ data: {} });
  axiosMock.patch.mockResolvedValue({ data: {} });
  axiosMock.delete.mockResolvedValue({ data: {} });
});

// ── Auth ──────────────────────────────────────────────────────
describe('Auth endpoints', () => {
  test('login POSTs to /auth/login', () => {
    client.login({ email: 'a@b.com', password: 'pass' });
    expect(axiosMock.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'pass' });
  });

  test('register POSTs to /auth/register', () => {
    client.register({ email: 'a@b.com', password: 'pass', display_name: 'User' });
    expect(axiosMock.post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ email: 'a@b.com' }));
  });

  test('forgotPassword POSTs /auth/forgot-password', () => {
    client.forgotPassword('test@example.com');
    expect(axiosMock.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'test@example.com' });
  });

  test('resetPassword POSTs /auth/reset-password', () => {
    client.resetPassword('tok123', 'newpass');
    expect(axiosMock.post).toHaveBeenCalledWith('/auth/reset-password', { token: 'tok123', new_password: 'newpass' });
  });
});

// ── Shops ─────────────────────────────────────────────────────
describe('Shop endpoints', () => {
  test('listShops GETs /shops', () => {
    client.listShops();
    expect(axiosMock.get).toHaveBeenCalledWith('/shops', { params: {} });
  });

  test('listShops passes category param', () => {
    client.listShops({ category: 'Grocery' });
    expect(axiosMock.get).toHaveBeenCalledWith('/shops', { params: { category: 'Grocery' } });
  });

  test('getMyShops GETs /owners/me/shops', () => {
    client.getMyShops();
    expect(axiosMock.get).toHaveBeenCalledWith('/owners/me/shops');
  });

  test('getShop GETs /shops/:id', () => {
    client.getShop(3);
    expect(axiosMock.get).toHaveBeenCalledWith('/shops/3');
  });

  test('createShop POSTs /shops', () => {
    client.createShop({ name: 'My Shop', category: 'Grocery' });
    expect(axiosMock.post).toHaveBeenCalledWith('/shops', expect.objectContaining({ name: 'My Shop' }));
  });

  test('updateShop PATCHes /shops/:id', () => {
    client.updateShop(5, { name: 'New Name' });
    expect(axiosMock.patch).toHaveBeenCalledWith('/shops/5', { name: 'New Name' });
  });

  test('updateShopStatus PATCHes /shops/:id/status', () => {
    client.updateShopStatus(3, 'approved');
    expect(axiosMock.patch).toHaveBeenCalledWith('/shops/3/status', { status: 'approved' });
  });

  test('deleteShop DELETEs /shops/:id', () => {
    client.deleteShop(5);
    expect(axiosMock.delete).toHaveBeenCalledWith('/shops/5');
  });
});

// ── Products ──────────────────────────────────────────────────
describe('Product endpoints', () => {
  test('listProducts GETs /shops/:id/products with active_only param', () => {
    client.listProducts(1);
    expect(axiosMock.get).toHaveBeenCalledWith('/shops/1/products', { params: { active_only: true } });
  });

  test('listProducts with active_only=false shows all', () => {
    client.listProducts(1, false);
    expect(axiosMock.get).toHaveBeenCalledWith('/shops/1/products', { params: { active_only: false } });
  });

  test('createProduct POSTs /shops/:id/products', () => {
    client.createProduct(1, { name: 'Milk', price: 25 });
    expect(axiosMock.post).toHaveBeenCalledWith('/shops/1/products', { name: 'Milk', price: 25 });
  });

  test('updateProduct PATCHes /shops/:id/products/:pid', () => {
    client.updateProduct(1, 42, { price: 30 });
    expect(axiosMock.patch).toHaveBeenCalledWith('/shops/1/products/42', { price: 30 });
  });

  test('deleteProduct DELETEs /shops/:id/products/:pid', () => {
    client.deleteProduct(1, 42);
    expect(axiosMock.delete).toHaveBeenCalledWith('/shops/1/products/42');
  });

  test('bulkUpdateProducts PATCHes /shops/:id/products/bulk-update', () => {
    const items = [{ id: 1, stock: 10 }, { id: 2, stock: 5 }];
    client.bulkUpdateProducts(1, items);
    expect(axiosMock.patch).toHaveBeenCalledWith('/shops/1/products/bulk-update', { items });
  });

  test('searchProducts GETs /products/search', () => {
    client.searchProducts('milk');
    expect(axiosMock.get).toHaveBeenCalledWith('/products/search', { params: { q: 'milk' } });
  });
});

// ── Orders ────────────────────────────────────────────────────
describe('Order endpoints', () => {
  test('placeOrder POSTs /orders', () => {
    client.placeOrder({ shop_id: 1, items: [] });
    expect(axiosMock.post).toHaveBeenCalledWith('/orders', expect.objectContaining({ shop_id: 1 }));
  });

  test('placeWalkinOrder POSTs /shops/:id/walkin-order', () => {
    client.placeWalkinOrder(2, { items: [], payment_method: 'cash' });
    expect(axiosMock.post).toHaveBeenCalledWith('/shops/2/walkin-order', expect.objectContaining({ payment_method: 'cash' }));
  });

  test('getMyOrders GETs /orders/me with page param', () => {
    client.getMyOrders();
    expect(axiosMock.get).toHaveBeenCalledWith('/orders/me', { params: { page: 1 } });
  });

  test('getMyOrders passes page number', () => {
    client.getMyOrders(3);
    expect(axiosMock.get).toHaveBeenCalledWith('/orders/me', { params: { page: 3 } });
  });

  test('getShopOrders GETs /shops/:id/orders', () => {
    client.getShopOrders(1);
    expect(axiosMock.get).toHaveBeenCalledWith('/shops/1/orders', expect.any(Object));
  });

  test('updateOrderStatus PATCHes /orders/:id/status', () => {
    client.updateOrderStatus(10, 'accepted');
    expect(axiosMock.patch).toHaveBeenCalledWith('/orders/10/status', { status: 'accepted' });
  });

  test('cancelOrder POSTs /orders/:id/cancel', () => {
    client.cancelOrder(10);
    expect(axiosMock.post).toHaveBeenCalledWith('/orders/10/cancel');
  });

  test('getOrderPaymentStatus GETs /orders/:id/payment-status', () => {
    client.getOrderPaymentStatus(10);
    expect(axiosMock.get).toHaveBeenCalledWith('/orders/10/payment-status');
  });

  test('markOrderPaymentStatus PATCHes /orders/:id/payment-status', () => {
    client.markOrderPaymentStatus(10, 'paid');
    expect(axiosMock.patch).toHaveBeenCalledWith('/orders/10/payment-status', { payment_status: 'paid' });
  });
});

// ── Payments ─────────────────────────────────────────────────
describe('Payment endpoints', () => {
  test('createRazorpayOrder POSTs /payments/create-order', () => {
    client.createRazorpayOrder(5);
    expect(axiosMock.post).toHaveBeenCalledWith('/payments/create-order', { order_id: 5 });
  });

  test('verifyRazorpayPayment POSTs /payments/verify', () => {
    client.verifyRazorpayPayment({ razorpay_order_id: 'ord_1', razorpay_payment_id: 'pay_1' });
    expect(axiosMock.post).toHaveBeenCalledWith('/payments/verify', expect.objectContaining({ razorpay_order_id: 'ord_1' }));
  });

  test('getShopUPI GETs /shops/:id/upi', () => {
    client.getShopUPI(3);
    expect(axiosMock.get).toHaveBeenCalledWith('/shops/3/upi');
  });
});

// ── Suppliers ─────────────────────────────────────────────────
describe('Supplier endpoints', () => {
  test('listSuppliers GETs /shops/:id/suppliers', () => {
    client.listSuppliers(1);
    expect(axiosMock.get).toHaveBeenCalledWith('/shops/1/suppliers');
  });

  test('createSupplier POSTs /shops/:id/suppliers', () => {
    client.createSupplier(1, { name: 'FreshFarm' });
    expect(axiosMock.post).toHaveBeenCalledWith('/shops/1/suppliers', { name: 'FreshFarm' });
  });

  test('updateSupplier PATCHes /shops/:id/suppliers/:sid', () => {
    client.updateSupplier(1, 7, { phone: '9999' });
    expect(axiosMock.patch).toHaveBeenCalledWith('/shops/1/suppliers/7', { phone: '9999' });
  });

  test('deleteSupplier DELETEs /shops/:id/suppliers/:sid', () => {
    client.deleteSupplier(1, 7);
    expect(axiosMock.delete).toHaveBeenCalledWith('/shops/1/suppliers/7');
  });
});

// ── Discounts ─────────────────────────────────────────────────
describe('Discount endpoints', () => {
  test('listProductDiscounts GETs /shops/:id/product-discounts', () => {
    client.listProductDiscounts(1);
    expect(axiosMock.get).toHaveBeenCalledWith('/shops/1/product-discounts');
  });

  test('createProductDiscount POSTs /shops/:id/product-discounts', () => {
    client.createProductDiscount(1, { product_id: 5, discount_percent: 10 });
    expect(axiosMock.post).toHaveBeenCalledWith('/shops/1/product-discounts', expect.objectContaining({ product_id: 5 }));
  });

  test('deleteProductDiscount DELETEs /shops/:id/product-discounts/:id', () => {
    client.deleteProductDiscount(1, 3);
    expect(axiosMock.delete).toHaveBeenCalledWith('/shops/1/product-discounts/3');
  });

  test('listOrderDiscounts GETs /shops/:id/order-discounts', () => {
    client.listOrderDiscounts(1);
    expect(axiosMock.get).toHaveBeenCalledWith('/shops/1/order-discounts');
  });

  test('createOrderDiscount POSTs /shops/:id/order-discounts', () => {
    client.createOrderDiscount(1, { min_order_amount: 200, discount_percent: 10 });
    expect(axiosMock.post).toHaveBeenCalledWith('/shops/1/order-discounts', expect.objectContaining({ min_order_amount: 200 }));
  });

  test('getShopDiscounts GETs /shops/:id/discounts', () => {
    client.getShopDiscounts(1);
    expect(axiosMock.get).toHaveBeenCalledWith('/shops/1/discounts');
  });
});

// ── Reviews & Analytics ───────────────────────────────────────
describe('Reviews endpoints', () => {
  test('getShopReviews GETs /shops/:id/reviews', () => {
    client.getShopReviews(1);
    expect(axiosMock.get).toHaveBeenCalledWith('/shops/1/reviews');
  });

  test('createReview POSTs /shops/:id/reviews', () => {
    client.createReview(1, { rating: 5, comment: 'Great!' });
    expect(axiosMock.post).toHaveBeenCalledWith('/shops/1/reviews', { rating: 5, comment: 'Great!' });
  });
});

describe('Analytics endpoints', () => {
  test('getShopAnalytics GETs /shops/:id/analytics', () => {
    client.getShopAnalytics(1);
    expect(axiosMock.get).toHaveBeenCalledWith('/shops/1/analytics');
  });

  test('getPlatformAnalytics GETs /analytics/platform', () => {
    client.getPlatformAnalytics();
    expect(axiosMock.get).toHaveBeenCalledWith('/analytics/platform');
  });

  test('getShopReports GETs /shops/:id/reports with date params', () => {
    client.getShopReports(1, '2026-01-01', '2026-01-31');
    expect(axiosMock.get).toHaveBeenCalledWith('/shops/1/reports', {
      params: { date_from: '2026-01-01', date_to: '2026-01-31' },
    });
  });
});

// ── AI ────────────────────────────────────────────────────────
describe('AI endpoints', () => {
  test('suggestProducts POSTs /ai/suggest-products', () => {
    client.suggestProducts('Dairy', 'mil');
    expect(axiosMock.post).toHaveBeenCalledWith('/ai/suggest-products', { category: 'Dairy', partial_name: 'mil' });
  });

  test('generateDescription POSTs /ai/generate-description', () => {
    client.generateDescription('Milk', 'Dairy');
    expect(axiosMock.post).toHaveBeenCalledWith('/ai/generate-description', { name: 'Milk', category: 'Dairy' });
  });

  test('aiChat POSTs /ai/chat', () => {
    client.aiChat('hello', 1, 'customer', []);
    expect(axiosMock.post).toHaveBeenCalledWith('/ai/chat', { message: 'hello', shop_id: 1, role: 'customer', history: [] });
  });

  test('aiSalesForecast POSTs /ai/sales-forecast', () => {
    client.aiSalesForecast(2);
    expect(axiosMock.post).toHaveBeenCalledWith('/ai/sales-forecast', { shop_id: 2 });
  });
});

// ── Users ─────────────────────────────────────────────────────
describe('User endpoints', () => {
  test('getMe GETs /users/me', () => {
    client.getMe();
    expect(axiosMock.get).toHaveBeenCalledWith('/users/me');
  });

  test('updateMe PATCHes /users/me', () => {
    client.updateMe({ display_name: 'John' });
    expect(axiosMock.patch).toHaveBeenCalledWith('/users/me', { display_name: 'John' });
  });

  test('changePassword POSTs /users/me/change-password', () => {
    client.changePassword({ old_password: 'old', new_password: 'new' });
    expect(axiosMock.post).toHaveBeenCalledWith('/users/me/change-password', expect.objectContaining({ new_password: 'new' }));
  });

  test('changeRole PATCHes /users/:id/role', () => {
    client.changeRole(5, 'owner');
    expect(axiosMock.patch).toHaveBeenCalledWith('/users/5/role', { role: 'owner' });
  });

  test('deleteUser DELETEs /users/:id', () => {
    client.deleteUser(5);
    expect(axiosMock.delete).toHaveBeenCalledWith('/users/5');
  });

  test('toggleMultiLocation PATCHes /users/:id/multi-location', () => {
    client.toggleMultiLocation(5, true);
    expect(axiosMock.patch).toHaveBeenCalledWith('/users/5/multi-location', { multi_location_enabled: 1 });
  });

  test('toggleMultiLocation sends 0 when disabled', () => {
    client.toggleMultiLocation(5, false);
    expect(axiosMock.patch).toHaveBeenCalledWith('/users/5/multi-location', { multi_location_enabled: 0 });
  });
});
