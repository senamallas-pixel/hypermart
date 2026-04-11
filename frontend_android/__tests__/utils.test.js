/**
 * Tests for utility helpers used across screens
 */

const API_URL = 'https://hypermart-ukg0.onrender.com';

// ── fixImageUrl ─────────────────────────────────────────────────
const fixImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
};

describe('fixImageUrl', () => {
  test('returns null for null input', () => {
    expect(fixImageUrl(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(fixImageUrl(undefined)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(fixImageUrl('')).toBeNull();
  });

  test('returns absolute URL unchanged (Cloudinary)', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    expect(fixImageUrl(url)).toBe(url);
  });

  test('returns absolute URL unchanged (Unsplash)', () => {
    const url = 'https://images.unsplash.com/photo-1234?w=400';
    expect(fixImageUrl(url)).toBe(url);
  });

  test('prefixes relative path with API_URL', () => {
    expect(fixImageUrl('/uploads/product.jpg')).toBe(`${API_URL}/uploads/product.jpg`);
  });

  test('prefixes relative path without leading slash', () => {
    expect(fixImageUrl('uploads/product.jpg')).toBe(`${API_URL}uploads/product.jpg`);
  });

  test('does NOT double-prefix already-absolute Cloudinary URLs', () => {
    const url = 'https://res.cloudinary.com/xyz/image/upload/v123/product.jpg';
    const result = fixImageUrl(url);
    expect(result).not.toContain(`${API_URL}https`);
    expect(result).toBe(url);
  });
});

// ── normalizeList: API response normalization ───────────────────
const normalizeList = (data) =>
  data?.items || data?.orders || (Array.isArray(data) ? data : []);

describe('normalizeList (API response shape handler)', () => {
  test('extracts .items from paginated response', () => {
    const res = { items: [{ id: 1 }, { id: 2 }], total: 2, page: 1, size: 20 };
    expect(normalizeList(res)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test('extracts .orders from legacy response', () => {
    const res = { orders: [{ id: 10 }] };
    expect(normalizeList(res)).toEqual([{ id: 10 }]);
  });

  test('returns plain array unchanged', () => {
    const res = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(normalizeList(res)).toEqual(res);
  });

  test('returns empty array for undefined', () => {
    expect(normalizeList(undefined)).toEqual([]);
  });

  test('returns empty array for null', () => {
    expect(normalizeList(null)).toEqual([]);
  });

  test('returns empty array for plain object without known keys', () => {
    expect(normalizeList({ detail: 'Not found' })).toEqual([]);
  });

  test('returns empty array when .items is empty', () => {
    const res = { items: [], total: 0, page: 1, size: 20 };
    expect(normalizeList(res)).toEqual([]);
  });
});

// ── Cart total calculation ──────────────────────────────────────
const calcCartTotal = (items) =>
  Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;

describe('calcCartTotal', () => {
  test('returns 0 for empty cart', () => {
    expect(calcCartTotal([])).toBe(0);
  });

  test('single item', () => {
    expect(calcCartTotal([{ price: 50, quantity: 2 }])).toBe(100);
  });

  test('multiple items', () => {
    const items = [
      { price: 10, quantity: 3 },
      { price: 25.5, quantity: 2 },
    ];
    expect(calcCartTotal(items)).toBe(81);
  });

  test('rounds to 2 decimal places', () => {
    expect(calcCartTotal([{ price: 10.005, quantity: 1 }])).toBe(10.01);
  });
});

// ── UPI deeplink builder ────────────────────────────────────────
const buildUPIUri = (upiId, shopName, amount) =>
  `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName || '')}&am=${amount}&cu=INR`;

describe('buildUPIUri', () => {
  test('builds correct UPI URI', () => {
    const uri = buildUPIUri('shop@upi', 'My Shop', 150);
    expect(uri).toBe('upi://pay?pa=shop%40upi&pn=My%20Shop&am=150&cu=INR');
  });

  test('handles empty shop name', () => {
    const uri = buildUPIUri('pay@ybl', '', 50);
    expect(uri).toContain('pn=');
    expect(uri).toContain('am=50');
  });

  test('encodes special characters in UPI ID', () => {
    const uri = buildUPIUri('name@okaxis', 'Shop & Go', 100);
    expect(uri).toContain('Shop%20%26%20Go');
  });
});

// ── Order status flow ───────────────────────────────────────────
const ORDER_FLOW = {
  pending: ['accepted', 'rejected'],
  accepted: ['ready'],
  ready: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
};

const canTransition = (currentStatus, nextStatus) =>
  (ORDER_FLOW[currentStatus] || []).includes(nextStatus);

describe('canTransition (order status flow)', () => {
  test('pending → accepted is valid', () => {
    expect(canTransition('pending', 'accepted')).toBe(true);
  });

  test('pending → rejected is valid', () => {
    expect(canTransition('pending', 'rejected')).toBe(true);
  });

  test('accepted → ready is valid', () => {
    expect(canTransition('accepted', 'ready')).toBe(true);
  });

  test('ready → out_for_delivery is valid', () => {
    expect(canTransition('ready', 'out_for_delivery')).toBe(true);
  });

  test('out_for_delivery → delivered is valid', () => {
    expect(canTransition('out_for_delivery', 'delivered')).toBe(true);
  });

  test('delivered → pending is invalid', () => {
    expect(canTransition('delivered', 'pending')).toBe(false);
  });

  test('pending → delivered skip is invalid', () => {
    expect(canTransition('pending', 'delivered')).toBe(false);
  });
});
