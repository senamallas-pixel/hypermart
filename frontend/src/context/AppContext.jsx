// src/context/AppContext.jsx
// Global Auth + Cart state (replaces Firebase Auth + Firestore listeners)

import { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react';
import { getMe } from '../api/client';
import { setLanguage as setI18nLanguage } from '../lib/i18n';

// ── Cart ──────────────────────────────────────────────────────────

const CART_STORAGE_KEY = 'hypermart_cart';

const cartInitial = { shopId: null, shopName: null, items: [] };

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) return parsed;
    }
  } catch {}
  return cartInitial;
}

function saveCart(cart) {
  try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch {}
}

function cartReducer(state, action) {
  switch (action.type) {
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

// ── Auth ──────────────────────────────────────────────────────────

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':   return { user: action.user, loading: false, error: null };
    case 'CLEAR_USER': return { user: null,         loading: false, error: null };
    case 'SET_ERROR':  return { ...state,            loading: false, error: action.error };
    default:           return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [auth, authDispatch] = useReducer(authReducer, {
    user: null,
    loading: true,
    error: null,
  });
  const [cart, cartDispatch] = useReducer(cartReducer, null, loadCart);

  // Persist cart to localStorage on every change
  useEffect(() => {
    saveCart(cart);
  }, [cart]);
  const [search, setSearch] = useState('');
  const [activeLocation, setActiveLocationState] = useState(
    localStorage.getItem('hm_location') || 'All'
  );
  const setActiveLocation = useCallback((loc) => {
    localStorage.setItem('hm_location', loc);
    setActiveLocationState(loc);
  }, []);

  // Restore session from stored JWT token on mount
  useEffect(() => {
    const token = sessionStorage.getItem('hypermart_token');
    if (!token) {
      authDispatch({ type: 'CLEAR_USER' });
      return;
    }
    getMe()
      .then(res => authDispatch({ type: 'SET_USER', user: res.data }))
      .catch(() => {
        sessionStorage.removeItem('hypermart_token');
        authDispatch({ type: 'CLEAR_USER' });
      });
  }, []);

  const signIn = useCallback((token, userData) => {
    sessionStorage.setItem('hypermart_token', token);
    authDispatch({ type: 'SET_USER', user: userData });
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem('hypermart_token');
    authDispatch({ type: 'CLEAR_USER' });
  }, []);

  const addToCart      = useCallback((shopId, shopName, item) =>
    cartDispatch({ type: 'ADD', shopId, shopName, item }), []);
  const removeFromCart = useCallback((productId) =>
    cartDispatch({ type: 'REMOVE', productId }), []);
  const updateQuantity = useCallback((productId, qty) =>
    cartDispatch({ type: 'UPDATE_QTY', productId, qty }), []);
  const clearCart      = useCallback(() => cartDispatch({ type: 'CLEAR' }), []);

  const cartItemCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  const cartTotal     = Math.round(
    cart.items.reduce((s, i) => s + i.price * i.quantity, 0) * 100
  ) / 100;

  const setCurrentUser = useCallback((userData) => {
    authDispatch({ type: 'SET_USER', user: userData });
  }, []);

  // Language state
  const [language, setLanguageState] = useState(localStorage.getItem('hypermart_language') || 'en');
  const setLanguage = useCallback((lang) => {
    setLanguageState(lang);
    setI18nLanguage(lang); // Sync with i18n library
    localStorage.setItem('hypermart_language', lang);
  }, []);

  return (
    <AppContext.Provider value={{
      currentUser: auth.user,
      authLoading: auth.loading,
      authError:   auth.error,
      signIn, signOut, setCurrentUser,
      cart, cartItemCount, cartTotal,
      addToCart, removeFromCart, updateQuantity, clearCart,
      search, setSearch, activeLocation, setActiveLocation,
      language, setLanguage,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
};
