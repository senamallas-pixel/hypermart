// src/pages/Marketplace.jsx — Customer view: shop listing, products, cart & orders

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Store, MapPin, Phone, MessageCircle, Package, ShoppingCart, Star,
  ArrowLeft, ChevronRight, XCircle, Plus, CheckCircle2, Clock,
  Search, Sparkles, TrendingUp, Navigation, Loader2, Sliders,
  Route, X, List, Map,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { listShops, listProducts, placeOrder, nearbyShops, getShopReviews, createReview, getShopDiscounts } from '../api/client';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../hooks/useTranslation';

// Fix Leaflet default marker icon (bundler issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Fix double-prefixed Cloudinary URLs from old data
function fixImageUrl(url) {
  if (!url) return url;
  const idx = url.indexOf('https://res.cloudinary.com');
  if (idx > 0) return url.slice(idx);
  return url;
}

// ── Nearby map helpers ────────────────────────────────────────────────────────
function shopMapIcon(isOpen) {
  const bg = isOpen ? '#10B981' : '#9CA3AF';
  const svg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22" fill="white"/></svg>`;
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:30px;height:30px;background:${bg};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;">${svg}</div>
      <div style="width:2px;height:7px;background:${bg};"></div>
      <div style="width:8px;height:4px;background:${bg}33;border-radius:50%;"></div>
    </div>`,
    iconSize: [30, 44],
    iconAnchor: [15, 44],
    popupAnchor: [0, -46],
  });
}

function userNearbyIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:20px;height:20px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 7px rgba(59,130,246,0.18),0 2px 8px rgba(59,130,246,0.4);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function NearbyMapFitter({ userLoc, shops }) {
  const map = useMap();
  useEffect(() => {
    const pts = [
      [userLoc.lat, userLoc.lng],
      ...shops.filter(s => s.lat && s.lng).map(s => [parseFloat(s.lat), parseFloat(s.lng)]),
    ];
    if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts), { padding: [50, 50] });
    } else {
      map.setView([userLoc.lat, userLoc.lng], 14);
    }
  }, [shops]);
  return null;
}

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
  const isOpen = shop.is_open !== 0;
  return (
    <motion.div
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`flex-shrink-0 w-40 sm:w-48 bg-white border rounded-2xl overflow-hidden cursor-pointer shadow-sm transition-all group ${isOpen ? 'border-[#1A1A1A]/5 hover:shadow-lg' : 'border-[#1A1A1A]/8 opacity-70 hover:opacity-90'}`}
    >
      {/* Image */}
      <div className="aspect-[4/3] bg-[#F5F5F0] relative overflow-hidden">
        {shop.logo
          ? <img src={fixImageUrl(shop.logo)} alt={shop.name} className={`w-full h-full object-cover transition-transform duration-500 ${isOpen ? 'group-hover:scale-105' : 'grayscale-[40%]'}`} referrerPolicy="no-referrer" />
          : <div className="w-full h-full flex items-center justify-center"><Store size={28} className="text-[#5A5A40]/20" /></div>
        }
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
        {/* OPEN / CLOSED badge */}
        {isOpen ? (
          <div className="absolute top-2 left-2 bg-white/92 backdrop-blur-sm px-2 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest border border-[#1A1A1A]/5 text-emerald-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />OPEN
          </div>
        ) : (
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest text-white flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />CLOSED
          </div>
        )}
        {/* Category */}
        <div className="absolute top-2 right-2 bg-white/92 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest border border-[#1A1A1A]/5 max-w-[60px] truncate">
          {shop.category}
        </div>
        {/* Closed overlay */}
        {!isOpen && (
          <div className="absolute inset-0 bg-black/10" />
        )}
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
          {isOpen
            ? <span className="text-[9px] font-bold text-white bg-[#5A5A40] px-3 py-1 rounded-lg">Shop</span>
            : <span className="text-[9px] font-bold text-[#1A1A1A]/40 bg-[#F5F5F0] px-3 py-1 rounded-lg border border-[#1A1A1A]/8">View</span>
          }
        </div>
      </div>
    </motion.div>
  );
}

// ── Product Card ───────────────────────────────────────────────────
function ProductCard({ product, cartQty, onAdd, onUpdateQty, offerLabel, shopClosed }) {
  const hasDiscount = product.mrp > product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.mrp) * 100) : 0;

  return (
    <div className="bg-white border border-[#1A1A1A]/5 rounded-2xl p-2.5 flex flex-col hover:shadow-md transition-all group">
      <div className="aspect-square bg-[#F5F5F0] rounded-xl mb-2 overflow-hidden relative">
        {product.image
          ? <img src={fixImageUrl(product.image)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          : <div className="w-full h-full flex items-center justify-center text-[#5A5A40]/10"><Package size={28} /></div>
        }
        {/* Price discount badge */}
        {hasDiscount && (
          <div className="absolute top-1.5 left-1.5 bg-[#FF3269] text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            {discountPct}% off
          </div>
        )}
        {/* Offer badge */}
        {offerLabel && (
          <div className="absolute bottom-8 left-1.5 bg-green-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full leading-none uppercase">
            {offerLabel}
          </div>
        )}
        {/* Unit badge */}
        <div className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-bold border border-[#1A1A1A]/5 text-[#1A1A1A]/60">
          {product.unit}
        </div>
        {/* Add / Qty control */}
        {!shopClosed && cartQty > 0 ? (
          <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-[#5A5A40] rounded-lg px-1 py-0.5 shadow-md">
            <button onClick={e => { e.stopPropagation(); onUpdateQty(product.id, cartQty - 1); }}
              className="text-white w-5 h-5 flex items-center justify-center font-bold text-sm">&#8722;</button>
            <span className="text-white text-[10px] font-bold w-5 text-center">{cartQty}</span>
            <button onClick={e => { e.stopPropagation(); onUpdateQty(product.id, cartQty + 1); }}
              className="text-white w-5 h-5 flex items-center justify-center font-bold text-sm">&#43;</button>
          </div>
        ) : !shopClosed ? (
          <button onClick={e => { e.stopPropagation(); onAdd(); }}
            className="absolute bottom-2 right-2 bg-white text-[#FF3269] border border-[#FF3269]/20 px-2.5 py-1 rounded-lg text-[9px] font-bold shadow-sm hover:bg-[#FF3269] hover:text-white active:scale-95 transition-all uppercase">
            ADD
          </button>
        ) : null}
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
  const { t } = useTranslation();
  const { currentUser, cart, addToCart, updateQuantity, clearCart } = useApp();
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [placing, setPlacing]   = useState(false);
  const [toast, setToast]       = useState(null);
  const [activeFilter, setActiveFilter] = useState(t('common.all'));
  const [needsLogin, setNeedsLogin]     = useState(false);
  const [reviews, setReviews]           = useState([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [productDiscounts, setProductDiscounts] = useState([]);

  useEffect(() => {
    listProducts(shop.id)
      .then(r => setProducts(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
    getShopReviews(shop.id)
      .then(r => setReviews(r.data))
      .catch(() => {});
    getShopDiscounts(shop.id)
      .then(r => setProductDiscounts(r.data.product_discounts || []))
      .catch(() => {});
  }, [shop.id]);

  const getOfferLabel = (productId) => {
    const d = productDiscounts.find(d => d.product_id === productId && d.status === 'active' && (!d.valid_till || new Date(d.valid_till) >= new Date()));
    if (!d) return null;
    if (d.type === 'bogo') return 'BOGO';
    if (d.type === 'buy_x_get_y') return `B${d.buy_qty}G${d.get_qty}`;
    if (d.type === 'bulk_price') return 'Bulk Deal';
    return 'Offer';
  };

  const shopCartItems = cart.shopId === shop.id ? cart.items : [];
  const shopTotal     = shopCartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount     = shopCartItems.reduce((s, i) => s + i.quantity, 0);

  const productCategories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category))].filter(Boolean);
    return [t('common.all'), ...cats];
  }, [products, t]);

  const filteredProducts = useMemo(() => {
    if (activeFilter === t('common.all')) return products;
    return products.filter(p => p.category === activeFilter);
  }, [products, activeFilter, t]);

  const shopIsOpen = shop.is_open !== 0;

  const handleAddToCart = product => {
    if (!shopIsOpen) return;
    if (cart.shopId && cart.shopId !== shop.id) {
      if (!window.confirm(`${t('messages.cartHasItems')} ${shop.name}?`)) return;
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
      setToast(t('messages.orderPlaced'));
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
              ? <img src={fixImageUrl(shop.logo)} alt={shop.name} className="w-full h-full object-cover" />
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
              {shopIsOpen ? (
                <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Open Now
                </span>
              ) : (
                <span className="bg-red-500/30 text-red-200 border border-red-400/30 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />Closed
                </span>
              )}
              {shop.timings && (
                <span className="bg-white/15 text-white/80 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                  <Clock size={9} />{shop.timings}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Closed shop notice */}
      {!shopIsOpen && (
        <div className="max-w-7xl mx-auto px-4 mb-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Store size={16} className="text-red-500" />
            </div>
            <div>
              <p className="font-bold text-sm text-red-800">This shop is currently closed</p>
              <p className="text-xs text-red-600 mt-0.5">You can browse products but cannot place orders right now.{shop.timings ? ` Opens: ${shop.timings}` : ''}</p>
            </div>
          </div>
        </div>
      )}

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
                      onUpdateQty={(id, qty) => shopIsOpen ? updateQuantity(id, qty) : null}
                      offerLabel={getOfferLabel(product.id)}
                      shopClosed={!shopIsOpen} />
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

        {/* Reviews Section */}
        <div className="mt-8 mb-6">
          <h3 className="font-serif text-lg font-bold mb-4">Reviews ({reviews.length})</h3>

          {/* Submit Review */}
          {currentUser && currentUser.role === 'customer' && !reviews.find(r => r.customer_id === currentUser.id) && (
            <div className="bg-white border border-[#1A1A1A]/5 rounded-2xl p-4 mb-4">
              <p className="text-sm font-bold mb-2">Rate this shop</p>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setReviewRating(s)} className="focus:outline-none">
                    <Star size={24} className={s <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-[#1A1A1A]/15'} />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="Write a review (optional)..."
                rows={2}
                className="w-full p-3 border border-[#1A1A1A]/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40] resize-none mb-3"
              />
              <button
                disabled={reviewRating === 0 || submittingReview}
                onClick={async () => {
                  setSubmittingReview(true);
                  try {
                    const res = await createReview(shop.id, { rating: reviewRating, comment: reviewComment || null });
                    setReviews([res.data, ...reviews]);
                    setReviewRating(0);
                    setReviewComment('');
                  } catch (err) {
                    alert(err.response?.data?.detail || 'Failed to submit review');
                  } finally {
                    setSubmittingReview(false);
                  }
                }}
                className="px-4 py-2 bg-[#5A5A40] text-white text-sm font-bold rounded-xl hover:bg-[#4A4A30] transition-colors disabled:opacity-40"
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          )}

          {/* Reviews List */}
          {reviews.length > 0 ? (
            <div className="space-y-3">
              {reviews.map(r => (
                <div key={r.id} className="bg-white border border-[#1A1A1A]/5 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{r.customer_name || 'Customer'}</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} size={12} className={s <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-[#1A1A1A]/10'} />
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-[#1A1A1A]/30">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {r.comment && <p className="text-sm text-[#1A1A1A]/60">{r.comment}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#1A1A1A]/30 italic">No reviews yet. Be the first to review!</p>
          )}
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
              <p className="text-[9px] font-bold uppercase tracking-widest opacity-70 leading-none mb-0.5">{t('marketplace.viewCart')}</p>
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
                  <h3 className="font-serif text-xl font-bold">{t('marketplace.yourCart')}</h3>
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
                      {item.image ? <img src={fixImageUrl(item.image)} className="w-full h-full object-cover" alt={item.name} /> : <Package size={20} className="m-auto mt-3.5 text-[#5A5A40]/20" />}
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
                  <span className="text-[#1A1A1A]/40 font-bold uppercase tracking-widest text-xs">{t('marketplace.total')}</span>
                  <span className="font-serif text-2xl font-bold">&#8377;{shopTotal}</span>
                </div>
                <button onClick={handlePlaceOrder} disabled={placing}
                  className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#5A5A40]/20">
                  {placing ? `${t('marketplace.placingOrder')}…` : <><span>{t('marketplace.placeOrder')}</span><ChevronRight size={18} /></>}
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
              <h3 className="font-serif text-xl font-bold mb-2">{t('marketplace.signInToOrder')}</h3>
              <p className="text-sm text-[#1A1A1A]/50 mb-6">{t('messages.createAccountOrSignIn')}</p>
              <div className="flex gap-3">
                <button onClick={() => setNeedsLogin(false)}
                  className="flex-1 py-3 rounded-2xl border border-[#1A1A1A]/10 text-sm font-bold text-[#1A1A1A]/60 hover:bg-[#F5F5F0] transition-all">
                  {t('common.cancel')}
                </button>
                <a href="#/login"
                  className="flex-1 py-3 rounded-2xl bg-[#5A5A40] text-white text-sm font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/20 text-center">
                  {t('common.signIn')}
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
// Sub-component: auto-fits the map to show the full route
function RouteFitter({ routePoints, startPt, endPt }) {
  const map = useMap();
  useEffect(() => {
    if (routePoints.length > 1) {
      const bounds = L.latLngBounds(routePoints.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [48, 48] });
    } else {
      map.fitBounds(
        L.latLngBounds([[startPt.lat, startPt.lng], [endPt.lat, endPt.lng]]),
        { padding: [64, 64] }
      );
    }
  }, [routePoints]);
  return null;
}

// Custom colored icon factory
function coloredIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function RouteMapModal({ userLocation, shop, onClose }) {
  const [routePoints, setRoutePoints] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(true);

  const startPt = { lat: userLocation.lat, lng: userLocation.lng };
  const endPt = { lat: shop.lat || userLocation.lat, lng: shop.lng || userLocation.lng };

  // Haversine straight-line fallback
  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  useEffect(() => {
    setLoadingRoute(true);
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${startPt.lng},${startPt.lat};${endPt.lng},${endPt.lat}?overview=full&geometries=geojson`
    )
      .then(r => r.json())
      .then(data => {
        if (data.routes?.length > 0) {
          const route = data.routes[0];
          setRoutePoints(route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })));
          setRouteInfo({
            distance: (route.distance / 1000).toFixed(1),
            duration: Math.ceil(route.duration / 60),
          });
        }
      })
      .catch(() => {
        setRoutePoints([startPt, endPt]);
        const dist = haversine(startPt.lat, startPt.lng, endPt.lat, endPt.lng);
        setRouteInfo({ distance: dist.toFixed(1), duration: Math.ceil(dist * 3) });
      })
      .finally(() => setLoadingRoute(false));
  }, []);

  const openInGoogleMaps = () => {
    window.open(`https://www.google.com/maps/dir/${startPt.lat},${startPt.lng}/${endPt.lat},${endPt.lng}`, '_blank');
  };

  const midLat = (startPt.lat + endPt.lat) / 2;
  const midLng = (startPt.lng + endPt.lng) / 2;

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

        {/* Leaflet Map */}
        <div className="relative flex-1" style={{ minHeight: 380 }}>
          {loadingRoute && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={28} className="animate-spin text-[#5A5A40]" />
                <p className="text-sm font-medium text-[#1A1A1A]/50">Calculating route…</p>
              </div>
            </div>
          )}
          <MapContainer
            center={[midLat, midLng]}
            zoom={13}
            style={{ width: '100%', height: '100%', minHeight: 380 }}
            zoomControl={true}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {/* Route polyline */}
            {routePoints.length > 1 && (
              <>
                {/* Shadow */}
                <Polyline
                  positions={routePoints.map(p => [p.lat, p.lng])}
                  pathOptions={{ color: 'rgba(0,0,0,0.15)', weight: 8, lineCap: 'round', lineJoin: 'round' }}
                />
                {/* Main route */}
                <Polyline
                  positions={routePoints.map(p => [p.lat, p.lng])}
                  pathOptions={{ color: '#3B82F6', weight: 5, lineCap: 'round', lineJoin: 'round' }}
                />
              </>
            )}
            {/* User marker */}
            <Marker position={[startPt.lat, startPt.lng]} icon={coloredIcon('#3B82F6')} />
            {/* Shop marker */}
            <Marker position={[endPt.lat, endPt.lng]} icon={coloredIcon('#EF4444')} />
            {/* Auto-fit bounds */}
            <RouteFitter routePoints={routePoints} startPt={startPt} endPt={endPt} />
          </MapContainer>
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
  const { t } = useTranslation();
  const [nearbyList, setNearbyList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [radius, setRadius] = useState(2);
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);
  const [locationRequested, setLocationRequested] = useState(false);
  const [trackingShop, setTrackingShop] = useState(null);
  const [mapView, setMapView] = useState(false);
  const RADIUS_OPTIONS = [1, 2, 3, 5, 10, 15, 25];

  const fetchNearby = useCallback(async (lat, lng, r) => {
    setLoading(true); setError(null);
    try {
      const res = await nearbyShops(lat, lng, r);
      setNearbyList(Array.isArray(res.data) ? res.data : res.data.items || []);
    } catch {
      setError(t('messages.failedToLoadShops'));
    } finally { setLoading(false); }
  }, [t]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setError(t('messages.geolocationNotSupported')); return; }
    setLoading(true); setError(null); setLocationRequested(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setMapView(true);
        fetchNearby(loc.lat, loc.lng, radius);
      },
      (err) => {
        setLoading(false);
        if (err.code === 1) setError(t('messages.locationAccessDenied'));
        else setError(t('messages.locationRetrievalFailed'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [radius, fetchNearby, t]);

  // Auto-request location on mount
  useEffect(() => { requestLocation(); }, []);

  useEffect(() => {
    if (userLocation) fetchNearby(userLocation.lat, userLocation.lng, radius);
  }, [radius, userLocation, fetchNearby]);

  return (
    <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg font-bold flex items-center gap-2">
          <Navigation size={16} className="text-[#5A5A40]" /> {t('marketplace.shopsNearYou')}
        </h3>
        <div className="flex items-center gap-2">
          {/* List / Map toggle */}
          {userLocation && nearbyList.length > 0 && (
            <div className="flex bg-[#F5F5F0] rounded-full border border-[#1A1A1A]/8 p-0.5">
              <button onClick={() => setMapView(false)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  !mapView ? 'bg-white shadow-sm text-[#5A5A40]' : 'text-[#1A1A1A]/40 hover:text-[#1A1A1A]/60'
                }`}>
                <List size={11} /> List
              </button>
              <button onClick={() => setMapView(true)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  mapView ? 'bg-white shadow-sm text-[#5A5A40]' : 'text-[#1A1A1A]/40 hover:text-[#1A1A1A]/60'
                }`}>
                <Map size={11} /> Map
              </button>
            </div>
          )}
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
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 w-full mb-1">{t('marketplace.searchRadius')}</span>
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
          <p className="text-sm text-[#1A1A1A]/50 mb-4">{t('marketplace.findNearby')}</p>
          <button onClick={requestLocation}
            className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-sm inline-flex items-center gap-2">
            <Navigation size={14} /> {t('marketplace.useMyLocation')}
          </button>
        </div>
      ) : loading ? (
        <div className="py-8 text-center">
          <Loader2 size={24} className="animate-spin mx-auto text-[#5A5A40]/40 mb-2" />
          <p className="text-sm text-[#1A1A1A]/40">{t('messages.findingShopsNearby')}</p>
        </div>
      ) : error ? (
        <div className="py-6 text-center">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <button onClick={requestLocation}
            className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest hover:underline">
            {t('common.retry')}
          </button>
        </div>
      ) : mapView && userLocation && nearbyList.length > 0 ? (
        /* ── MAP VIEW ── */
        <div>
          <div className="rounded-2xl overflow-hidden border border-[#1A1A1A]/8" style={{ height: 380 }}>
            <MapContainer
              center={[userLocation.lat, userLocation.lng]}
              zoom={13}
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <NearbyMapFitter userLoc={userLocation} shops={nearbyList} />
              {/* User location */}
              <Marker position={[userLocation.lat, userLocation.lng]} icon={userNearbyIcon()}>
                <Popup>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 12, minWidth: 100 }}>
                    <strong>📍 You are here</strong>
                  </div>
                </Popup>
              </Marker>
              {/* Shop markers */}
              {nearbyList.map(shop =>
                shop.lat && shop.lng ? (
                  <Marker
                    key={shop.id}
                    position={[parseFloat(shop.lat), parseFloat(shop.lng)]}
                    icon={shopMapIcon(shop.is_open)}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'sans-serif', minWidth: 160 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{shop.name}</div>
                        <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 4 }}>{shop.category} · {shop.address}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
                            background: shop.is_open ? '#D1FAE5' : '#FEE2E2',
                            color: shop.is_open ? '#065F46' : '#991B1B',
                          }}>{shop.is_open ? '● OPEN' : '● CLOSED'}</span>
                          <span style={{ fontSize: 10, color: '#5A5A40', fontWeight: 700 }}>{shop.distance_km} km</span>
                          <span style={{ fontSize: 10, color: '#D97706' }}>★ {shop.rating}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => setTrackingShop(shop)}
                            style={{
                              flex: 1, fontSize: 10, fontWeight: 700, padding: '5px 0',
                              background: '#5A5A40', color: 'white', border: 'none',
                              borderRadius: 8, cursor: 'pointer',
                            }}
                          >🗺 Track</button>
                          <button
                            onClick={() => onSelectShop(shop)}
                            style={{
                              flex: 1, fontSize: 10, fontWeight: 700, padding: '5px 0',
                              background: '#F5F5F0', color: '#1A1A1A', border: '1px solid #E5E5E0',
                              borderRadius: 8, cursor: 'pointer',
                            }}
                          >View Shop</button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ) : null
              )}
            </MapContainer>
          </div>
          <p className="text-[9px] text-[#1A1A1A]/30 text-center mt-2 uppercase tracking-widest">
            Showing {nearbyList.length} {nearbyList.length === 1 ? 'shop' : 'shops'} within {radius} km · tap a pin for details
          </p>
        </div>
      ) : nearbyList.length > 0 ? (
        <div className="space-y-2">
          {nearbyList.map(shop => (
            <motion.div key={shop.id} whileTap={{ scale: 0.98 }} onClick={() => onSelectShop(shop)}
              className="flex items-center gap-3 bg-[#F5F5F0] rounded-2xl px-4 py-3 cursor-pointer hover:bg-[#EBEBDB] transition-colors">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-white flex-shrink-0">
                {shop.logo ? <img src={fixImageUrl(shop.logo)} alt={shop.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Store size={18} className="m-auto mt-3.5 text-[#5A5A40]/30" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm truncate">{shop.name}</p>
                  {shop.is_open ? (
                    <span className="text-[7px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />{t('common.open')}
                    </span>
                  ) : (
                    <span className="text-[7px] font-bold uppercase tracking-widest bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{t('common.closed')}</span>
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
                  <Route size={10} /> {t('common.track')}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="text-sm text-[#1A1A1A]/40">{t('messages.noShopsFound')} {radius} km</p>
          <button onClick={() => setRadius(r => Math.min(r + 3, 25))}
            className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest hover:underline mt-2">
            {t('marketplace.expandRadius')}
          </button>
        </div>
      )}

      {userLocation && nearbyList.length > 0 && (
        <p className="text-[9px] text-[#1A1A1A]/30 text-center mt-3 uppercase tracking-widest">
          {t('messages.showing')} {nearbyList.length} {nearbyList.length === 1 ? t('common.shop') : t('common.shops')} {t('messages.within')} {radius} km
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
  const { t } = useTranslation();
  
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
          {t('marketplace.greeting')} <span id="greeting">{t('marketplace.greetingTime')}</span> &#128075;
        </h2>
        <p className="text-white/55 text-sm">{t('marketplace.selectCategory')}</p>
      </div>
    </div>
  );
}

// ── Main Marketplace ───────────────────────────────────────────────
export default function Marketplace() {
  const { t } = useTranslation();
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
      setError(t('messages.failedToLoadShops'));
    } finally {
      setLoading(false);
    }
  }, [activeLocation, t]);

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
              {t('common.all')}
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
            <button onClick={fetchShops} className="text-red-600 font-bold text-xs uppercase tracking-widest hover:text-red-800">{t('common.retry')}</button>
          </div>
        )}

        {loading ? (
          <div className="py-24 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-[#5A5A40]/20 border-t-[#5A5A40] rounded-full animate-spin" />
            </div>
            <p className="text-[#1A1A1A]/35 font-serif italic text-sm">{t('messages.findingShops')}</p>
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
                    <p className="text-[9px] text-[#1A1A1A]/40 font-bold uppercase tracking-widest">{t('marketplace.shopsOpen')}</p>
                  </div>
                </div>
                <div className="flex-shrink-0 bg-white border border-[#1A1A1A]/5 rounded-2xl p-4 shadow-sm flex items-center gap-3 min-w-[140px]">
                  <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                    <TrendingUp size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="font-serif text-xl font-bold">{activeLocation.split(' ')[0]}</p>
                    <p className="text-[9px] text-[#1A1A1A]/40 font-bold uppercase tracking-widest">{t('marketplace.yourArea')}</p>
                  </div>
                </div>
                <div className="flex-shrink-0 bg-white border border-[#1A1A1A]/5 rounded-2xl p-4 shadow-sm flex items-center gap-3 min-w-[140px]">
                  <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                    <Sparkles size={16} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-serif text-xl font-bold">{t('marketplace.free')}</p>
                    <p className="text-[9px] text-[#1A1A1A]/40 font-bold uppercase tracking-widest">{t('marketplace.delivery')}</p>
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
                        {t('marketplace.freshFrom')} {activeLocation}
                        {catShops.length > 0 && <span className="ml-2 text-[#5A5A40]">&bull; {catShops.length} {catShops.length === 1 ? t('common.shop') : t('common.shops')}</span>}
                      </p>
                    </div>
                    {catShops.length > 0 && (
                      <button onClick={() => setSearch(cat)}
                        className="text-[#5A5A40] text-xs font-bold uppercase tracking-widest flex items-center gap-1 hover:underline shrink-0">
                        {t('common.seeAll')} <ChevronRight size={14} />
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
                          <p className="text-[#1A1A1A]/25 italic text-sm">{t('messages.noShopsYet')}</p>
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
