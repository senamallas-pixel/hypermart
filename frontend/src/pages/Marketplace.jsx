// src/pages/Marketplace.jsx — Customer view: shop listing, products, cart & orders

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Store, MapPin, Phone, MessageCircle, Package, ShoppingCart, Star,
  ArrowLeft, ChevronRight, XCircle, Plus, CheckCircle2, Clock,
  Search, Sparkles, TrendingUp, Navigation, Loader2, Sliders,
  Route, X, LocateFixed,
} from 'lucide-react';
import { listShops, listProducts, placeOrder, nearbyShops } from '../api/client';
import { useApp } from '../context/AppContext';

const CATEGORIES = [
  'Grocery', 'Dairy', 'Vegetables & Fruits', 'Meat',
  'Bakery & Snacks', 'Beverages', 'Household', 'Personal Care',
];

// Category emoji map for visual appeal
const CAT_EMOJI = {
  'Grocery':            '&#127807;',
  'Dairy':              '&#129371;',
  'Vegetables & Fruits':'&#129381;',
  'Meat':               '&#129385;',
  'Bakery & Snacks':    '&#129359;',
  'Beverages':          '&#9749;',
  'Household':          '&#127968;',
  'Personal Care':      '&#129529;',
};

// ── Shop Card ──────────────────────────────────────────────────────
function ShopCard({ shop, onClick }) {
  return (
    <motion.div
      whileHover={{ y: -3, shadow: 'lg' }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex-shrink-0 w-40 sm:w-48 bg-white border border-[#1A1A1A]/5 rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-all group"
    >
      {/* Image */}
      <div className="aspect-[4/3] bg-[#F5F5F0] relative overflow-hidden">
        {shop.logo
          ? <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          : <div className="w-full h-full flex items-center justify-center"><Store size={28} className="text-[#5A5A40]/20" /></div>
        }
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
        {/* OPEN badge */}
        <div className="absolute top-2 left-2 bg-white/92 backdrop-blur-sm px-2 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest border border-[#1A1A1A]/5 text-emerald-600 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />OPEN
        </div>
        {/* Category */}
        <div className="absolute top-2 right-2 bg-white/92 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest border border-[#1A1A1A]/5 max-w-[60px] truncate">
          {shop.category}
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-1.5 mb-0.5">
          <h4 className="font-serif text-sm font-bold truncate leading-tight flex-1">{shop.name}</h4>
          <div className="flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded-lg text-[9px] font-bold text-amber-700 border border-amber-100 shrink-0">
            <Star size={8} fill="currentColor" className="text-amber-500" />{shop.rating || '4.5'}
          </div>
        </div>
        <p className="text-[9px] text-[#1A1A1A]/40 truncate mb-2.5 flex items-center gap-1">
          <MapPin size={8} className="shrink-0" /> {shop.address}
        </p>
        <div className="flex items-center justify-between border-t border-[#1A1A1A]/5 pt-2">
          <div className="flex gap-2">
            <Phone size={12} className="text-[#5A5A40]/60" />
            <MessageCircle size={12} className="text-[#5A5A40]/60" />
          </div>
          <span className="text-[9px] font-bold text-white bg-[#5A5A40] px-3 py-1 rounded-lg">Shop</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Product Card ───────────────────────────────────────────────────
function ProductCard({ product, cartQty, onAdd, onUpdateQty }) {
  const hasDiscount = product.mrp > product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.mrp) * 100) : 0;

  return (
    <div className="bg-white border border-[#1A1A1A]/5 rounded-2xl p-2.5 flex flex-col hover:shadow-md transition-all group">
      <div className="aspect-square bg-[#F5F5F0] rounded-xl mb-2 overflow-hidden relative">
        {product.image
          ? <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          : <div className="w-full h-full flex items-center justify-center text-[#5A5A40]/10"><Package size={28} /></div>
        }
        {/* Discount badge */}
        {hasDiscount && (
          <div className="absolute top-1.5 left-1.5 bg-[#FF3269] text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            {discountPct}% off
          </div>
        )}
        {/* Unit badge */}
        <div className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-bold border border-[#1A1A1A]/5 text-[#1A1A1A]/60">
          {product.unit}
        </div>
        {/* Add / Qty control */}
        {cartQty > 0 ? (
          <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-[#5A5A40] rounded-lg px-1 py-0.5 shadow-md">
            <button onClick={e => { e.stopPropagation(); onUpdateQty(product.id, cartQty - 1); }}
              className="text-white w-5 h-5 flex items-center justify-center font-bold text-sm">&#8722;</button>
            <span className="text-white text-[10px] font-bold w-5 text-center">{cartQty}</span>
            <button onClick={e => { e.stopPropagation(); onUpdateQty(product.id, cartQty + 1); }}
              className="text-white w-5 h-5 flex items-center justify-center font-bold text-sm">&#43;</button>
          </div>
        ) : (
          <button onClick={e => { e.stopPropagation(); onAdd(); }}
            className="absolute bottom-2 right-2 bg-white text-[#FF3269] border border-[#FF3269]/20 px-2.5 py-1 rounded-lg text-[9px] font-bold shadow-sm hover:bg-[#FF3269] hover:text-white active:scale-95 transition-all uppercase">
            ADD
          </button>
        )}
      </div>
      <div className="flex flex-col gap-0.5 flex-1">
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold text-[#1A1A1A]">&#8377;{product.price}</span>
          {hasDiscount && <span className="text-[9px] text-[#1A1A1A]/30 line-through">&#8377;{product.mrp}</span>}
        </div>
        <h4 className="text-[11px] font-medium text-[#1A1A1A]/75 line-clamp-2 leading-tight">{product.name}</h4>
        <p className="text-[9px] text-[#1A1A1A]/35 font-medium mt-auto pt-0.5">{product.category}</p>
      </div>
    </div>
  );
}

// ── Shop Products View ─────────────────────────────────────────────
function ShopProductsView({ shop, onBack }) {
  const { currentUser, cart, addToCart, updateQuantity, clearCart } = useApp();
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [placing, setPlacing]   = useState(false);
  const [toast, setToast]       = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [needsLogin, setNeedsLogin]     = useState(false);

  useEffect(() => {
    listProducts(shop.id)
      .then(r => setProducts(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [shop.id]);

  const shopCartItems = cart.shopId === shop.id ? cart.items : [];
  const shopTotal     = shopCartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount     = shopCartItems.reduce((s, i) => s + i.quantity, 0);

  const productCategories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category))].filter(Boolean);
    return ['All', ...cats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (activeFilter === 'All') return products;
    return products.filter(p => p.category === activeFilter);
  }, [products, activeFilter]);

  const handleAddToCart = product => {
    if (cart.shopId && cart.shopId !== shop.id) {
      if (!window.confirm(`Your cart has items from another shop. Clear cart and add from ${shop.name}?`)) return;
      clearCart();
    }
    addToCart(shop.id, shop.name, { productId: product.id, name: product.name, price: product.price, unit: product.unit, image: product.image });
  };

  const handlePlaceOrder = async () => {
    if (!currentUser) { setNeedsLogin(true); return; }
    setPlacing(true);
    try {
      await placeOrder({ shop_id: shop.id, items: shopCartItems.map(i => ({ product_id: i.productId, quantity: i.quantity })), delivery_address: 'Default Address' });
      clearCart();
      setShowCart(false);
      setToast('Order placed! &#127881;');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to place order.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="pb-32">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-[#1A1A1A] text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm whitespace-nowrap">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shop Hero Banner */}
      <div className="relative bg-gradient-to-br from-[#5A5A40] to-[#3A3A28] px-4 pt-14 pb-6 mb-6 sm:pt-6">
        <button onClick={onBack}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-white/80 font-bold text-xs uppercase tracking-widest hover:text-white transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/15 border border-white/20 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-lg">
            {shop.logo
              ? <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" />
              : <Store size={28} className="text-white/50" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white truncate">{shop.name}</h2>
              <div className="flex items-center gap-1 bg-amber-400/20 border border-amber-300/30 px-2 py-0.5 rounded-lg text-xs font-bold text-amber-300">
                <Star size={10} fill="currentColor" />{shop.rating || '4.5'}
              </div>
            </div>
            <p className="text-white/50 text-xs flex items-center gap-1 truncate mb-2">
              <MapPin size={10} className="shrink-0" />{shop.address}
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="bg-white/15 text-white/80 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest">{shop.category}</span>
              {shop.timings && (
                <span className="bg-white/15 text-white/80 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                  <Clock size={9} />{shop.timings}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {/* Category filter pills */}
        {productCategories.length > 2 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 -mx-4 px-4 sm:mx-0 sm:px-0">
            {productCategories.map(cat => (
              <button key={cat} onClick={() => setActiveFilter(cat)}
                className={`px-4 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border ${activeFilter === cat ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#1A1A1A]/60 border-[#1A1A1A]/10 hover:border-[#5A5A40]/30'}`}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Products grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {loading
            ? Array(12).fill(0).map((_, i) => <div key={i} className="aspect-[3/4] bg-white animate-pulse rounded-2xl" />)
            : filteredProducts.length > 0
              ? filteredProducts.map(product => {
                  const cartItem = shopCartItems.find(i => i.productId === product.id);
                  return (
                    <ProductCard key={product.id} product={product}
                      cartQty={cartItem?.quantity || 0}
                      onAdd={() => handleAddToCart(product)}
                      onUpdateQty={(id, qty) => updateQuantity(id, qty)} />
                  );
                })
              : (
                <div className="col-span-full py-20 text-center">
                  <Package size={40} className="mx-auto text-[#5A5A40]/20 mb-3" />
                  <p className="text-[#1A1A1A]/30 italic text-sm">No products listed yet.</p>
                </div>
              )
          }
        </div>
      </div>

      {/* Floating Cart FAB */}
      <AnimatePresence>
        {shopCartItems.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            onClick={() => setShowCart(true)}
            className="fixed bottom-20 sm:bottom-8 right-4 sm:right-8 bg-[#5A5A40] text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-[#5A5A40]/40 flex items-center gap-3 z-60 hover:bg-[#4A4A30] active:scale-95 transition-all"
          >
            <div className="relative">
              <ShoppingCart size={20} />
              <span className="absolute -top-2 -right-2 bg-[#FF3269] text-white w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            </div>
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-widest opacity-70 leading-none mb-0.5">View Cart</p>
              <p className="font-bold text-sm leading-none">&#8377;{shopTotal}</p>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Cart Bottom Sheet */}
      <AnimatePresence>
        {showCart && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={e => e.target === e.currentTarget && setShowCart(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCart(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 bg-[#1A1A1A]/15 rounded-full" />
              </div>

              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A]/6">
                <div>
                  <h3 className="font-serif text-xl font-bold">Your Cart</h3>
                  <p className="text-xs text-[#1A1A1A]/40">{shop.name}</p>
                </div>
                <button onClick={() => setShowCart(false)} className="w-9 h-9 flex items-center justify-center hover:bg-[#F5F5F0] rounded-xl transition-colors">
                  <XCircle size={20} className="text-[#1A1A1A]/40" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {shopCartItems.map(item => (
                  <div key={item.productId} className="flex gap-3 items-center">
                    <div className="w-14 h-14 bg-[#F5F5F0] rounded-xl overflow-hidden flex-shrink-0">
                      {item.image ? <img src={item.image} className="w-full h-full object-cover" alt={item.name} /> : <Package size={20} className="m-auto mt-3.5 text-[#5A5A40]/20" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{item.name}</p>
                      <p className="text-xs text-[#1A1A1A]/40">&#8377;{item.price} / {item.unit}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <p className="font-bold text-sm">&#8377;{item.price * item.quantity}</p>
                      <div className="flex items-center bg-[#F5F5F0] rounded-xl border border-[#1A1A1A]/6 overflow-hidden">
                        <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center font-bold text-[#5A5A40] hover:bg-[#5A5A40]/10 transition-colors text-sm">&#8722;</button>
                        <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center font-bold text-[#5A5A40] hover:bg-[#5A5A40]/10 transition-colors text-sm">&#43;</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-6 py-5 border-t border-[#1A1A1A]/6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[#1A1A1A]/40 font-bold uppercase tracking-widest text-xs">Total</span>
                  <span className="font-serif text-2xl font-bold">&#8377;{shopTotal}</span>
                </div>
                <button onClick={handlePlaceOrder} disabled={placing}
                  className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#5A5A40]/20">
                  {placing ? 'Placing Order&hellip;' : <><span>Place Order</span><ChevronRight size={18} /></>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Login Prompt Modal */}
      <AnimatePresence>
        {needsLogin && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={e => e.target === e.currentTarget && setNeedsLogin(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNeedsLogin(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
              <div className="w-16 h-16 bg-[#5A5A40]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Store size={28} className="text-[#5A5A40]" />
              </div>
              <h3 className="font-serif text-xl font-bold mb-2">Sign in to order</h3>
              <p className="text-sm text-[#1A1A1A]/50 mb-6">Create an account or sign in to place your order.</p>
              <div className="flex gap-3">
                <button onClick={() => setNeedsLogin(false)}
                  className="flex-1 py-3 rounded-2xl border border-[#1A1A1A]/10 text-sm font-bold text-[#1A1A1A]/60 hover:bg-[#F5F5F0] transition-all">
                  Cancel
                </button>
                <a href="#/login"
                  className="flex-1 py-3 rounded-2xl bg-[#5A5A40] text-white text-sm font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/20 text-center">
                  Sign In
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Nearby Shops Section ───────────────────────────────────────────
// ── Route Map Modal (Rapido/Ola-style tracking) ───────────────────
function RouteMapModal({ userLocation, shop, onClose }) {
  const mapRef = useRef(null);
  const [mapCenter, setMapCenter] = useState({
    lat: (userLocation.lat + (shop.lat || userLocation.lat)) / 2,
    lng: (userLocation.lng + (shop.lng || userLocation.lng)) / 2,
  });
  const [zoom, setZoom] = useState(14);
  const [routePoints, setRoutePoints] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const centerStart = useRef(null);

  const startPt = { lat: userLocation.lat, lng: userLocation.lng };
  const endPt = { lat: shop.lat || userLocation.lat, lng: shop.lng || userLocation.lng };

  // Tile math
  const lon2tile = (lon, z) => ((lon + 180) / 360) * Math.pow(2, z);
  const lat2tile = (lat, z) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * Math.pow(2, z);
  const tile2lon = (x, z) => (x / Math.pow(2, z)) * 360 - 180;
  const tile2lat = (y, z) => {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  };

  // Fetch route from OSRM (free, no API key needed)
  useEffect(() => {
    setLoadingRoute(true);
    fetch(`https://router.project-osrm.org/route/v1/driving/${startPt.lng},${startPt.lat};${endPt.lng},${endPt.lat}?overview=full&geometries=geojson`)
      .then(r => r.json())
      .then(data => {
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
          setRoutePoints(coords);
          setRouteInfo({
            distance: (route.distance / 1000).toFixed(1),
            duration: Math.ceil(route.duration / 60),
          });
          // Auto-fit: set center and zoom to encompass route
          if (coords.length > 0) {
            const lats = coords.map(c => c.lat);
            const lngs = coords.map(c => c.lng);
            const minLat = Math.min(...lats, startPt.lat, endPt.lat);
            const maxLat = Math.max(...lats, startPt.lat, endPt.lat);
            const minLng = Math.min(...lngs, startPt.lng, endPt.lng);
            const maxLng = Math.max(...lngs, startPt.lng, endPt.lng);
            setMapCenter({ lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 });
            const latDiff = maxLat - minLat;
            const lngDiff = maxLng - minLng;
            const maxDiff = Math.max(latDiff, lngDiff);
            const z = maxDiff < 0.005 ? 16 : maxDiff < 0.01 ? 15 : maxDiff < 0.02 ? 14 : maxDiff < 0.05 ? 13 : maxDiff < 0.1 ? 12 : maxDiff < 0.2 ? 11 : maxDiff < 0.5 ? 10 : 9;
            setZoom(z);
          }
        }
      })
      .catch(() => {
        // Fallback: straight line
        setRoutePoints([startPt, endPt]);
        const dist = haversine(startPt.lat, startPt.lng, endPt.lat, endPt.lng);
        setRouteInfo({ distance: dist.toFixed(1), duration: Math.ceil(dist * 3) });
      })
      .finally(() => setLoadingRoute(false));
  }, []);

  // Haversine for fallback
  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Map interaction handlers
  const handleMouseDown = (e) => {
    setDragging(false);
    dragStart.current = { x: e.clientX, y: e.clientY };
    centerStart.current = { ...mapCenter };
  };
  const handleMouseMove = (e) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) setDragging(true);
    const tileSize = 256;
    const newCenterTileX = lon2tile(centerStart.current.lng, zoom) - dx / tileSize;
    const newCenterTileY = lat2tile(centerStart.current.lat, zoom) - dy / tileSize;
    setMapCenter({ lat: tile2lat(newCenterTileY, zoom), lng: tile2lon(newCenterTileX, zoom) });
  };
  const handleMouseUp = () => { dragStart.current = null; centerStart.current = null; };

  // Convert lat/lng to pixel position on map
  const latLngToPixel = (lat, lng, rect) => {
    const w = rect.width;
    const h = rect.height;
    const tileSize = 256;
    const centerTileX = lon2tile(mapCenter.lng, zoom);
    const centerTileY = lat2tile(mapCenter.lat, zoom);
    const ptTileX = lon2tile(lng, zoom);
    const ptTileY = lat2tile(lat, zoom);
    return {
      x: w / 2 + (ptTileX - centerTileX) * tileSize,
      y: h / 2 + (ptTileY - centerTileY) * tileSize,
    };
  };

  // Render tiles + route + markers
  const renderMap = () => {
    if (!mapRef.current) return null;
    const rect = mapRef.current.getBoundingClientRect();
    const w = rect.width || 600;
    const h = rect.height || 450;
    const tileSize = 256;
    const centerTileX = lon2tile(mapCenter.lng, zoom);
    const centerTileY = lat2tile(mapCenter.lat, zoom);
    const tilesX = Math.ceil(w / tileSize) + 2;
    const tilesY = Math.ceil(h / tileSize) + 2;
    const startTileX = Math.floor(centerTileX - tilesX / 2);
    const startTileY = Math.floor(centerTileY - tilesY / 2);
    const offsetX = (centerTileX - startTileX) * tileSize - w / 2;
    const offsetY = (centerTileY - startTileY) * tileSize - h / 2;
    const elements = [];

    // Tiles
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const tileXIdx = startTileX + tx;
        const tileYIdx = startTileY + ty;
        const maxTile = Math.pow(2, zoom);
        if (tileYIdx < 0 || tileYIdx >= maxTile) continue;
        const wrappedX = ((tileXIdx % maxTile) + maxTile) % maxTile;
        elements.push(
          <img key={`tile-${zoom}-${wrappedX}-${tileYIdx}`}
            src={`https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileYIdx}.png`}
            alt="" draggable={false}
            style={{ position: 'absolute', left: tx * tileSize - offsetX, top: ty * tileSize - offsetY, width: tileSize, height: tileSize }}
          />
        );
      }
    }

    // Route line (SVG overlay)
    if (routePoints.length > 1) {
      const svgPoints = routePoints.map(pt => {
        const px = latLngToPixel(pt.lat, pt.lng, rect);
        return px;
      });
      const pathD = svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      elements.push(
        <svg key="route-svg" style={{ position: 'absolute', top: 0, left: 0, width: w, height: h, pointerEvents: 'none', zIndex: 5 }}>
          {/* Shadow */}
          <path d={pathD} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          {/* Main route */}
          <path d={pathD} fill="none" stroke="#3B82F6" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Animated dash overlay */}
          <path d={pathD} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="12 8">
            <animate attributeName="stroke-dashoffset" values="0;-20" dur="1s" repeatCount="indefinite" />
          </path>
        </svg>
      );
    }

    // Start marker (You)
    const startPixel = latLngToPixel(startPt.lat, startPt.lng, rect);
    elements.push(
      <div key="start-marker" style={{ position: 'absolute', left: startPixel.x - 20, top: startPixel.y - 50, zIndex: 10, pointerEvents: 'none' }}>
        <div className="flex flex-col items-center">
          <div className="bg-blue-500 text-white text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg shadow-lg mb-1 whitespace-nowrap">You</div>
          <div className="w-5 h-5 bg-blue-500 rounded-full border-[3px] border-white shadow-lg flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
          <div className="w-0.5 h-2 bg-blue-500" />
          <div className="w-3 h-1.5 bg-blue-500/30 rounded-full" />
        </div>
      </div>
    );

    // End marker (Shop)
    const endPixel = latLngToPixel(endPt.lat, endPt.lng, rect);
    elements.push(
      <div key="end-marker" style={{ position: 'absolute', left: endPixel.x - 20, top: endPixel.y - 50, zIndex: 10, pointerEvents: 'none' }}>
        <div className="flex flex-col items-center">
          <div className="bg-red-500 text-white text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg shadow-lg mb-1 whitespace-nowrap max-w-[100px] truncate">{shop.name}</div>
          <div className="w-5 h-5 bg-red-500 rounded-full border-[3px] border-white shadow-lg flex items-center justify-center">
            <Store size={10} className="text-white" />
          </div>
          <div className="w-0.5 h-2 bg-red-500" />
          <div className="w-3 h-1.5 bg-red-500/30 rounded-full" />
        </div>
      </div>
    );

    // Pulsing circle around user location
    elements.push(
      <div key="user-pulse" style={{ position: 'absolute', left: startPixel.x - 30, top: startPixel.y - 30, zIndex: 4, pointerEvents: 'none' }}>
        <div className="w-[60px] h-[60px] rounded-full bg-blue-400/20 animate-ping" style={{ animationDuration: '2s' }} />
      </div>
    );

    return elements;
  };

  const openInGoogleMaps = () => {
    window.open(`https://www.google.com/maps/dir/${startPt.lat},${startPt.lng}/${endPt.lat},${endPt.lng}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1A1A1A]/5 bg-gradient-to-r from-[#5A5A40] to-[#4A4A30]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
              <Route size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-white">Route to {shop.name}</h3>
              <p className="text-[10px] text-white/60 uppercase tracking-widest">{shop.category} · {shop.address}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Route info bar */}
        <div className="flex items-center gap-4 px-5 py-3 bg-[#F5F5F0] border-b border-[#1A1A1A]/5">
          <div className="flex items-center gap-6 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
              <span className="text-xs font-medium text-[#1A1A1A]/60">Your Location</span>
            </div>
            <div className="flex-1 border-t-2 border-dashed border-[#1A1A1A]/15 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#F5F5F0] px-2">
                {loadingRoute ? (
                  <Loader2 size={12} className="animate-spin text-[#5A5A40]" />
                ) : routeInfo ? (
                  <span className="text-[10px] font-bold text-[#5A5A40]">{routeInfo.distance} km · ~{routeInfo.duration} min</span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm" />
              <span className="text-xs font-medium text-[#1A1A1A]/60 max-w-[100px] truncate">{shop.name}</span>
            </div>
          </div>
        </div>

        {/* Map */}
        <div
          ref={mapRef}
          className="relative flex-1 cursor-grab active:cursor-grabbing select-none"
          style={{ minHeight: 380 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {loadingRoute && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={28} className="animate-spin text-[#5A5A40]" />
                <p className="text-sm font-medium text-[#1A1A1A]/50">Calculating route…</p>
              </div>
            </div>
          )}
          {renderMap()}
          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
            <button onClick={() => setZoom(z => Math.min(z + 1, 18))}
              className="w-9 h-9 bg-white rounded-xl shadow-md flex items-center justify-center font-bold text-lg hover:bg-gray-50 transition-colors">+</button>
            <button onClick={() => setZoom(z => Math.max(z - 1, 2))}
              className="w-9 h-9 bg-white rounded-xl shadow-md flex items-center justify-center font-bold text-lg hover:bg-gray-50 transition-colors">−</button>
          </div>
          {/* Recenter button */}
          <div className="absolute bottom-3 right-3 z-20">
            <button onClick={() => {
              setMapCenter({ lat: (startPt.lat + endPt.lat) / 2, lng: (startPt.lng + endPt.lng) / 2 });
            }}
              className="w-9 h-9 bg-white rounded-xl shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors">
              <LocateFixed size={16} className="text-[#5A5A40]" />
            </button>
          </div>
          {/* Attribution */}
          <div className="absolute bottom-0 left-0 z-20 text-[8px] text-[#1A1A1A]/40 bg-white/80 px-1">© OpenStreetMap · OSRM</div>
        </div>

        {/* Bottom action bar */}
        <div className="px-5 py-4 border-t border-[#1A1A1A]/5 flex items-center gap-3">
          {routeInfo && (
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Distance</p>
                  <p className="font-serif text-xl font-bold">{routeInfo.distance} km</p>
                </div>
                <div className="w-px h-8 bg-[#1A1A1A]/10" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Est. Time</p>
                  <p className="font-serif text-xl font-bold">~{routeInfo.duration} min</p>
                </div>
                <div className="w-px h-8 bg-[#1A1A1A]/10" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Rating</p>
                  <p className="font-serif text-xl font-bold flex items-center gap-1"><Star size={14} fill="#F59E0B" className="text-amber-500" />{shop.rating}</p>
                </div>
              </div>
            </div>
          )}
          <button onClick={openInGoogleMaps}
            className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-sm flex items-center gap-2 shrink-0">
            <Navigation size={14} /> Open in Google Maps
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function NearbyShopsSection({ onSelectShop }) {
  const [nearbyList, setNearbyList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [radius, setRadius] = useState(2);
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);
  const [locationRequested, setLocationRequested] = useState(false);
  const [trackingShop, setTrackingShop] = useState(null);
  const RADIUS_OPTIONS = [1, 2, 3, 5, 10, 15, 25];

  const fetchNearby = useCallback(async (lat, lng, r) => {
    setLoading(true); setError(null);
    try {
      const res = await nearbyShops(lat, lng, r);
      setNearbyList(res.data.items);
    } catch {
      setError('Failed to load nearby shops.');
    } finally { setLoading(false); }
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setError('Geolocation is not supported by your browser.'); return; }
    setLoading(true); setError(null); setLocationRequested(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        fetchNearby(loc.lat, loc.lng, radius);
      },
      (err) => {
        setLoading(false);
        if (err.code === 1) setError('Location access denied. Please allow location access in your browser settings.');
        else setError('Unable to retrieve your location. Please try again.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [radius, fetchNearby]);

  useEffect(() => {
    if (userLocation) fetchNearby(userLocation.lat, userLocation.lng, radius);
  }, [radius, userLocation, fetchNearby]);

  return (
    <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg font-bold flex items-center gap-2">
          <Navigation size={16} className="text-[#5A5A40]" /> Shops Near You
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRadiusPicker(v => !v)}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#F5F5F0] rounded-full text-xs font-bold border border-[#1A1A1A]/6 hover:bg-[#EBEBDB] transition-colors">
            <Sliders size={12} className="text-[#5A5A40]" /> {radius} km
          </button>
          {userLocation && (
            <button onClick={() => fetchNearby(userLocation.lat, userLocation.lng, radius)}
              className="p-1.5 hover:bg-[#F5F5F0] rounded-lg transition-colors" title="Refresh">
              <Navigation size={14} className="text-[#5A5A40]" />
            </button>
          )}
        </div>
      </div>

      {/* Radius picker */}
      <AnimatePresence>
        {showRadiusPicker && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
            <div className="flex flex-wrap gap-1.5 bg-[#F5F5F0] rounded-2xl p-3">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 w-full mb-1">Search Radius</span>
              {RADIUS_OPTIONS.map(r => (
                <button key={r} onClick={() => { setRadius(r); setShowRadiusPicker(false); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${radius === r ? 'bg-[#5A5A40] text-white shadow-sm' : 'bg-white text-[#1A1A1A]/60 border border-[#1A1A1A]/10 hover:border-[#5A5A40]/30'}`}>
                  {r} km
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!locationRequested ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 bg-[#5A5A40]/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <MapPin size={24} className="text-[#5A5A40]" />
          </div>
          <p className="text-sm text-[#1A1A1A]/50 mb-4">Find shops near your current location</p>
          <button onClick={requestLocation}
            className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-sm inline-flex items-center gap-2">
            <Navigation size={14} /> Use My Location
          </button>
        </div>
      ) : loading ? (
        <div className="py-8 text-center">
          <Loader2 size={24} className="animate-spin mx-auto text-[#5A5A40]/40 mb-2" />
          <p className="text-sm text-[#1A1A1A]/40">Finding nearby shops…</p>
        </div>
      ) : error ? (
        <div className="py-6 text-center">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <button onClick={requestLocation}
            className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest hover:underline">
            Try Again
          </button>
        </div>
      ) : nearbyList.length > 0 ? (
        <div className="space-y-2">
          {nearbyList.map(shop => (
            <motion.div key={shop.id} whileTap={{ scale: 0.98 }} onClick={() => onSelectShop(shop)}
              className="flex items-center gap-3 bg-[#F5F5F0] rounded-2xl px-4 py-3 cursor-pointer hover:bg-[#EBEBDB] transition-colors">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-white flex-shrink-0">
                {shop.logo ? <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Store size={18} className="m-auto mt-3.5 text-[#5A5A40]/30" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm truncate">{shop.name}</p>
                  {shop.is_open ? (
                    <span className="text-[7px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />open
                    </span>
                  ) : (
                    <span className="text-[7px] font-bold uppercase tracking-widest bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">closed</span>
                  )}
                </div>
                <p className="text-[10px] text-[#1A1A1A]/40">{shop.category} · {shop.address}</p>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                <p className="font-bold text-sm text-[#5A5A40]">{shop.distance_km} km</p>
                <div className="flex items-center gap-0.5 text-[9px] text-amber-600">
                  <Star size={8} fill="currentColor" />{shop.rating}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setTrackingShop(shop); }}
                  className="flex items-center gap-1 bg-[#5A5A40] text-white px-2.5 py-1 rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-[#4A4A30] transition-colors shadow-sm">
                  <Route size={10} /> Track
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="text-sm text-[#1A1A1A]/40">No shops found within {radius} km</p>
          <button onClick={() => setRadius(r => Math.min(r + 3, 25))}
            className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest hover:underline mt-2">
            Expand radius
          </button>
        </div>
      )}

      {userLocation && nearbyList.length > 0 && (
        <p className="text-[9px] text-[#1A1A1A]/30 text-center mt-3 uppercase tracking-widest">
          Showing {nearbyList.length} shop{nearbyList.length !== 1 ? 's' : ''} within {radius} km
        </p>
      )}

      {/* Route tracking modal */}
      <AnimatePresence>
        {trackingShop && userLocation && (
          <RouteMapModal userLocation={userLocation} shop={trackingShop} onClose={() => setTrackingShop(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Banner / Hero ──────────────────────────────────────────────────
function MarketplaceBanner({ location }) {
  return (
    <div className="relative bg-gradient-to-r from-[#5A5A40] via-[#4A4A30] to-[#3A3A20] overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" />
      <div className="absolute -right-8 -bottom-12 w-40 h-40 bg-white/5 rounded-full" />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <p className="text-white/55 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
          <MapPin size={10} />{location}
        </p>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-1">
          Good <span id="greeting">morning</span> &#128075;
        </h2>
        <p className="text-white/55 text-sm">What are you looking for today?</p>
      </div>
    </div>
  );
}

// ── Main Marketplace ───────────────────────────────────────────────
export default function Marketplace() {
  const { currentUser, search, setSearch, activeLocation } = useApp();
  const [shops, setShops]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [selectedShop, setSelectedShop] = useState(null);
  const [debounced, setDebounced]       = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchShops = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = activeLocation === 'All' ? { size: 100 } : { location: activeLocation, size: 100 };
      const res = await listShops(params);
      setShops(res.data.items);
    } catch {
      setError('Failed to load shops.');
    } finally {
      setLoading(false);
    }
  }, [activeLocation]);

  useEffect(() => { fetchShops(); }, [fetchShops]);

  const shopsByCategory = useMemo(() => {
    const q = debounced.toLowerCase();
    const filtered = shops.filter(s => !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    return CATEGORIES.reduce((acc, cat) => { acc[cat] = filtered.filter(s => s.category === cat); return acc; }, {});
  }, [shops, debounced]);

  const totalShops = Object.values(shopsByCategory).flat().length;

  if (selectedShop) return <ShopProductsView shop={selectedShop} onBack={() => setSelectedShop(null)} />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-24">
      {/* Hero banner */}
      <MarketplaceBanner location={activeLocation} />

      {/* Category pills bar */}
      <div className="sticky top-14 z-40 bg-white/95 backdrop-blur-md border-b border-[#1A1A1A]/6">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button onClick={() => setSearch('')}
              className={`px-4 py-2 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border uppercase tracking-widest ${!debounced ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-sm' : 'bg-white text-[#1A1A1A]/55 border-[#1A1A1A]/10 hover:border-[#5A5A40]/30'}`}>
              All
            </button>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setSearch(cat)}
                className={`px-4 py-2 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border uppercase tracking-widest ${debounced === cat ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-sm' : 'bg-white text-[#1A1A1A]/55 border-[#1A1A1A]/10 hover:border-[#5A5A40]/30'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-10">
        {error && (
          <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-2xl text-sm">
            <span className="text-red-700 font-medium">{error}</span>
            <button onClick={fetchShops} className="text-red-600 font-bold text-xs uppercase tracking-widest hover:text-red-800">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="py-24 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-[#5A5A40]/20 border-t-[#5A5A40] rounded-full animate-spin" />
            </div>
            <p className="text-[#1A1A1A]/35 font-serif italic text-sm">Finding shops near you&hellip;</p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            {!debounced && totalShops > 0 && (
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex-shrink-0 bg-white border border-[#1A1A1A]/5 rounded-2xl p-4 shadow-sm flex items-center gap-3 min-w-[140px]">
                  <div className="w-9 h-9 bg-[#5A5A40]/10 rounded-xl flex items-center justify-center">
                    <Store size={16} className="text-[#5A5A40]" />
                  </div>
                  <div>
                    <p className="font-serif text-xl font-bold">{totalShops}</p>
                    <p className="text-[9px] text-[#1A1A1A]/40 font-bold uppercase tracking-widest">Shops open</p>
                  </div>
                </div>
                <div className="flex-shrink-0 bg-white border border-[#1A1A1A]/5 rounded-2xl p-4 shadow-sm flex items-center gap-3 min-w-[140px]">
                  <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                    <TrendingUp size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="font-serif text-xl font-bold">{activeLocation.split(' ')[0]}</p>
                    <p className="text-[9px] text-[#1A1A1A]/40 font-bold uppercase tracking-widest">Your area</p>
                  </div>
                </div>
                <div className="flex-shrink-0 bg-white border border-[#1A1A1A]/5 rounded-2xl p-4 shadow-sm flex items-center gap-3 min-w-[140px]">
                  <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                    <Sparkles size={16} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-serif text-xl font-bold">Free</p>
                    <p className="text-[9px] text-[#1A1A1A]/40 font-bold uppercase tracking-widest">Delivery</p>
                  </div>
                </div>
              </div>
            )}

            {/* Nearby Shops - GPS based */}
            {!debounced && (
              <NearbyShopsSection onSelectShop={(shop) => setSelectedShop(shop)} />
            )}

            {/* Category sections */}
            {CATEGORIES.map(cat => {
              const catShops = shopsByCategory[cat] || [];
              if (debounced && !CATEGORIES.includes(debounced) && catShops.length === 0) return null;
              if (debounced && CATEGORIES.includes(debounced) && debounced !== cat) return null;

              return (
                <div key={cat}>
                  {/* Section header */}
                  <div className="flex items-end justify-between mb-4 px-0.5">
                    <div>
                      <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
                        <span dangerouslySetInnerHTML={{ __html: CAT_EMOJI[cat] || '' }} />
                        {cat}
                      </h3>
                      <p className="text-[10px] text-[#1A1A1A]/35 font-bold uppercase tracking-widest mt-0.5">
                        Fresh from {activeLocation}
                        {catShops.length > 0 && <span className="ml-2 text-[#5A5A40]">&bull; {catShops.length} shop{catShops.length !== 1 ? 's' : ''}</span>}
                      </p>
                    </div>
                    {catShops.length > 0 && (
                      <button onClick={() => setSearch(cat)}
                        className="text-[#5A5A40] text-xs font-bold uppercase tracking-widest flex items-center gap-1 hover:underline shrink-0">
                        See All <ChevronRight size={14} />
                      </button>
                    )}
                  </div>

                  {/* Shop cards horizontal scroll */}
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                    {catShops.length > 0
                      ? catShops.map(shop => (
                          <ShopCard key={shop.id} shop={shop} onClick={() => setSelectedShop(shop)} />
                        ))
                      : (
                        <div className="flex-shrink-0 w-full h-28 flex items-center justify-center bg-white/60 rounded-2xl border border-dashed border-[#1A1A1A]/10">
                          <p className="text-[#1A1A1A]/25 italic text-sm">No shops registered in this category yet.</p>
                        </div>
                      )
                    }
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </motion.div>
  );
}
