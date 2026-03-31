// src/pages/Marketplace.jsx — Customer view: shop listing, products, cart & orders

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Store, MapPin, Phone, MessageCircle, Package, ShoppingCart, Star,
  ArrowLeft, ChevronRight, XCircle, Plus, CheckCircle2, Clock,
  Search, Sparkles, TrendingUp,
} from 'lucide-react';
import { listShops, listProducts, placeOrder, getMyOrders } from '../api/client';
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
    if (!currentUser) { alert('Please log in to place an order.'); return; }
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
    </motion.div>
  );
}

// ── My Orders View ─────────────────────────────────────────────────
function MyOrdersView({ onBack }) {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyOrders()
      .then(r => setOrders(r.data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const STATUS = {
    pending:          { cls: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500'   },
    accepted:         { cls: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500'    },
    ready:            { cls: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500'  },
    out_for_delivery: { cls: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500'  },
    delivered:        { cls: 'bg-green-100 text-green-700',   dot: 'bg-green-500'   },
    rejected:         { cls: 'bg-red-100 text-red-700',       dot: 'bg-red-500'     },
  };

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="max-w-2xl mx-auto px-4 pb-28 pt-4 sm:pt-8">
      <button onClick={onBack} className="flex items-center gap-2 text-[#5A5A40] font-bold text-xs uppercase tracking-widest mb-6 hover:gap-3 transition-all">
        <ArrowLeft size={16} /> Back to Marketplace
      </button>
      <h2 className="font-serif text-2xl font-bold mb-6">My Orders</h2>

      <div className="space-y-3">
        {loading
          ? Array(3).fill(0).map((_, i) => <div key={i} className="h-28 bg-white animate-pulse rounded-2xl" />)
          : orders.length > 0
            ? orders.map(order => {
                const s = STATUS[order.status] || { cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
                return (
                  <div key={order.id} className="bg-white border border-[#1A1A1A]/5 rounded-2xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-[#1A1A1A]/30 uppercase tracking-widest">#{order.id}</span>
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${s.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {order.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="font-bold text-sm">{order.shop_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-serif text-xl font-bold">&#8377;{order.total}</p>
                        <p className="text-[9px] text-[#1A1A1A]/35 uppercase tracking-widest font-bold mt-0.5">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-[#1A1A1A]/5 pt-3 space-y-1">
                      {order.items.map((item, i) => (
                        <p key={i} className="text-xs text-[#1A1A1A]/50">{item.name} <span className="text-[#1A1A1A]/30">x {item.quantity}</span></p>
                      ))}
                    </div>
                  </div>
                );
              })
            : (
              <div className="py-20 text-center bg-white border border-[#1A1A1A]/5 rounded-3xl">
                <div className="w-16 h-16 bg-[#F5F5F0] rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart size={28} className="text-[#5A5A40]/25" />
                </div>
                <p className="text-[#1A1A1A]/30 italic text-sm">No orders yet.</p>
              </div>
            )
        }
      </div>
    </motion.div>
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
  const [showOrders, setShowOrders]     = useState(false);
  const [debounced, setDebounced]       = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchShops = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await listShops({ location: activeLocation, size: 100 });
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

  if (showOrders)  return <MyOrdersView onBack={() => setShowOrders(false)} />;
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

      {/* My Orders FAB */}
      {currentUser?.role === 'customer' && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowOrders(true)}
          className="fixed bottom-20 sm:bottom-8 left-4 bg-white border border-[#1A1A1A]/10 text-[#5A5A40] px-4 py-3 rounded-2xl shadow-lg font-bold text-xs flex items-center gap-2 hover:shadow-xl hover:bg-[#F5F5F0] active:scale-95 transition-all z-40"
        >
          <CheckCircle2 size={15} /> My Orders
        </motion.button>
      )}
    </motion.div>
  );
}
