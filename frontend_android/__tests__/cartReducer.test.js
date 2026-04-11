/**
 * Tests for cart state reducer logic (mirrors AppContext.js cartReducer)
 */

const cartInitial = { shopId: null, shopName: null, items: [] };

function cartReducer(state, action) {
  switch (action.type) {
    case 'SET':
      return action.cart;
    case 'ADD': {
      const { shopId, shopName, item } = action;
      if (state.shopId && state.shopId !== shopId) return state;
      const existing = state.items.find(i => i.productId === item.productId);
      const items = existing
        ? state.items.map(i =>
            i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i
          )
        : [...state.items, { ...item, quantity: 1 }];
      return { shopId, shopName, items };
    }
    case 'REMOVE': {
      const items = state.items.filter(i => i.productId !== action.productId);
      return items.length ? { ...state, items } : cartInitial;
    }
    case 'UPDATE_QTY': {
      if (action.qty < 1) {
        const items = state.items.filter(i => i.productId !== action.productId);
        return items.length ? { ...state, items } : cartInitial;
      }
      return {
        ...state,
        items: state.items.map(i =>
          i.productId === action.productId ? { ...i, quantity: action.qty } : i
        ),
      };
    }
    case 'CLEAR':
      return cartInitial;
    default:
      return state;
  }
}

const product = (id, name = 'Test', price = 10) => ({ productId: id, name, price, unit: 'kg' });

describe('cartReducer — ADD', () => {
  test('adds first item to empty cart', () => {
    const state = cartReducer(cartInitial, {
      type: 'ADD', shopId: 1, shopName: 'Shop A', item: product(101),
    });
    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(1);
    expect(state.shopId).toBe(1);
  });

  test('increments quantity for existing item', () => {
    let state = cartReducer(cartInitial, { type: 'ADD', shopId: 1, shopName: 'S', item: product(101) });
    state = cartReducer(state, { type: 'ADD', shopId: 1, shopName: 'S', item: product(101) });
    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(2);
  });

  test('adds different product as new item', () => {
    let state = cartReducer(cartInitial, { type: 'ADD', shopId: 1, shopName: 'S', item: product(101) });
    state = cartReducer(state, { type: 'ADD', shopId: 1, shopName: 'S', item: product(102) });
    expect(state.items).toHaveLength(2);
  });

  test('ignores add from different shop when cart has items', () => {
    let state = cartReducer(cartInitial, { type: 'ADD', shopId: 1, shopName: 'S1', item: product(101) });
    const unchanged = cartReducer(state, { type: 'ADD', shopId: 2, shopName: 'S2', item: product(201) });
    expect(unchanged.shopId).toBe(1);
    expect(unchanged.items).toHaveLength(1);
  });
});

describe('cartReducer — REMOVE', () => {
  test('removes item from cart', () => {
    let state = cartReducer(cartInitial, { type: 'ADD', shopId: 1, shopName: 'S', item: product(101) });
    state = cartReducer(state, { type: 'ADD', shopId: 1, shopName: 'S', item: product(102) });
    state = cartReducer(state, { type: 'REMOVE', productId: 101 });
    expect(state.items).toHaveLength(1);
    expect(state.items[0].productId).toBe(102);
  });

  test('clears cart when last item is removed', () => {
    let state = cartReducer(cartInitial, { type: 'ADD', shopId: 1, shopName: 'S', item: product(101) });
    state = cartReducer(state, { type: 'REMOVE', productId: 101 });
    expect(state).toEqual(cartInitial);
  });
});

describe('cartReducer — UPDATE_QTY', () => {
  test('updates item quantity', () => {
    let state = cartReducer(cartInitial, { type: 'ADD', shopId: 1, shopName: 'S', item: product(101) });
    state = cartReducer(state, { type: 'UPDATE_QTY', productId: 101, qty: 5 });
    expect(state.items[0].quantity).toBe(5);
  });

  test('removes item when quantity set to 0', () => {
    let state = cartReducer(cartInitial, { type: 'ADD', shopId: 1, shopName: 'S', item: product(101) });
    state = cartReducer(state, { type: 'UPDATE_QTY', productId: 101, qty: 0 });
    expect(state).toEqual(cartInitial);
  });

  test('removes item when quantity set below 1', () => {
    let state = cartReducer(cartInitial, { type: 'ADD', shopId: 1, shopName: 'S', item: product(101) });
    state = cartReducer(state, { type: 'UPDATE_QTY', productId: 101, qty: -1 });
    expect(state).toEqual(cartInitial);
  });
});

describe('cartReducer — CLEAR', () => {
  test('resets cart to initial state', () => {
    let state = cartReducer(cartInitial, { type: 'ADD', shopId: 1, shopName: 'S', item: product(101) });
    state = cartReducer(state, { type: 'CLEAR' });
    expect(state).toEqual(cartInitial);
  });
});

describe('cartReducer — computed values', () => {
  test('cartItemCount sums all quantities', () => {
    let state = cartReducer(cartInitial, { type: 'ADD', shopId: 1, shopName: 'S', item: product(101) });
    state = cartReducer(state, { type: 'ADD', shopId: 1, shopName: 'S', item: product(101) });
    state = cartReducer(state, { type: 'ADD', shopId: 1, shopName: 'S', item: product(102) });
    const count = state.items.reduce((s, i) => s + i.quantity, 0);
    expect(count).toBe(3);
  });

  test('cartTotal multiplies price × quantity', () => {
    let state = cartReducer(cartInitial, {
      type: 'ADD', shopId: 1, shopName: 'S',
      item: { productId: 101, name: 'Milk', price: 25, unit: 'L' },
    });
    state = cartReducer(state, { type: 'UPDATE_QTY', productId: 101, qty: 3 });
    const total = Math.round(state.items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
    expect(total).toBe(75);
  });
});
