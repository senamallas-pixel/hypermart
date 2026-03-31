// src/pages/Marketplace.jsx
// Customer view — shop listing, product browsing, cart & order placement

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Store, MapPin, Phone, MessageCircle, Package, ShoppingCart, Star,
  ArrowLeft, ChevronRight, XCircle, Plus, CheckCircle2,
} from 'lucide-react';
import { listShops, listProducts, placeOrder, getMyOrders } from '../api/client';
import { useApp } from '../context/AppContext';

const LOCATIONS  = ['Green Valley', 'Central Market', 'Food Plaza', 'Milk Lane', 'Old Town'];
const CATEGORIES = [
  'Grocery', 'Dairy', 'Vegetables & Fruits', 'Meat',
  'Bakery & Snacks', 'Beverages', 'Household', 'Personal Care',
];

// ── Shop Card ─────────────────────────────────────────────────────

function ShopCard({ shop, onClick }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex-shrink-0 w-40 sm:w-48 bg-white border border-[#1A1A1A]/5 rounded-2xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all"
    >
      <div className="aspect-[4/3] bg-[#F5F5F0] relative overflow-hidden">
        {shop.logo
          ? <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          : <div className="w-full h-full flex items-center justify-center text-[#5A5A40]/20"><Store size={32} /></div>
        }
        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest border border-[#1A1A1A]/5 text-[#5A5A40]">OPEN</div>
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest border border-[#1A1A1A]/5">{shop.category}</div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h4 className="font-serif text-sm font-bold truncate leading-tight flex-1">{shop.name}</h4>
          <div className="flex items-center gap-0.5 bg-green-50 px-1.5 py-0.5 rounded text-[9px] font-bold text-green-700 border border-green-100 shrink-0">
            <Star size={8} fill="currentColor" />{shop.rating || '4.5'}
          </div>
        </div>
        <p className="text-[9px] text-[#1A1A1A]/40 truncate mb-2 flex items-center gap-1">
          <MapPin size={8} /> {shop.address}
        </p>
        <div className="flex items-center justify-between pt-2 border-t border-[#1A1A1A]/5">
          <div className="flex gap-2.5">
            <Phone size={12} className="text-[#5A5A40] hover:scale-110 transition-transform" />
            <MessageCircle size={12} className="text-[#5A5A40] hover:scale-110 transition-transform" />
          </div>
          <button className="text-[9px] font-bold text-white bg-[#5A5A40] px-3 py-1 rounded-lg hover:bg-[#4A4A30] transition-colors">
            Shop
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Product Card ──────────────────────────────────────────────────

function ProductCard({ product, cartQty, onAdd, onUpdateQty }) {
  return (
    <div className="bg-white border border-[#1A1A1A]/5 rounded-2xl p-2.5 flex flex-col hover:shadow-md transition-shadow group">
      <div className="aspect-square bg-[#F5F5F0] rounded-xl mb-2 overflow-hidden relative border border-[#1A1A1A]/5">
        {product.image
          ? <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          : <div className="w-full h-full flex items-center justify-center text-[#5A5A40]/10"><Package size={32} /></div>
        }
        <div className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest border border-[#1A1A1A]/5">
          {product.unit}
        </div>
        {cartQty > 0 ? (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-[#5A5A40] rounded-lg px-1.5 py-0.5 shadow-sm">
            <button onClick={(e) => { e.stopPropagation(); onUpdateQty(product.id, cartQty - 1); }}
              className="text-white w-5 h-5 flex items-center justify-center font-bold text-lg leading-none">−</button>
            <span className="text-white text-[10px] font-bold w-4 text-center">{cartQty}</span>
            <button onClick={(e) => { e.stopPropagation(); onUpdateQty(product.id, cartQty + 1); }}
              className="text-white w-5 h-5 flex items-center justify-center font-bold text-lg leading-none">+</button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className="absolute bottom-2 right-2 bg-white text-[#FF3269] border border-[#FF3269]/20 px-3 py-1 rounded-lg text-[10px] font-bold shadow-sm hover:bg-[#FF3269] hover:text-white transition-all uppercase tracking-wider"
          >ADD</button>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold">₹{product.price}</span>
          {product.mrp > product.price && (
            <span className="text-[9px] text-[#1A1A1A]/30 line-through font-medium">₹{product.mrp}</span>
          )}
        </div>
        <h4 className="text-[11px] font-medium text-[#1A1A1A]/80 line-clamp-2 leading-tight h-7">{product.name}</h4>
        <p className="text-[9px] text-[#1A1A1A]/40 font-medium">{product.category}</p>
      </div>
    </div>
  );
}

// ── Shop Products View ────────────────────────────────────────────

function ShopProductsView({ shop, onBack }) {
  const { currentUser, cart, addToCart, updateQuantity, clearCart, cartTotal, cartItemCount } = useApp();
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showCart, setShowCart]   = useState(false);
  const [placing, setPlacing]     = useState(false);
  const [toast, setToast]         = useState(null);

  useEffect(() => {
    listProducts(shop.id)
      .then(r => setProducts(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [shop.id]);

  const shopCartItems = cart.shopId === shop.id ? cart.items : [];
  const shopTotal = shopCartItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleAddToCart = (product) => {
    if (cart.shopId && cart.shopId !== shop.id) {
      if (!window.confirm(`Your cart has items from another shop. Clear cart and add from ${shop.name}?`)) return;
      clearCart();
    }
    addToCart(shop.id, shop.name, {
      productId: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      image: product.image,
    });
  };

  const handlePlaceOrder = async () => {
    if (!currentUser) { alert('Please log in to place an order.'); return; }
    setPlacing(true);
    try {
      await placeOrder({
        shop_id: shop.id,
        items: shopCartItems.map(i => ({ product_id: i.productId, quantity: i.quantity })),
        delivery_address: 'Default Address',
      });
      clearCart();
      setShowCart(false);
      setToast('Order placed successfully! 🎉');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to place order.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-7xl mx-auto p-4 sm:p-8">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-20 right-4 z-[200] bg-green-600 text-white px-6 py-3 rounded-2xl shadow-xl font-bold text-sm">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={onBack} className="flex items-center gap-2 text-[#5A5A40] font-bold uppercase tracking-widest mb-8 hover:gap-4 transition-all">
        <ArrowLeft size={18} /> Back to Shops
      </button>

      {/* Shop Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start mb-8">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white border border-[#1A1A1A]/5 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm">
          {shop.logo ? <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" /> : <Store size={32} className="text-[#5A5A40]/20" />}
        </div>
        <div className="text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-2 mb-1">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold">{shop.name}</h2>
            <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-lg text-xs font-bold text-green-700 border border-green-100">
              <Star size={12} fill="currentColor" />{shop.rating || '4.5'}
              <span className="text-[#1A1A1A]/30 font-normal ml-1">({shop.review_count || '100+'})</span>
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-[#1A1A1A]/40 flex items-center justify-center sm:justify-start gap-1 mb-3">
            <MapPin size={12} /> {shop.address}
          </p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2">
            <span className="bg-[#5A5A40]/5 text-[#5A5A40] px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border border-[#5A5A40]/10">{shop.category}</span>
            {shop.timings && (
              <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 border border-green-100">
                <Clock size={10} /> {shop.timings}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {loading ? (
          Array(12).fill(0).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-white/50 animate-pulse rounded-2xl border border-[#1A1A1A]/5" />
          ))
        ) : products.length > 0 ? (
          products.map(product => {
            const cartItem = shopCartItems.find(i => i.productId === product.id);
            return (
              <ProductCard
                key={product.id}
                product={product}
                cartQty={cartItem?.quantity || 0}
                onAdd={() => handleAddToCart(product)}
                onUpdateQty={(id, qty) => updateQuantity(id, qty)}
              />
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center">
            <p className="text-[#1A1A1A]/30 italic">No products listed in this shop yet.</p>
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {shopCartItems.length > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-24 right-8 bg-[#5A5A40] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 hover:scale-105 transition-all z-60"
        >
          <div className="relative">
            <ShoppingCart size={24} />
            <span className="absolute -top-2 -right-2 bg-white text-[#5A5A40] w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center">
              {shopCartItems.reduce((s, i) => s + i.quantity, 0)}
            </span>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">View Cart</p>
            <p className="font-bold">₹{shopTotal}</p>
          </div>
        </button>
      )}

      {/* Cart Modal */}
      <AnimatePresence>
        {showCart && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-8 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-serif text-2xl font-bold">Your Cart</h3>
                <button onClick={() => setShowCart(false)} className="p-2 hover:bg-[#F5F5F0] rounded-full"><XCircle size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                {shopCartItems.map(item => (
                  <div key={item.productId} className="flex gap-4">
                    <div className="w-16 h-16 bg-[#F5F5F0] rounded-2xl overflow-hidden flex-shrink-0">
                      {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Package size={24} className="m-auto mt-4 text-[#5A5A40]/20" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold">{item.name}</h4>
                      <p className="text-sm text-[#1A1A1A]/40">₹{item.price} / {item.unit}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center border border-[#1A1A1A]/10 rounded-full px-2 py-1">
                          <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="p-1 hover:bg-[#F5F5F0] rounded-full text-lg font-bold leading-none">−</button>
                          <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="p-1 hover:bg-[#F5F5F0] rounded-full"><Plus size={14} /></button>
                        </div>
                        <button onClick={() => updateQuantity(item.productId, 0)} className="text-xs font-bold text-red-500 uppercase tracking-widest">Remove</button>
                      </div>
                    </div>
                    <div className="text-right font-bold">₹{item.price * item.quantity}</div>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-8 border-t border-[#1A1A1A]/10">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[#1A1A1A]/40 font-bold uppercase tracking-widest">Total</span>
                  <span className="text-3xl font-serif font-bold">₹{shopTotal}</span>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  disabled={placing}
                  className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold text-lg hover:bg-[#4A4A30] transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {placing ? 'Placing...' : <><span>Place Order</span> <ChevronRight size={20} /></>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── My Orders View ────────────────────────────────────────────────

function MyOrdersView({ onBack }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyOrders()
      .then(r => setOrders(r.data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusColor = {
    pending:          'bg-amber-100 text-amber-700',
    accepted:         'bg-blue-100 text-blue-700',
    ready:            'bg-indigo-100 text-indigo-700',
    out_for_delivery: 'bg-purple-100 text-purple-700',
    delivered:        'bg-green-100 text-green-700',
    rejected:         'bg-red-100 text-red-700',
  };

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="max-w-7xl mx-auto p-4 sm:p-8">
      <button onClick={onBack} className="flex items-center gap-2 text-[#5A5A40] font-bold uppercase tracking-widest mb-8 hover:gap-4 transition-all">
        <ArrowLeft size={18} /> Back to Marketplace
      </button>
      <h2 className="font-serif text-3xl font-bold mb-8">My Orders</h2>
      <div className="space-y-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => <div key={i} className="h-32 bg-white/50 animate-pulse rounded-3xl" />)
        ) : orders.length > 0 ? (
          orders.map(order => (
            <div key={order.id} className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 flex flex-col sm:flex-row justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-widest">Order #{order.id}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${statusColor[order.status] || 'bg-gray-100 text-gray-700'}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm font-bold mb-2">{order.shop_name}</p>
                <div className="space-y-1">
                  {order.items.map((item, i) => (
                    <p key={i} className="text-sm text-[#1A1A1A]/60">{item.name} × {item.quantity}</p>
                  ))}
                </div>
              </div>
              <div className="text-right flex flex-col justify-between">
                <p className="text-2xl font-serif font-bold">₹{order.total}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mt-2">
                  {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center bg-white border border-[#1A1A1A]/10 rounded-3xl">
            <p className="text-[#1A1A1A]/30 italic">You haven't placed any orders yet.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Marketplace ──────────────────────────────────────────────

export default function Marketplace() {
  const { currentUser, search, setSearch, activeLocation, setActiveLocation } = useApp();
  const [shops, setShops]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
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
    const filtered = shops.filter(s => {
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    });
    return CATEGORIES.reduce((acc, cat) => {
      acc[cat] = filtered.filter(s => s.category === cat);
      return acc;
    }, {});
  }, [shops, debounced]);

  if (showOrders) return <MyOrdersView onBack={() => setShowOrders(false)} />;
  if (selectedShop) return <ShopProductsView shop={selectedShop} onBack={() => setSelectedShop(null)} />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-20">
      {/* Sticky category / search bar */}
      <div className="sticky top-16 z-40 bg-white border-b border-[#1A1A1A]/5">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSearch('')}
              className={`px-5 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border uppercase tracking-widest ${!debounced ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#1A1A1A]/60 border-[#1A1A1A]/10 hover:border-[#5A5A40]'}`}
            >All</button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSearch(cat)}
                className={`px-5 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border uppercase tracking-widest ${debounced === cat ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#1A1A1A]/60 border-[#1A1A1A]/10 hover:border-[#5A5A40]'}`}
              >{cat}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-12">
        {error && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700">
            {error} <button onClick={fetchShops} className="ml-2 underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin w-10 h-10 border-4 border-[#5A5A40] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-[#1A1A1A]/40 font-serif italic">Finding shops near you...</p>
          </div>
        ) : (
          CATEGORIES.map(cat => {
            const catShops = shopsByCategory[cat] || [];
            if (debounced && !CATEGORIES.includes(debounced) && catShops.length === 0) return null;
            if (debounced && CATEGORIES.includes(debounced) && debounced !== cat) return null;
            return (
              <div key={cat} className="space-y-6">
                <div className="flex justify-between items-end px-2">
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">{cat}</h3>
                    <p className="text-xs text-[#1A1A1A]/40 font-bold uppercase tracking-widest mt-1">Fresh from {activeLocation}</p>
                  </div>
                  {catShops.length > 0 && (
                    <button onClick={() => setSearch(cat)} className="text-[#5A5A40] text-sm font-bold uppercase tracking-widest flex items-center gap-1 hover:underline">
                      See All <ChevronRight size={16} />
                    </button>
                  )}
                </div>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
                  {catShops.length > 0 ? (
                    catShops.map(shop => (
                      <ShopCard key={shop.id} shop={shop} onClick={() => setSelectedShop(shop)} />
                    ))
                  ) : (
                    <div className="flex-shrink-0 w-full sm:w-auto h-32 flex items-center justify-center bg-[#F5F5F0]/50 rounded-3xl border border-dashed border-[#1A1A1A]/10 px-12">
                      <p className="text-[#1A1A1A]/30 italic text-sm">No shops registered in this category yet.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* My Orders button */}
      {currentUser?.role === 'customer' && (
        <button
          onClick={() => setShowOrders(true)}
          className="fixed bottom-24 left-4 bg-white border border-[#1A1A1A]/10 text-[#5A5A40] px-4 py-3 rounded-2xl shadow-lg font-bold text-sm flex items-center gap-2 hover:bg-[#F5F5F0] transition-all"
        >
          <CheckCircle2 size={16} /> My Orders
        </button>
      )}
    </motion.div>
  );
}
