// src/pages/OwnerDashboard.jsx
// Shop owner portal — Analytics, Inventory, Orders, Billing

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package, ShoppingBag, TrendingUp, DollarSign, Plus, Search,
  Edit3, Trash2, X, CheckCircle2, XCircle, Clock, ChevronRight, ChevronLeft,
  Truck, Store, AlertCircle, Loader2, BarChart2, BarChart3, Menu, Minus,
  Receipt, PieChart, Activity, ArrowUpRight, ArrowDownRight, Users,
  MapPin, Upload, Navigation, Image, Calendar, Power, Save, Download,
  Star, Lock, MessageCircle, Phone, ClipboardList, AlertTriangle, Settings, Share2,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  getMyShops, createShop, updateShop,
  listProducts, createProduct, updateProduct, deleteProduct,
  getShopOrders, updateOrderStatus,
  getShopAnalytics, placeWalkinOrder,
  uploadFile,
  suggestProducts, generateDescription, getLowStockInsight,
  getShopReports, exportShopCSV,
  listSuppliers, listProductDiscounts, listOrderDiscounts,
  getShopUPI, getOrderPaymentStatus, markOrderPaymentStatus,
} from '../api/client';
import { useApp } from '../context/AppContext';
import InvoiceModal from '../components/InvoiceModal';
import { QRCodeSVG } from 'qrcode.react';
import DailySalesCalendar from '../components/DailySalesCalendar';
import SupplierManager from '../components/SupplierManager';
import PurchaseOrderManager from '../components/PurchaseOrderManager';
import BulkDiscountManager from '../components/BulkDiscountManager';
import StockAdjustment from '../components/StockAdjustment';

// Fix Leaflet default marker icon (broken in bundlers)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const TABS      = ['Overview', 'Inventory', 'Orders', 'Billing', 'Reports', 'Settings'];
const CATEGORIES= ['Grocery','Dairy','Vegetables & Fruits','Meat','Bakery & Snacks','Beverages','Household','Personal Care'];

// Fix double-prefixed Cloudinary URLs (e.g. "https://domain.comhttps://res.cloudinary.com/...")
function fixImageUrl(url) {
  if (!url) return url;
  const idx = url.indexOf('https://res.cloudinary.com');
  if (idx > 0) return url.slice(idx);
  return url;
}
const LOCATIONS = ['Green Valley','Central Market','Food Plaza','Milk Lane','Old Town'];
const SHOP_CATS = ['Grocery','Dairy','Vegetables & Fruits','Meat','Bakery & Snacks','Beverages','Household','Personal Care','General'];

// ── Stat Card (mock design) ───────────────────────────────────────
function StatCard({ icon, label, value, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#1A1A1A]/10 rounded-2xl p-4 flex flex-col items-center text-center sm:items-start sm:text-left shadow-sm ${onClick ? 'cursor-pointer hover:border-[#5A5A40] hover:shadow-md transition-all' : ''}`}
    >
      <div className="text-[#5A5A40] mb-2 scale-75 sm:scale-100">{icon}</div>
      <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1 leading-tight">{label}</p>
      <p className="text-lg sm:text-3xl font-serif font-bold">{value}</p>
    </div>
  );
}

// ── Action Button (mock design) ──────────────────────────────────
function ActionButton({ icon, label, color, textColor = 'text-white', onClick }) {
  return (
    <button
      onClick={onClick}
      className={`${color} ${textColor} p-4 rounded-2xl flex flex-col items-center gap-2 hover:opacity-90 transition-all shadow-sm`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

// ── Tab Button (mock animated underline) ─────────────────────────
function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`pb-4 text-xs sm:text-sm font-bold uppercase tracking-normal sm:tracking-widest transition-all relative whitespace-nowrap ${active ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/30 hover:text-[#1A1A1A]/50'}`}
    >
      {label}
      {active && <motion.div layoutId="owner-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
    </button>
  );
}

// ── Product Form Modal ────────────────────────────────────────────
function ProductModal({ shopId, product, onSave, onClose }) {
  const { aiAvailable } = useApp();
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    mrp: product?.mrp || '',
    unit: product?.unit || 'kg',
    category: product?.category || CATEGORIES[0],
    stock: product?.stock ?? 100,
    low_stock_threshold: product?.low_stock_threshold ?? 10,
    expiry_date: product?.expiry_date || '',
    image: fixImageUrl(product?.image) || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [descGenerating, setDescGenerating] = useState(false);
  const suggestTimerRef = useRef(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Debounced AI name suggestions
  const handleNameChange = (e) => {
    const val = e.target.value;
    setForm(f => ({ ...f, name: val }));
    if (!aiAvailable || val.trim().length < 2) { setNameSuggestions([]); return; }
    clearTimeout(suggestTimerRef.current);
    suggestTimerRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await suggestProducts(form.category, val.trim());
        setNameSuggestions(Array.isArray(res.data) ? res.data : res.data.suggestions || []);
      } catch { setNameSuggestions([]); }
      finally { setSuggestLoading(false); }
    }, 400);
  };

  const handleGenerateDescription = async () => {
    if (!form.name || !form.category) return;
    setDescGenerating(true);
    try {
      const res = await generateDescription(form.name, form.category);
      setForm(f => ({ ...f, description: res.data.description || '' }));
    } catch { /* silent */ }
    finally { setDescGenerating(false); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFile(file);
      const url = res.data.url;
      setForm(f => ({ ...f, image: url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL}${url}` }));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: +form.price,
        mrp: +form.mrp || +form.price,
        stock: +form.stock,
        low_stock_threshold: +form.low_stock_threshold,
        expiry_date: form.expiry_date || null,
      };
      if (product) await updateProduct(shopId, product.id, payload);
      else await createProduct(shopId, payload);
      onSave();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full bg-[#F5F5F0] border border-[#1A1A1A]/5 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-[#5A5A40] transition-colors';
  const sel = `${inp} appearance-none`;

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        className="bg-white w-full max-w-5xl rounded-t-3xl sm:rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <h3 className="font-serif text-2xl font-bold">{product ? 'Edit Product' : 'Add New Product'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-full"><X size={24} /></button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── LEFT: Quick Select Categories ── */}
          <div className="lg:border-r border-[#1A1A1A]/5 lg:pr-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-4">Quick Select</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {CATEGORIES.map(cat => (
                <button key={cat} type="button"
                  onClick={() => setForm(f => ({ ...f, category: cat }))}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all ${
                    form.category === cat
                      ? 'bg-[#5A5A40] text-white'
                      : 'bg-[#F5F5F0] text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/10'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Form Fields ── */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4">
          {/* Name with AI suggestions */}
          <div className="relative">
            <input className={inp} placeholder="Product name *" value={form.name}
              onChange={handleNameChange} required />
            {suggestLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 size={14} className="animate-spin text-[#5A5A40]/40" />
              </div>
            )}
            {nameSuggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-[#1A1A1A]/10 rounded-2xl shadow-lg overflow-hidden">
                {nameSuggestions.map((s, i) => (
                  <button key={i} type="button"
                    onClick={() => { setForm(f => ({ ...f, name: s })); setNameSuggestions([]); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#F5F5F0] transition-colors border-b border-[#1A1A1A]/5 last:border-0">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description with AI generate */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Description</label>
              {aiAvailable && (
                <button type="button" onClick={handleGenerateDescription}
                  disabled={descGenerating || !form.name}
                  className="flex items-center gap-1 text-[10px] font-bold text-[#5A5A40] hover:underline disabled:opacity-40 disabled:no-underline">
                  {descGenerating ? <Loader2 size={10} className="animate-spin" /> : '✨'}
                  {descGenerating ? 'Generating…' : 'AI Generate'}
                </button>
              )}
            </div>
            <textarea className={`${inp} resize-none`} rows={2} placeholder="Short product description (optional)"
              value={form.description} onChange={set('description')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input className={inp} placeholder="Selling price ₹ *" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} required />
            <input className={inp} placeholder="MRP ₹ (optional)" type="number" min="0" step="0.01" value={form.mrp} onChange={set('mrp')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1.5 block">Unit</label>
              <select className={`${sel} cursor-pointer`} value={form.unit} onChange={set('unit')} required>
                <option>kg</option>
                <option>g</option>
                <option>ml</option>
                <option>l</option>
                <option>pcs</option>
                <option>pack</option>
                <option>dozen</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1.5 block">Stock</label>
              <input className={inp} type="number" min="0" value={form.stock} onChange={set('stock')} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1.5 block">Low Stock Alert</label>
              <input className={inp} type="number" min="0" value={form.low_stock_threshold} onChange={set('low_stock_threshold')} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1.5 block">Expiry Date</label>
            <input className={inp} type="date" value={form.expiry_date} onChange={set('expiry_date')} />
          </div>

          <select className={`${sel} cursor-pointer`} value={form.category} onChange={set('category')}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>

          {/* Image Upload */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/40 mb-2 block">Product Image</label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-[#1A1A1A]/15 rounded-2xl py-4 px-4 hover:border-[#5A5A40] transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploading ? <Loader2 size={18} className="animate-spin text-[#5A5A40]" /> : <Upload size={18} className="text-[#5A5A40]" />}
                <span className="text-sm font-medium text-[#1A1A1A]/50">{uploading ? 'Uploading...' : 'Upload Image'}</span>
                <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            </div>
            <input className={`${inp} mt-2`} placeholder="Or paste image URL" value={form.image} onChange={set('image')} />
          </div>

          {form.image && (
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#F5F5F0] border border-[#1A1A1A]/5">
              <img src={form.image} alt="preview" className="w-full h-full object-cover" referrerPolicy="no-referrer"
                onError={e => { e.target.style.display = 'none'; }} />
              <button type="button" onClick={() => setForm(f => ({ ...f, image: '' }))}
                className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full hover:bg-white shadow-sm">
                <X size={14} />
              </button>
            </div>
          )}

            <button type="submit" disabled={saving}
              className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4 shadow-md hover:shadow-lg">
              {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : product ? 'Update Product' : 'Add Product'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

// ── Shop Registration Form ────────────────────────────────────────
function ShopRegistrationForm({ onSaved }) {
  const [form, setForm] = useState({
    name: '', address: '', category: SHOP_CATS[0],
    location_name: LOCATIONS[0], timings: '9:00 AM – 9:00 PM', logo: '',
    lat: '', lng: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const inp = 'w-full bg-[#F5F5F0] border border-[#1A1A1A]/5 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-[#5A5A40] transition-colors';

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFile(file);
      const url = res.data.url;
      setForm(f => ({ ...f, logo: url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL}${url}` }));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
        setLocating(false);
      },
      (err) => {
        alert('Unable to get current location: ' + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, lat: form.lat ? +form.lat : null, lng: form.lng ? +form.lng : null };
      await createShop(payload); onSaved();
    }
    catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = typeof detail === 'string' ? detail : (detail?.message || 'Failed to register shop. Please check all required fields and try again.');
      alert(errorMsg);
      console.error('Shop creation error:', err);
    }
    finally { setSaving(false); }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto bg-white p-8 rounded-3xl shadow-sm border border-[#1A1A1A]/5"
    >
      <h2 className="font-serif text-3xl font-bold mb-2 text-[#1A1A1A]">Register Your Shop</h2>
      <p className="text-sm text-[#1A1A1A]/40 mb-8 leading-relaxed">Fill in the details. You can update them later. Shops go live after admin approval.</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          <input className={inp + " hover:border-[#1A1A1A]/20"} placeholder="Shop name *" value={form.name} onChange={set('name')} required />
          <input className={inp + " hover:border-[#1A1A1A]/20"} placeholder="Full address *" value={form.address} onChange={set('address')} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <select className={`${inp} appearance-none cursor-pointer hover:border-[#1A1A1A]/20`} value={form.category} onChange={set('category')}>
              {SHOP_CATS.map(c => <option key={c}>{c}</option>)}
            </select>
            <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 pointer-events-none rotate-90" />
          </div>
          <div className="relative">
            <select className={`${inp} appearance-none cursor-pointer hover:border-[#1A1A1A]/20`} value={form.location_name} onChange={set('location_name')}>
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
            <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 pointer-events-none rotate-90" />
          </div>
        </div>
        <input className={inp + " hover:border-[#1A1A1A]/20"} placeholder="Timings (e.g. 9:00 AM – 9:00 PM)" value={form.timings} onChange={set('timings')} />

        {/* Location (Lat/Lng) */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/40 mb-2 block">Shop Location</label>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input className={inp} placeholder="Latitude" type="number" step="any" value={form.lat} onChange={set('lat')} />
            <input className={inp} placeholder="Longitude" type="number" step="any" value={form.lng} onChange={set('lng')} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={getCurrentLocation} disabled={locating}
              className="flex-1 flex items-center justify-center gap-2 border border-[#5A5A40]/30 rounded-2xl py-3 text-sm font-bold text-[#5A5A40] hover:bg-[#5A5A40]/5 active:scale-[0.98] transition-all disabled:opacity-50 hover:shadow-md cursor-pointer">
              {locating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
              {locating ? 'Getting location...' : 'Use Current Location'}
            </button>
            <button type="button" onClick={() => setMapPickerOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 border border-[#5A5A40]/30 rounded-2xl py-3 text-sm font-bold text-[#5A5A40] mx-0 hover:bg-[#5A5A40]/5 active:scale-[0.98] transition-all hover:shadow-md cursor-pointer">
              <MapPin size={16} /> Pick on Map
            </button>
          </div>
          {form.lat && form.lng && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <MapPin size={14} className="text-green-600" />
              <span className="text-xs text-green-800 font-medium">Location set: {form.lat}, {form.lng}</span>
            </div>
          )}
        </div>

        {/* Shop Logo Upload */}
        <div className="pt-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/40 mb-3 block">Shop Photo / Logo</label>
          <label className={`flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-dashed border-[#1A1A1A]/15 bg-[#F5F5F0]/50 rounded-2xl py-8 hover:border-[#5A5A40] hover:bg-[#5A5A40]/5 transition-all group ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
              {uploading ? <Loader2 size={24} className="animate-spin text-[#5A5A40]" /> : <Upload size={24} className="text-[#5A5A40]" />}
            </div>
            <span className="text-sm font-semibold text-[#1A1A1A]/60">{uploading ? 'Uploading...' : 'Click to Upload Shop Photo'}</span>
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
          </label>
          <div className="relative mt-3">
             <input className={`${inp} pr-10 hover:border-[#1A1A1A]/20`} placeholder="Or paste logo URL" value={form.logo} onChange={set('logo')} />
          </div>
          {form.logo && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="relative mt-4 w-full aspect-video rounded-2xl overflow-hidden bg-[#F5F5F0] border-2 border-[#1A1A1A]/10 shadow-inner group"
            >
              <img src={form.logo} alt="Shop logo preview" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" referrerPolicy="no-referrer"
                onError={e => { e.target.style.display = 'none'; }} />
              <button type="button" onClick={() => setForm(f => ({ ...f, logo: '' }))}
                className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-red-50 hover:text-red-500 shadow-lg active:scale-95 transition-all opacity-0 group-hover:opacity-100">
                <Trash2 size={16} />
              </button>
            </motion.div>
          )}
        </div>

        <button type="submit" disabled={saving}
          className="w-full bg-[#5A5A40] text-white py-4 mt-6 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-md hover:shadow-xl">
          {saving ? <><Loader2 size={18} className="animate-spin" /> Registering...</> : <><Store size={18} /> Submit for Approval</>}
        </button>
      </form>

      {/* Map Picker Modal */}
      <AnimatePresence>
        {mapPickerOpen && (
          <MapPickerModal
            initialLat={form.lat ? +form.lat : null}
            initialLng={form.lng ? +form.lng : null}
            onConfirm={(lat, lng) => {
              setForm(f => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
              setMapPickerOpen(false);
            }}
            onClose={() => setMapPickerOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Map Picker Modal (Leaflet / OpenStreetMap) ───────────────────
function LocationMarker({ position, onMove }) {
  const map = useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    if (position) map.flyTo([position.lat, position.lng], map.getZoom(), { animate: true, duration: 0.5 });
  }, [position]);

  return position ? <Marker position={[position.lat, position.lng]} /> : null;
}

function MapPickerModal({ initialLat, initialLng, onConfirm, onClose }) {
  const defaultLat = initialLat || 17.385;
  const defaultLng = initialLng || 78.4867;
  const [pin, setPin] = useState({ lat: defaultLat, lng: defaultLng });
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [address, setAddress] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await resp.json();
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setPin({ lat, lng });
        setAddress(data[0].display_name);
      } else {
        alert('Location not found. Try a different search.');
      }
    } catch {
      alert('Search failed, check your connection.');
    } finally {
      setSearching(false);
    }
  };

  const handleMove = async (lat, lng) => {
    setPin({ lat, lng });
    // Reverse geocode for nice address label
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await resp.json();
      setAddress(data.display_name || '');
    } catch { /* silent */ }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#1A1A1A]/5">
          <h3 className="font-serif text-xl font-bold flex items-center gap-2">
            <MapPin size={20} className="text-[#5A5A40]" /> Pick Shop Location
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-3">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-[#F5F5F0] border border-[#1A1A1A]/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#5A5A40] transition-colors"
              placeholder="Search for city, area, street..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-5 py-2.5 bg-[#5A5A40] text-white rounded-xl text-sm font-bold hover:bg-[#4A4A30] active:scale-[0.97] transition-all disabled:opacity-60 flex items-center gap-2 shadow-sm"
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </button>
          </div>
          <p className="text-[11px] text-[#1A1A1A]/40 mt-2 flex items-center gap-1">
            <MapPin size={11} /> Click anywhere on the map to drop a pin
          </p>
        </div>

        {/* Map */}
        <div className="flex-1 relative" style={{ minHeight: 340 }}>
          <MapContainer
            center={[defaultLat, defaultLng]}
            zoom={14}
            style={{ height: '100%', width: '100%', minHeight: 340 }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker position={pin} onMove={handleMove} />
          </MapContainer>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1A1A1A]/5 bg-[#F9F9F6]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1A1A1A]/50 uppercase tracking-widest mb-0.5">Selected</p>
              <p className="text-sm font-semibold text-[#1A1A1A] tabular-nums">
                {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
              </p>
              {address && (
                <p className="text-[11px] text-[#1A1A1A]/40 mt-0.5 truncate max-w-xs">{address}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onConfirm(pin.lat, pin.lng)}
              className="shrink-0 flex items-center gap-2 px-6 py-3 bg-[#5A5A40] text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-[#4A4A30] active:scale-[0.97] transition-all shadow-md hover:shadow-lg"
            >
              <CheckCircle2 size={16} /> Confirm Location
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── SVG Chart Helpers ─────────────────────────────────────────────
const CHART_COLORS = ['#5A5A40', '#7A7A60', '#9A9A80', '#BABA9F', '#D4D4BF', '#8B6914', '#6B8E23', '#4682B4'];

function BarChart({ data, labelKey, valueKey, height = 200, color = '#5A5A40', formatValue = v => v }) {
  if (!data || !data.length) return null;
  const maxVal = Math.max(...data.map(d => d[valueKey]), 1);
  const barW = Math.min(48, Math.floor((100 / data.length) * 0.7));
  const gap = (100 - barW * data.length) / (data.length + 1);
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 500 ${height + 40}`} className="w-full min-w-[320px]" preserveAspectRatio="xMidYMid meet">
        {data.map((d, i) => {
          const barH = (d[valueKey] / maxVal) * height;
          const x = (gap + (barW + gap) * i) * 5;
          const y = height - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW * 5} height={barH} rx={6} fill={color} opacity={0.85} />
              <text x={x + (barW * 5) / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="#1A1A1A" fontWeight="700">
                {formatValue(d[valueKey])}
              </text>
              <text x={x + (barW * 5) / 2} y={height + 18} textAnchor="middle" fontSize="10" fill="#999">
                {d[labelKey]}
              </text>
            </g>
          );
        })}
        <line x1="0" y1={height} x2="500" y2={height} stroke="#e5e5e0" strokeWidth="1" />
      </svg>
    </div>
  );
}

function DonutChart({ data, labelKey, valueKey, size = 180 }) {
  if (!data || !data.length) return null;
  const total = data.reduce((s, d) => s + d[valueKey], 0);
  if (!total) return null;
  const cx = size / 2, cy = size / 2, r = size * 0.35, strokeW = size * 0.18;
  let cumAngle = -90;
  const arcs = data.map((d, i) => {
    const pct = d[valueKey] / total;
    const angle = pct * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const largeArc = angle > 180 ? 1 : 0;
    const toRad = a => (a * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    return { ...d, pct, path: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`, color: CHART_COLORS[i % CHART_COLORS.length] };
  });
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a, i) => (
          <path key={i} d={a.path} fill="none" stroke={a.color} strokeWidth={strokeW} strokeLinecap="round" />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="20" fontWeight="800" fill="#1A1A1A">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#999">Total</text>
      </svg>
      <div className="flex flex-col gap-1.5 text-xs">
        {arcs.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
            <span className="text-[#1A1A1A]/60">{a[labelKey]}</span>
            <span className="font-bold ml-auto">{a[valueKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniLineChart({ data, valueKey, height = 60, width = 200, color = '#5A5A40' }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d[valueKey]);
  const maxV = Math.max(...vals, 1);
  const minV = Math.min(...vals, 0);
  const range = maxV - minV || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width;
    const y = height - ((v - minV) / range) * (height - 10) - 5;
    return `${x},${y}`;
  });
  const areaPath = `M0,${height} L${pts.join(' L')} L${width},${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaGrad)" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {vals.map((v, i) => {
        const x = (i / (vals.length - 1)) * width;
        const y = height - ((v - minV) / range) * (height - 10) - 5;
        return <circle key={i} cx={x} cy={y} r="3" fill="white" stroke={color} strokeWidth="2" />;
      })}
    </svg>
  );
}

// ── Billing Panel (Walk-in POS) ───────────────────────────────────
function BillingPanel({ shopId, shops, selectedShop, onShopChange, setTab }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [bill, setBill]         = useState([]);        // { product, quantity }
  const [customerName, setCustomerName] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [walkinPayMethod, setWalkinPayMethod] = useState('cash');
  const [placing, setPlacing]   = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [productDiscounts, setProductDiscounts] = useState([]);
  const [orderDiscounts, setOrderDiscounts] = useState([]);
  const [shopUpiId, setShopUpiId] = useState('');
  const [shopName, setShopName] = useState('');
  const [showUpiQR, setShowUpiQR] = useState(false);
  const [upiOrderData, setUpiOrderData] = useState(null);
  const [upiCountdown, setUpiCountdown] = useState(60);
  const [upiPaymentReceived, setUpiPaymentReceived] = useState(false);
  const upiTimerRef = useRef(null);
  const upiPollRef = useRef(null);

  // Quick-add product from billing
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [newBillDone, setNewBillDone] = useState(false);
  const [showShopDropdown, setShowShopDropdown] = useState(false);
  const shopDropdownRef = useRef(null);

  const handleNewBill = () => {
    setBill([]);
    setCustomerName('');
    setNewBillDone(true);
    setTimeout(() => setNewBillDone(false), 2000);
  };
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPrice, setQuickAddPrice] = useState('');
  const [quickAddUnit, setQuickAddUnit] = useState('pcs');
  const [quickAddStock, setQuickAddStock] = useState('50');
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  const handleQuickAddProduct = async () => {
    if (!quickAddName || !quickAddPrice) return;
    setQuickAddSaving(true);
    try {
      const p = parseFloat(quickAddPrice);
      await createProduct(shopId, {
        name: quickAddName, price: p, mrp: p,
        unit: quickAddUnit, stock: parseInt(quickAddStock) || 50,
        category: 'Grocery',
      });
      setShowQuickAdd(false);
      setSearch(quickAddName);
      setQuickAddPrice(''); setQuickAddUnit('pcs'); setQuickAddStock('50');
      // Reload products
      const res = await listProducts(shopId, false);
      setProducts(res.data || []);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add product');
    } finally { setQuickAddSaving(false); }
  };

  const cleanupUpiTimers = () => {
    if (upiTimerRef.current) { clearInterval(upiTimerRef.current); upiTimerRef.current = null; }
    if (upiPollRef.current) { clearInterval(upiPollRef.current); upiPollRef.current = null; }
  };

  const startUpiMonitoring = (orderData) => {
    cleanupUpiTimers();
    setUpiCountdown(60);
    setUpiPaymentReceived(false);
    setUpiOrderData(orderData);
    setShowUpiQR(true);

    // Countdown timer — tick every second
    let remaining = 60;
    upiTimerRef.current = setInterval(() => {
      remaining -= 1;
      setUpiCountdown(remaining);
      if (remaining <= 0) {
        cleanupUpiTimers();
        // Timeout — close modal, keep order as pending
        setShowUpiQR(false);
        setLastOrder(orderData);
        setUpiOrderData(null);
      }
    }, 1000);

    // Poll payment status every 3 seconds
    upiPollRef.current = setInterval(async () => {
      try {
        const res = await getOrderPaymentStatus(orderData.id);
        if (res.data.payment_status === 'paid') {
          cleanupUpiTimers();
          setUpiPaymentReceived(true);
          // Auto-close after 2 seconds
          setTimeout(() => {
            setShowUpiQR(false);
            setLastOrder({ ...orderData, payment_status: 'paid', payment_method: 'upi' });
            setUpiOrderData(null);
            setUpiPaymentReceived(false);
          }, 2000);
        }
      } catch { /* ignore poll errors */ }
    }, 3000);
  };

  const handlePaymentReceived = async () => {
    if (!upiOrderData) return;
    try {
      await markOrderPaymentStatus(upiOrderData.id, 'paid');
    } catch { /* ignore */ }
    cleanupUpiTimers();
    setUpiPaymentReceived(true);
    // Show success animation for 2s, then close
    setTimeout(() => {
      setShowUpiQR(false);
      setLastOrder({ ...upiOrderData, payment_status: 'paid', payment_method: 'upi' });
      setUpiOrderData(null);
      setUpiPaymentReceived(false);
    }, 2000);
  };

  const handleUpiClose = () => {
    cleanupUpiTimers();
    setShowUpiQR(false);
    setLastOrder(upiOrderData);
    setUpiOrderData(null);
    setUpiPaymentReceived(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (shopDropdownRef.current && !shopDropdownRef.current.contains(e.target)) {
        setShowShopDropdown(false);
      }
    };
    if (showShopDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showShopDropdown]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listProducts(shopId),
      listProductDiscounts(shopId),
      listOrderDiscounts(shopId),
      getShopUPI(shopId),
    ])
      .then(([pRes, pdRes, odRes, upiRes]) => {
        setProducts(pRes.data);
        setProductDiscounts(pdRes.data);
        setOrderDiscounts(odRes.data);
        setShopUpiId(upiRes.data.upi_id || '');
        setShopName(upiRes.data.shop_name || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [shopId]);

  const addToBill = (product) => {
    setBill(prev => {
      const existing = prev.find(b => b.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(b => b.product.id === product.id ? { ...b, quantity: b.quantity + 1 } : b);
      }
      if (product.stock < 1) return prev;
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId, delta) => {
    setBill(prev => prev.map(b => {
      if (b.product.id !== productId) return b;
      const newQty = b.quantity + delta;
      if (newQty < 1) return b;
      if (newQty > b.product.stock) return b;
      return { ...b, quantity: newQty };
    }));
  };

  const removeFromBill = (productId) => {
    setBill(prev => prev.filter(b => b.product.id !== productId));
  };

  const isOfferValid = (validTill) => !validTill || new Date(validTill) >= new Date();

  const calculations = useMemo(() => {
    let subtotal = 0;
    let itemDiscounts = 0;

    bill.forEach(({ product: p, quantity }) => {
      const itemTotal = p.price * quantity;
      subtotal += itemTotal;

      const discount = productDiscounts.find(d => d.product_id === p.id && d.status === 'active' && isOfferValid(d.valid_till));
      if (discount) {
        if (discount.type === 'bogo') {
          const freeQty = Math.floor(quantity / 2);
          itemDiscounts += freeQty * p.price;
        } else if (discount.type === 'buy_x_get_y') {
          const freeQty = Math.floor(quantity / ((discount.buy_qty || 1) + (discount.get_qty || 1))) * (discount.get_qty || 1);
          itemDiscounts += freeQty * p.price;
        } else if (discount.type === 'bulk_price') {
          if (quantity >= (discount.buy_qty || 1)) {
            const sets = Math.floor(quantity / discount.buy_qty);
            const remainder = quantity % discount.buy_qty;
            const discountedPrice = (sets * (discount.bulk_price || 0)) + (remainder * p.price);
            itemDiscounts += (itemTotal - discountedPrice);
          }
        } else if (discount.type === 'individual') {
          if (discount.discount_value) {
            if (discount.discount_amount_type === 'percentage') {
              itemDiscounts += (itemTotal * discount.discount_value) / 100;
            } else {
              // flat amount
              itemDiscounts += discount.discount_value * quantity;
            }
          }
        }
      }
    });

    const intermediateTotal = subtotal - itemDiscounts;
    let billDiscount = 0;
    const applicableOrderDiscount = orderDiscounts
      .filter(d => d.status === 'active' && intermediateTotal >= d.min_bill_value && isOfferValid(d.valid_till))
      .sort((a, b) => b.min_bill_value - a.min_bill_value)[0];

    if (applicableOrderDiscount) {
      if (applicableOrderDiscount.discount_type === 'percentage') {
        billDiscount = (intermediateTotal * applicableOrderDiscount.discount_value) / 100;
      } else {
        billDiscount = applicableOrderDiscount.discount_value;
      }
    }

    const nextDiscount = orderDiscounts
      .filter(d => d.status === 'active' && intermediateTotal < d.min_bill_value && isOfferValid(d.valid_till))
      .sort((a, b) => a.min_bill_value - b.min_bill_value)[0];

    const finalTotal = Math.max(0, intermediateTotal - billDiscount);

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      itemDiscounts: Math.round(itemDiscounts * 100) / 100,
      billDiscount: Math.round(billDiscount * 100) / 100,
      total: Math.round(finalTotal * 100) / 100,
      appliedOrderDiscount: applicableOrderDiscount,
      nextDiscount,
      remainingForNext: nextDiscount ? Math.round((nextDiscount.min_bill_value - intermediateTotal) * 100) / 100 : 0,
      totalDiscount: Math.round((itemDiscounts + billDiscount) * 100) / 100,
    };
  }, [bill, productDiscounts, orderDiscounts]);

  const billTotal = calculations.total;

  const buildQrValue = (amount, orderId) => {
    const isDev = import.meta.env.DEV;
    if (isDev) {
      // Dev: direct upi://pay link — owner manually confirms
      const pa = encodeURIComponent(shopUpiId);
      const pn = encodeURIComponent(shopName);
      const tn = encodeURIComponent(`Order ${orderId}`);
      return `upi://pay?pa=${pa}&pn=${pn}&am=${amount.toFixed(2)}&cu=INR&tn=${tn}`;
    }
    // Production: payment page with auto-detection
    const baseUrl = import.meta.env.VITE_API_URL || '';
    return `${baseUrl}/pay/${orderId}`;
  };

  const handlePlaceOrder = async () => {
    if (!bill.length) return;
    setPlacing(true);
    try {
      const res = await placeWalkinOrder(shopId, {
        items: bill.map(b => ({ product_id: b.product.id, quantity: b.quantity })),
        customer_name: customerName || 'Walk-in Customer',
        payment_method: walkinPayMethod,
        payment_status: walkinPayMethod === 'upi' ? 'pending' : paymentStatus,
        subtotal: calculations.subtotal,
        item_discounts: calculations.itemDiscounts,
        bill_discount: calculations.billDiscount,
        total_discount: calculations.totalDiscount,
      });

      setBill([]);
      setCustomerName('');
      const pRes = await listProducts(shopId);
      setProducts(pRes.data);

      // If UPI selected, show QR code for PhonePe/GPay/Paytm
      if (walkinPayMethod === 'upi') {
        if (!shopUpiId) {
          alert('No UPI ID configured. Go to Settings to add your UPI ID.');
          setLastOrder(res.data);
          setPlacing(false);
          return;
        }
        startUpiMonitoring(res.data);
        setPlacing(false);
        return;
      }

      setLastOrder(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  const filtered = products.filter(p => p.status === 'active' && p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-[#5A5A40]" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Product Grid */}
      <div className="lg:col-span-3 space-y-4">
        {/* Shop Selector */}
        {shops && shops.length > 1 && (
          <div className="relative" ref={shopDropdownRef}>
            <button
              onClick={() => setShowShopDropdown(!showShopDropdown)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm font-medium text-left outline-none hover:border-[#5A5A40] transition-colors flex items-center justify-between"
            >
              <span>{selectedShop?.name}</span>
              <ChevronRight size={14} className={`text-[#1A1A1A]/30 transition-transform ${showShopDropdown ? 'rotate-90' : ''}`} />
            </button>
            <Store size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 pointer-events-none" />
            {showShopDropdown && (
              <div className="absolute top-full mt-2 w-full bg-white border border-[#1A1A1A]/10 rounded-2xl shadow-lg z-10">
                {shops.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onShopChange(s);
                      setShowShopDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors first:rounded-t-2xl last:rounded-b-2xl ${
                      s.id === selectedShop?.id
                        ? 'bg-[#5A5A40] text-white'
                        : 'hover:bg-[#F5F5F0]'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" />
          <input className="w-full pl-11 pr-4 py-3 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm font-medium outline-none focus:border-[#5A5A40] transition-colors"
            placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map(p => {
            const inBill = bill.find(b => b.product.id === p.id);
            const hasDiscount = productDiscounts.find(d => d.product_id === p.id && d.status === 'active' && isOfferValid(d.valid_till));
            return (
              <button key={p.id} onClick={() => addToBill(p)} disabled={p.stock < 1}
                className={`text-left bg-white border rounded-2xl p-4 transition-all hover:shadow-md disabled:opacity-40 relative ${inBill ? 'border-[#5A5A40] ring-1 ring-[#5A5A40]/20' : 'border-[#1A1A1A]/10'}`}>
                {hasDiscount && (
                  <span className="absolute top-2 right-2 bg-green-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase">
                    {hasDiscount.type === 'bogo' ? 'BOGO' : hasDiscount.type === 'buy_x_get_y' ? `B${hasDiscount.buy_qty}G${hasDiscount.get_qty}` : hasDiscount.type === 'bulk_price' ? 'Bulk' : 'Offer'}
                  </span>
                )}
                {p.image && <img src={fixImageUrl(p.image)} alt={p.name} className="w-full h-20 object-cover rounded-xl mb-2" referrerPolicy="no-referrer" />}
                <p className="font-bold text-sm line-clamp-1">{p.name}</p>
                <p className="text-xs text-[#1A1A1A]/40">{p.unit} · Stock: {p.stock}</p>
                <p className="font-bold text-[#5A5A40] mt-1">₹{p.price}</p>
                {inBill && <span className="text-[10px] font-bold text-[#5A5A40] bg-[#5A5A40]/10 px-2 py-0.5 rounded-full mt-1 inline-block">×{inBill.quantity}</span>}
              </button>
            );
          })}
          {filtered.length === 0 && search.trim() && (
            <div className="col-span-full">
              {!showQuickAdd ? (
                <div className="text-center py-10">
                  <Package size={32} className="mx-auto text-[#1A1A1A]/15 mb-3" />
                  <p className="text-sm text-[#1A1A1A]/40 mb-4">No products found for &ldquo;{search}&rdquo;</p>
                  <button
                    onClick={() => { setQuickAddName(search.trim()); setShowQuickAdd(true); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5A5A40] text-white rounded-xl text-sm font-bold hover:bg-[#4A4A30] transition-all shadow-md"
                  >
                    <Plus size={16} /> Add &ldquo;{search}&rdquo; as New Product
                  </button>
                </div>
              ) : (
                <div className="bg-white border-2 border-[#5A5A40]/30 rounded-2xl p-5 max-w-md mx-auto">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-[#5A5A40] rounded-lg flex items-center justify-center">
                      <Plus size={14} className="text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">Quick Add Product</h4>
                      <p className="text-[10px] text-[#1A1A1A]/40">Fill in details and add to inventory</p>
                    </div>
                    <button onClick={() => setShowQuickAdd(false)} className="ml-auto w-7 h-7 flex items-center justify-center hover:bg-[#F5F5F0] rounded-lg">
                      <X size={14} className="text-[#1A1A1A]/40" />
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    <input value={quickAddName} onChange={e => setQuickAddName(e.target.value)} autoFocus
                      className="w-full px-3.5 py-2.5 bg-[#F5F5F0] rounded-xl text-sm font-medium outline-none focus:ring-2 ring-[#5A5A40]/20" placeholder="Product name" />
                    <div className="grid grid-cols-3 gap-2">
                      <input value={quickAddPrice} onChange={e => setQuickAddPrice(e.target.value)} type="number" step="0.01"
                        className="w-full px-3.5 py-2.5 bg-[#F5F5F0] rounded-xl text-sm font-medium outline-none focus:ring-2 ring-[#5A5A40]/20" placeholder="Price ₹" />
                      <select value={quickAddUnit} onChange={e => setQuickAddUnit(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#F5F5F0] rounded-xl text-sm font-medium outline-none focus:ring-2 ring-[#5A5A40]/20">
                        {['pcs', 'kg', 'g', 'L', 'ml', 'pack', 'dozen', 'bottle'].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input value={quickAddStock} onChange={e => setQuickAddStock(e.target.value)} type="number"
                        className="w-full px-3.5 py-2.5 bg-[#F5F5F0] rounded-xl text-sm font-medium outline-none focus:ring-2 ring-[#5A5A40]/20" placeholder="Stock" />
                    </div>
                  </div>
                  <button onClick={handleQuickAddProduct} disabled={quickAddSaving || !quickAddName || !quickAddPrice}
                    className="w-full mt-4 bg-[#5A5A40] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] disabled:opacity-40 transition-all text-sm">
                    {quickAddSaving ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} /> Add &amp; Continue Billing</>}
                  </button>
                </div>
              )}
            </div>
          )}
          {filtered.length === 0 && !search.trim() && <p className="col-span-full text-center text-[#1A1A1A]/30 py-10 italic">No products yet</p>}
        </div>
      </div>

      {/* Bill Summary */}
      <div className="lg:col-span-2">
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 sticky top-4">
          <div className="flex items-center gap-2 mb-5">
            <Receipt size={20} className="text-[#5A5A40]" />
            <h3 className="font-serif text-xl font-bold">Current Bill</h3>
          </div>

          {/* Product Search in Bill */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 pointer-events-none" />
            <input className="w-full pl-11 pr-4 py-2.5 bg-[#F5F5F0] border border-[#1A1A1A]/5 rounded-xl text-sm outline-none focus:border-[#5A5A40] transition-colors"
              placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Quick Product Add Suggestions */}
          {search.trim() && filtered.length > 0 && (
            <div className="mb-4 max-h-40 overflow-y-auto">
              <div className="space-y-2">
                {filtered.slice(0, 5).map(p => (
                  <button
                    key={p.id}
                    onClick={() => { addToBill(p); setSearch(''); }}
                    disabled={p.stock < 1}
                    className="w-full text-left bg-white border border-[#1A1A1A]/10 rounded-lg px-3 py-2 hover:border-[#5A5A40] disabled:opacity-40 transition-colors"
                  >
                    <p className="font-semibold text-sm">{p.name}</p>
                    <p className="text-xs text-[#1A1A1A]/40">₹{p.price} • Stock: {p.stock}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customer Name */}
          <input className="w-full bg-[#F5F5F0] border border-[#1A1A1A]/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#5A5A40] transition-colors mb-4"
            placeholder="Customer name (optional)" value={customerName} onChange={e => setCustomerName(e.target.value)} />

          {bill.length === 0 ? (
            <div className="py-10 text-center">
              <ShoppingBag size={32} className="mx-auto text-[#1A1A1A]/15 mb-2" />
              <p className="text-sm text-[#1A1A1A]/30 italic">Tap products to add</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[40vh] overflow-y-auto mb-4">
              {bill.map(b => {
                const hasOffer = productDiscounts.find(d => d.product_id === b.product.id && d.status === 'active' && isOfferValid(d.valid_till));
                return (
                <div key={b.product.id} className="flex items-center gap-3 bg-[#F5F5F0] rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-sm line-clamp-1">{b.product.name}</p>
                      {hasOffer && <span className="bg-green-100 text-green-700 text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0">Offer</span>}
                    </div>
                    <p className="text-xs text-[#1A1A1A]/40">₹{b.product.price} × {b.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(b.product.id, -1)} className="w-7 h-7 flex items-center justify-center bg-white rounded-lg border border-[#1A1A1A]/10 hover:bg-[#1A1A1A]/5"><Minus size={12} /></button>
                    <span className="w-8 text-center text-sm font-bold">{b.quantity}</span>
                    <button onClick={() => updateQty(b.product.id, 1)} className="w-7 h-7 flex items-center justify-center bg-white rounded-lg border border-[#1A1A1A]/10 hover:bg-[#1A1A1A]/5"><Plus size={12} /></button>
                  </div>
                  <p className="font-bold text-sm w-16 text-right">₹{(b.product.price * b.quantity).toFixed(2)}</p>
                  <button onClick={() => removeFromBill(b.product.id)} className="p-1 hover:bg-red-100 rounded-lg text-red-500"><X size={14} /></button>
                </div>
                );
              })}
            </div>
          )}

          {bill.length > 0 && (
            <>
              <div className="border-t border-[#1A1A1A]/10 pt-4 mb-4 space-y-2">
                {calculations.remainingForNext > 0 && (
                  <div className="bg-[#5A5A40]/5 border border-[#5A5A40]/10 rounded-xl p-3 mb-3">
                    <p className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-widest text-center">
                      Shop for ₹{calculations.remainingForNext} more to unlock {calculations.nextDiscount?.discount_type === 'percentage' ? `${calculations.nextDiscount.discount_value}%` : `₹${calculations.nextDiscount?.discount_value}`} OFF!
                    </p>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-[#1A1A1A]/50">Items</span>
                  <span className="font-bold">{bill.reduce((s, b) => s + b.quantity, 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#1A1A1A]/50 font-bold uppercase tracking-widest text-[10px]">Subtotal</span>
                  <span className="font-bold">₹{calculations.subtotal.toFixed(2)}</span>
                </div>
                {calculations.itemDiscounts > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="font-bold uppercase tracking-widest text-[10px]">Item Offers</span>
                    <span className="font-bold">- ₹{calculations.itemDiscounts.toFixed(2)}</span>
                  </div>
                )}
                {calculations.billDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="font-bold uppercase tracking-widest text-[10px]">Bill Offer (₹{calculations.appliedOrderDiscount?.min_bill_value}+)</span>
                    <span className="font-bold">- ₹{calculations.billDiscount.toFixed(2)}</span>
                  </div>
                )}
                {calculations.totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-red-500 pt-2 border-t border-dashed border-[#1A1A1A]/10">
                    <span className="font-bold uppercase tracking-widest text-[10px]">Total Discount</span>
                    <span className="font-bold">₹{calculations.totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-[#1A1A1A]/5">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-serif text-2xl font-bold text-[#5A5A40]">₹{billTotal.toFixed(2)}</span>
                </div>
              </div>
              {/* Payment Method */}
              <div className="mb-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1.5">Payment Method</p>
                <div className="flex gap-2">
                  {[
                    { key: 'cash', label: '💵 Cash' },
                    { key: 'upi',  label: '📱 UPI (QR Code)' },
                  ].map(m => (
                    <button key={m.key} onClick={() => setWalkinPayMethod(m.key)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${walkinPayMethod === m.key ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#1A1A1A]/50 border-[#1A1A1A]/10 hover:border-[#5A5A40]'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {walkinPayMethod === 'upi' && (
                  <p className="text-[10px] text-[#5A5A40] mt-1.5 text-center font-medium">
                    {shopUpiId ? 'Customer scans QR with PhonePe / GPay / Paytm' : '⚠️ Set your UPI ID in Settings first'}
                  </p>
                )}
              </div>
              {/* Payment Status — only for cash */}
              {walkinPayMethod !== 'upi' && (
              <div className="flex gap-2 mb-4">
                {['paid', 'pending'].map(s => (
                  <button key={s} onClick={() => setPaymentStatus(s)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${paymentStatus === s ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#1A1A1A]/50 border-[#1A1A1A]/10 hover:border-[#5A5A40]'}`}>
                    {s === 'paid' ? '✓ Paid' : '⏳ Pending'}
                  </button>
                ))}
              </div>
              )}
              <button onClick={handlePlaceOrder} disabled={placing}
                className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {placing ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : walkinPayMethod === 'upi' ? <><Receipt size={18} /> Pay ₹{billTotal.toFixed(2)} via UPI</> : <><Receipt size={18} /> Bill ₹{billTotal.toFixed(2)}</>}
              </button>
            </>
          )}

          {/* UPI QR Code Modal */}
          <AnimatePresence>
            {showUpiQR && upiOrderData && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={handleUpiClose}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
                  onClick={e => e.stopPropagation()}>

                  {/* Payment received state */}
                  {upiPaymentReceived ? (
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="py-4">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                        className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                        <CheckCircle2 size={52} className="text-green-600" />
                      </motion.div>
                      <h3 className="font-serif text-2xl font-bold text-green-700 mb-2">Payment Successful!</h3>
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-3">
                        <p className="font-serif text-4xl font-bold text-green-700">₹{upiOrderData.total?.toFixed(2)}</p>
                        <p className="text-sm text-green-600 mt-1 font-medium">Paid via UPI</p>
                      </div>
                      <div className="space-y-1 text-sm text-green-600/80">
                        <p>Order #{upiOrderData.id} · {shopName}</p>
                        <p className="text-xs">Paid to: {shopUpiId}</p>
                      </div>
                    </motion.div>
                  ) : (
                    <>
                      <div className="mb-4">
                        <div className="w-14 h-14 bg-[#5A5A40]/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <span className="text-2xl">📱</span>
                        </div>
                        <h3 className="font-serif text-xl font-bold">Scan & Pay</h3>
                        <p className="text-xs text-[#1A1A1A]/50 mt-1">Order #{upiOrderData.id} · {shopName}</p>
                      </div>

                      {/* Countdown timer */}
                      <div className="mb-3">
                        <div className="relative w-16 h-16 mx-auto">
                          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" stroke="#e5e5e5" strokeWidth="4" fill="none" />
                            <circle cx="32" cy="32" r="28" stroke={upiCountdown <= 10 ? '#ef4444' : '#5A5A40'} strokeWidth="4" fill="none"
                              strokeDasharray={`${(upiCountdown / 60) * 175.9} 175.9`}
                              strokeLinecap="round" className="transition-all duration-1000" />
                          </svg>
                          <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${upiCountdown <= 10 ? 'text-red-500' : 'text-[#5A5A40]'}`}>
                            {upiCountdown}s
                          </span>
                        </div>
                      </div>

                      <div className="bg-white border-2 border-[#5A5A40]/20 rounded-2xl p-5 inline-block mb-4">
                        <QRCodeSVG
                          value={buildQrValue(upiOrderData.total, upiOrderData.id)}
                          size={200}
                          level="H"
                          includeMargin={false}
                          bgColor="#ffffff"
                          fgColor="#1A1A1A"
                        />
                      </div>

                      <div className="mb-3">
                        <p className="font-serif text-3xl font-bold text-[#5A5A40]">₹{upiOrderData.total?.toFixed(2)}</p>
                        <p className="text-xs text-[#1A1A1A]/40 mt-1 font-medium">Pay to: {shopUpiId}</p>
                      </div>

                      <div className="flex items-center justify-center gap-4 mb-3">
                        <span className="bg-[#5f259f]/10 text-[#5f259f] text-[10px] font-bold px-3 py-1.5 rounded-full">PhonePe</span>
                        <span className="bg-[#137333]/10 text-[#137333] text-[10px] font-bold px-3 py-1.5 rounded-full">GPay</span>
                        <span className="bg-[#00BAF2]/10 text-[#00BAF2] text-[10px] font-bold px-3 py-1.5 rounded-full">Paytm</span>
                        <span className="bg-[#1A1A1A]/5 text-[#1A1A1A]/50 text-[10px] font-bold px-3 py-1.5 rounded-full">Any UPI</span>
                      </div>

                      {/* Instruction + Confirm button */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                        <p className="text-xs text-amber-800 font-medium">👆 After customer pays, tap below to confirm</p>
                      </div>

                      <button onClick={handlePaymentReceived}
                        className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-base hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/30 mb-2">
                        <CheckCircle2 size={20} /> ₹{upiOrderData.total?.toFixed(2)} — Confirm Payment Received
                      </button>
                      <button onClick={handleUpiClose}
                        className="w-full py-2 rounded-xl text-sm font-bold text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70 transition-colors">
                        Keep Pending & Close
                      </button>
                    </>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Last Order Success */}
          <AnimatePresence>
            {lastOrder && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`mt-4 rounded-2xl p-4 border ${
                  lastOrder.payment_status === 'paid'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                <div className="flex items-center gap-2 mb-2">
                  {lastOrder.payment_status === 'paid' ? (
                    <CheckCircle2 size={18} className="text-green-600" />
                  ) : (
                    <Clock size={18} className="text-amber-600" />
                  )}
                  <span className={`font-bold text-sm ${
                    lastOrder.payment_status === 'paid' ? 'text-green-800' : 'text-amber-800'
                  }`}>Order #{lastOrder.id} placed!</span>
                  <span className={`ml-auto text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    lastOrder.payment_status === 'paid'
                      ? 'bg-green-200 text-green-800'
                      : 'bg-amber-200 text-amber-800'
                  }`}>
                    {lastOrder.payment_status === 'paid' ? '✓ Paid' : '⏳ Pending'}
                  </span>
                </div>
                <p className={`text-xs mb-3 ${lastOrder.payment_status === 'paid' ? 'text-green-700' : 'text-amber-700'}`}>
                  ₹{lastOrder.total} · {lastOrder.payment_method === 'upi' ? 'UPI Payment' : lastOrder.payment_method === 'cash' ? 'Cash Payment' : lastOrder.delivery_address}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setInvoiceOrder(lastOrder)}
                    className="flex-1 text-xs font-bold uppercase tracking-widest text-[#5A5A40] border border-[#5A5A40]/30 py-2 rounded-xl hover:bg-[#5A5A40]/5 transition-all">
                    View Invoice
                  </button>
                  {lastOrder.payment_status !== 'paid' && lastOrder.payment_method === 'upi' && (
                    <button onClick={() => startUpiMonitoring(lastOrder)}
                      className="flex-1 text-xs font-bold uppercase tracking-widest text-[#5A5A40] border border-[#5A5A40]/30 py-2 rounded-xl hover:bg-[#5A5A40]/5 transition-all">
                      Retry UPI
                    </button>
                  )}
                  <button onClick={() => setLastOrder(null)}
                    className="px-4 py-2 text-xs font-bold text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70 transition-colors">
                    Dismiss
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 mt-4">
          <h3 className="font-serif text-xl font-bold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setShowAddModal(true)}
              className="flex flex-col items-center justify-center gap-2 bg-[#5A5A40] text-white rounded-2xl py-5 font-bold text-xs uppercase tracking-widest hover:bg-[#4A4A30] transition-all active:scale-95">
              <Plus size={22} />
              Add Product
            </button>
            <button onClick={handleNewBill}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl py-5 font-bold text-xs uppercase tracking-widest transition-all active:scale-95 ${newBillDone ? 'bg-green-600 text-white' : 'bg-[#1A1A1A] text-white hover:bg-black'}`}>
              <ClipboardList size={22} />
              {newBillDone ? '✓ Cleared!' : 'New Bill'}
            </button>
            <button onClick={() => setTab('Settings')}
              className="flex flex-col items-center justify-center gap-2 bg-[#F5F5F0] text-[#1A1A1A] rounded-2xl py-5 font-bold text-xs uppercase tracking-widest hover:bg-[#EBEBDB] transition-all active:scale-95">
              <Settings size={22} />
              Settings
            </button>
            <button onClick={() => setShowSupportModal(true)}
              className="flex flex-col items-center justify-center gap-2 bg-[#F5F5F0] text-[#1A1A1A] rounded-2xl py-5 font-bold text-xs uppercase tracking-widest hover:bg-[#EBEBDB] transition-all active:scale-95">
              <Phone size={22} />
              Support
            </button>
          </div>
        </div>

        {invoiceOrder && <InvoiceModal order={invoiceOrder} shopView onClose={() => setInvoiceOrder(null)} />}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <ProductModal
            shopId={shopId}
            product={null}
            onSave={async () => {
              setShowAddModal(false);
              const pRes = await listProducts(shopId);
              setProducts(pRes.data);
            }}
            onClose={() => setShowAddModal(false)}
          />
        )}
        {showSupportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowSupportModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-2xl font-bold">Support</h3>
                <button onClick={() => setShowSupportModal(false)} className="p-2 hover:bg-[#F5F5F0] rounded-full"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <a href="tel:+911800123456"
                  className="flex items-center gap-4 p-4 bg-[#F5F5F0] rounded-2xl hover:bg-[#EBEBDB] transition-colors no-underline text-[#1A1A1A]">
                  <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center shrink-0">
                    <Phone size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Call Support</p>
                    <p className="text-xs text-[#1A1A1A]/50">1800-123-456 · Mon–Sat 9am–6pm</p>
                  </div>
                </a>
                <a href="https://wa.me/911800123456" target="_blank" rel="noreferrer"
                  className="flex items-center gap-4 p-4 bg-[#F5F5F0] rounded-2xl hover:bg-[#EBEBDB] transition-colors no-underline text-[#1A1A1A]">
                  <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shrink-0">
                    <MessageCircle size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">WhatsApp</p>
                    <p className="text-xs text-[#1A1A1A]/50">Chat with us anytime</p>
                  </div>
                </a>
                <a href="mailto:support@hypermart.in"
                  className="flex items-center gap-4 p-4 bg-[#F5F5F0] rounded-2xl hover:bg-[#EBEBDB] transition-colors no-underline text-[#1A1A1A]">
                  <div className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center shrink-0">
                    <MessageCircle size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Email</p>
                    <p className="text-xs text-[#1A1A1A]/50">support@hypermart.in</p>
                  </div>
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Analytics Panel ───────────────────────────────────────────────
function AnalyticsPanel({ analytics, shopName, shopId }) {
  const { aiAvailable } = useApp();
  const [stockInsight, setStockInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);

  // Date-range reports state
  const today = new Date().toISOString().split('T')[0];
  const [reportRange, setReportRange] = useState('7');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(today);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const handleRangeChange = (days) => {
    setReportRange(days);
    setSelectedDate(null);
    if (days !== 'custom') {
      const d = new Date();
      d.setDate(d.getDate() - parseInt(days));
      setDateFrom(d.toISOString().split('T')[0]);
      setDateTo(today);
    }
  };

  const handleDateSelect = (dateStr) => {
    setSelectedDate(dateStr);
    setReportRange('custom');
    setDateFrom(dateStr);
    setDateTo(dateStr);
  };

  const fetchReport = async () => {
    if (!shopId) return;
    setReportLoading(true);
    try {
      const res = await getShopReports(shopId, dateFrom, dateTo);
      setReportData(res.data);
    } catch { /* silent */ }
    finally { setReportLoading(false); }
  };

  useEffect(() => { if (shopId) fetchReport(); }, [shopId, dateFrom, dateTo]);

  const handleExportCSV = async () => {
    if (!shopId) return;
    setExporting(true);
    try {
      const res = await exportShopCSV(shopId, dateFrom, dateTo);
      const url = URL.createObjectURL(res.data);
      Object.assign(document.createElement('a'), { href: url, download: `report-${dateFrom}-${dateTo}.csv` }).click();
      URL.revokeObjectURL(url);
    } catch { alert('Export failed'); }
    finally { setExporting(false); }
  };

  if (!analytics) return (
    <div className="py-20 text-center">
      <BarChart2 size={48} className="mx-auto text-[#5A5A40]/20 mb-4" />
      <p className="text-[#1A1A1A]/30 italic">Analytics available after shop is approved.</p>
    </div>
  );

  const dailySales = analytics.daily_sales || [];
  const categoryRevenue = analytics.category_revenue || [];
  const topProducts = analytics.top_products || [];
  const monthlyRevenue = analytics.monthly_revenue || [];
  const lowStock = analytics.low_stock_items || [];

  const handleStockInsight = async () => {
    if (!lowStock.length) return;
    setInsightLoading(true);
    try {
      const res = await getLowStockInsight(shopId, shopName || 'your shop', lowStock.map(i => i.name));
      setStockInsight(res.data.insight || '');
    } catch { /* silent */ }
    finally { setInsightLoading(false); }
  };

  return (
    <div className="space-y-6">
      {/* Date-Range Reports Section */}
      <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-[#5A5A40]" />
            <h4 className="font-serif text-lg font-bold">
              Reports{selectedDate && (
                <span className="text-sm font-normal text-[#1A1A1A]/60 ml-2">
                  for {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </h4>
          </div>
          <button onClick={handleExportCSV} disabled={exporting || !reportData}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#F5F5F0] rounded-xl text-xs font-bold text-[#5A5A40] hover:bg-[#5A5A40]/10 transition-all disabled:opacity-40 border border-[#5A5A40]/20">
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            Export CSV
          </button>
        </div>

        {/* Range selector */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[{ label: 'Today', val: '0' }, { label: '7 Days', val: '7' }, { label: '30 Days', val: '30' }, { label: 'Custom', val: 'custom' }].map(r => (
            <button key={r.val} onClick={() => handleRangeChange(r.val)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${reportRange === r.val ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#1A1A1A]/60 border-[#1A1A1A]/10 hover:border-[#5A5A40]/30'}`}>
              {r.label}
            </button>
          ))}
        </div>

        {reportRange === 'custom' && (
          <div className="flex gap-3 mb-4">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo}
              className="px-3 py-2 border border-[#1A1A1A]/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]" />
            <span className="self-center text-[#1A1A1A]/30">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom}
              className="px-3 py-2 border border-[#1A1A1A]/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]" />
          </div>
        )}

        {/* Report KPIs */}
        {reportLoading ? (
          <div className="py-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-[#5A5A40]" /></div>
        ) : reportData ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#F5F5F0] rounded-2xl p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Revenue</p>
              <p className="font-serif text-xl font-bold">₹{reportData.total_revenue}</p>
            </div>
            <div className="bg-[#F5F5F0] rounded-2xl p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Orders</p>
              <p className="font-serif text-xl font-bold">{reportData.total_orders}</p>
            </div>
            <div className="bg-[#F5F5F0] rounded-2xl p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Avg Order</p>
              <p className="font-serif text-xl font-bold">₹{reportData.avg_order_value}</p>
            </div>
          </div>
        ) : null}
      </div>
      {/* Daily Sales Calendar With Walk-in and Online Breakdown */}
      <DailySalesCalendar analytics={analytics} onDateSelect={handleDateSelect} selectedDate={selectedDate} reportData={selectedDate ? reportData : null} />

      {/* Daily Sales Chart */}
      <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={18} className="text-[#5A5A40]" />
          <h4 className="font-serif text-lg font-bold">Daily Sales (Last 7 days)</h4>
        </div>
        <p className="text-xs text-[#1A1A1A]/40 mb-4">Revenue per day</p>
        {dailySales.length > 0 ? (
          <BarChart data={dailySales} labelKey="day" valueKey="revenue" color="#5A5A40" formatValue={v => `₹${v}`} />
        ) : <p className="text-sm text-[#1A1A1A]/30 italic py-8 text-center">No data yet</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Trend */}
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={18} className="text-[#5A5A40]" />
            <h4 className="font-serif text-lg font-bold">Revenue Trend</h4>
          </div>
          <p className="text-xs text-[#1A1A1A]/40 mb-4">Last 6 months</p>
          {monthlyRevenue.length > 0 ? (
            <>
              <MiniLineChart data={monthlyRevenue} valueKey="revenue" height={100} width={400} color="#5A5A40" />
              <div className="flex justify-between mt-2 text-[10px] text-[#1A1A1A]/40">
                {monthlyRevenue.map(m => <span key={m.month}>{m.month}</span>)}
              </div>
            </>
          ) : <p className="text-sm text-[#1A1A1A]/30 italic py-8 text-center">No data yet</p>}
        </div>

        {/* Category Revenue */}
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <PieChart size={18} className="text-[#5A5A40]" />
            <h4 className="font-serif text-lg font-bold">Revenue by Category</h4>
          </div>
          <p className="text-xs text-[#1A1A1A]/40 mb-4">All time distribution</p>
          {categoryRevenue.length > 0 ? (
            <DonutChart data={categoryRevenue} labelKey="category" valueKey="revenue" size={180} />
          ) : <p className="text-sm text-[#1A1A1A]/30 italic py-8 text-center">No data yet</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-[#5A5A40]" />
            <h4 className="font-serif text-lg font-bold">Top Selling Products</h4>
          </div>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.slice(0, 8).map((p, i) => {
                const maxQty = topProducts[0]?.quantity_sold || 1;
                return (
                  <div key={p.product_id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#1A1A1A]/70 font-medium">{i + 1}. {p.name}</span>
                      <span className="font-bold">{p.quantity_sold} sold · ₹{p.revenue}</span>
                    </div>
                    <div className="h-2 bg-[#F5F5F0] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#5A5A40]" style={{ width: `${(p.quantity_sold / maxQty) * 100}%`, opacity: 1 - i * 0.08 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-[#1A1A1A]/30 italic py-8 text-center">No sales yet</p>}
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-amber-600" />
              <h4 className="font-serif text-lg font-bold">Low Stock Alerts</h4>
            </div>
            {aiAvailable && lowStock.length > 0 && (
              <button onClick={handleStockInsight} disabled={insightLoading}
                className="flex items-center gap-1 text-[10px] font-bold text-[#5A5A40] bg-[#F5F5F0] hover:bg-[#EBEBDC] px-3 py-1.5 rounded-full border border-[#5A5A40]/20 transition-colors disabled:opacity-50">
                {insightLoading ? <Loader2 size={10} className="animate-spin" /> : '✨'}
                {insightLoading ? 'Thinking…' : 'AI Advice'}
              </button>
            )}
          </div>
          {lowStock.length > 0 ? (
            <div className="space-y-2">
              {lowStock.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <span className="text-sm font-medium text-amber-800">{item.name}</span>
                  <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{item.stock} left</span>
                </div>
              ))}
              {stockInsight && (
                <div className="mt-3 p-3 bg-[#F5F5F0] rounded-2xl border border-[#5A5A40]/10">
                  <p className="text-xs font-bold text-[#5A5A40] mb-1 flex items-center gap-1">✨ AI Restock Advice</p>
                  <p className="text-xs text-[#1A1A1A]/70 leading-relaxed">{stockInsight}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CheckCircle2 size={32} className="mx-auto text-green-400 mb-2" />
              <p className="text-sm text-[#1A1A1A]/30">All products well stocked!</p>
            </div>
          )}
        </div>
      </div>

      {/* Orders by Status */}
      <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
        <h4 className="font-serif text-lg font-bold mb-4">Orders by Status</h4>
        {Object.keys(analytics.orders_by_status || {}).length > 0 ? (
          <BarChart
            data={Object.entries(analytics.orders_by_status).map(([status, count]) => ({ status: status.replace('_', ' '), count }))}
            labelKey="status" valueKey="count" height={140} color="#7A7A60"
          />
        ) : <p className="text-sm text-[#1A1A1A]/30 italic py-8 text-center">No orders yet</p>}
      </div>
    </div>
  );
}

// ── Orders Panel ──────────────────────────────────────────────────
const ORDER_TRANSITIONS = {
  pending:          { next: 'accepted',         label: 'Accept Order',       icon: CheckCircle2, color: 'bg-blue-600' },
  accepted:         { next: 'ready',            label: 'Mark Ready',         icon: Package,      color: 'bg-indigo-600' },
  ready:            { next: 'out_for_delivery', label: 'Out for Delivery',   icon: Truck,        color: 'bg-purple-600' },
  out_for_delivery: { next: 'delivered',        label: 'Mark Delivered',     icon: CheckCircle2, color: 'bg-green-600' },
};
const STATUS_BADGE = {
  pending:          'bg-amber-50 text-amber-700 border-amber-100',
  accepted:         'bg-blue-50 text-blue-700 border-blue-100',
  ready:            'bg-indigo-50 text-indigo-700 border-indigo-100',
  out_for_delivery: 'bg-purple-50 text-purple-700 border-purple-100',
  delivered:        'bg-green-50 text-green-700 border-green-100',
  rejected:         'bg-red-50 text-red-700 border-red-100',
};

function OrdersPanel({ shopId }) {
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [updating, setUpdating]   = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch]       = useState('');
  const dateInputRef              = useRef(null);

  const reload = useCallback(() => {
    setLoading(true);
    const params = {};
    if (dateFilter) { params.date_from = dateFilter; params.date_to = dateFilter; }
    if (typeFilter !== 'all') params.order_type = typeFilter;
    getShopOrders(shopId, 1, params)
      .then(r => setOrders(r.data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [shopId, dateFilter, typeFilter]);

  const shareToWhatsApp = (order) => {
    const date = new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const itemLines = order.items.map(i => `  • ${i.name} × ${i.quantity}  ₹${i.line_total ?? i.price * i.quantity}`).join('\n');
    const isWalkin  = (order.order_type || 'online') === 'walkin';
    const location  = isWalkin ? 'In-Store (Walk-in)' : (order.delivery_address || 'Online Delivery');
    const payment   = order.payment_method === 'upi' ? 'UPI' : order.payment_method === 'cash' ? 'Cash' : order.payment_method;
    const msg = [
      `🛍️ *HyperMart — Order #${order.id}*`,
      `📅 ${date}`,
      ``,
      `*Items:*`,
      itemLines,
      ``,
      `💰 *Total: ₹${order.total}*`,
      `💳 Payment: ${payment}`,
      `📍 ${location}`,
      `✅ Status: ${order.status.replace('_', ' ').toUpperCase()}`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  useEffect(() => { reload(); }, [reload]);

  const advance = async (orderId, nextStatus) => {
    setUpdating(orderId);
    try { await updateOrderStatus(orderId, nextStatus); reload(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to update order.'); }
    finally { setUpdating(null); }
  };

  const reject = async (orderId) => {
    if (!window.confirm('Reject this order?')) return;
    setUpdating(orderId);
    try { await updateOrderStatus(orderId, 'rejected'); reload(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to reject order.'); }
    finally { setUpdating(null); }
  };

  // Client-side search filter
  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(o =>
      String(o.id).includes(q) ||
      (o.delivery_address || '').toLowerCase().includes(q) ||
      (o.items || []).some(i => i.name.toLowerCase().includes(q))
    );
  }, [orders, search]);

  // Format date as DD/MM/YYYY
  const formatDate = (d) => {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
  };

  const TYPE_FILTER_OPTS = [
    { val: 'all',    label: 'All Orders' },
    { val: 'online', label: 'Online' },
    { val: 'walkin', label: 'Walk-in' },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header row: title + calendar + search + filter ───────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: title + calendar date badge */}
        <div className="flex items-center gap-3">
          <h3 className="font-serif text-2xl font-bold">
            Manage Orders
          </h3>
          {/* Hidden date input, triggered by icon click */}
          <input
            ref={dateInputRef}
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="sr-only"
          />
          <button
            onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F0] border border-[#1A1A1A]/10 rounded-full text-xs font-bold text-[#5A5A40] hover:bg-[#5A5A40]/10 transition-all"
          >
            <Calendar size={13} />
            {formatDate(dateFilter)}
          </button>
          {dateFilter !== new Date().toISOString().split('T')[0] && (
            <button onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
              className="text-[10px] font-bold text-red-500 hover:underline">
              Reset
            </button>
          )}
        </div>

        {/* Right: search + type filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ID, product, or address..."
              className="pl-9 pr-4 py-2.5 bg-white border border-[#1A1A1A]/10 rounded-xl text-sm outline-none focus:border-[#5A5A40] w-64 transition-colors"
            />
          </div>
          <div className="relative flex items-center gap-1.5 px-3 py-2.5 bg-white border border-[#1A1A1A]/10 rounded-xl">
            <Activity size={13} className="text-[#5A5A40] shrink-0" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="appearance-none bg-transparent text-sm font-bold pr-4 outline-none cursor-pointer"
            >
              {TYPE_FILTER_OPTS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Orders list ──────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-[#5A5A40]" /></div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-20 text-center bg-white border border-[#1A1A1A]/10 rounded-2xl">
          <ClipboardList size={40} className="mx-auto text-[#5A5A40]/15 mb-3" />
          <p className="text-[#1A1A1A]/30 italic">No orders found for {formatDate(dateFilter)}.</p>
          <button onClick={() => { setDateFilter(''); setSearch(''); setTypeFilter('all'); }}
            className="mt-3 text-xs font-bold text-[#5A5A40] hover:underline">
            Show all orders
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const transition = ORDER_TRANSITIONS[order.status];
            const isLocked   = updating === order.id;
            const isOnline   = (order.order_type || 'online') !== 'walkin';

            return (
              <div key={order.id} className="bg-white border border-[#1A1A1A]/10 rounded-2xl p-5">
                {/* Order header */}
                <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-[#1A1A1A]/50 uppercase tracking-widest">
                      Order #{String(order.id).toUpperCase().slice(0,6)}
                    </span>
                    {/* Online / Walk-in badge */}
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                      isOnline
                        ? 'bg-purple-50 text-purple-700 border-purple-100'
                        : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                      {isOnline ? 'Online' : 'Walk-in'}
                    </span>
                    {/* Status badge */}
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${STATUS_BADGE[order.status] || 'bg-gray-50 text-gray-700 border-gray-100'}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-[#1A1A1A]/30">{new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="font-serif text-2xl font-bold">₹{order.total}</p>
                </div>

                {/* Items */}
                <div className="mb-4 space-y-1.5 pl-1">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-[#1A1A1A]/70">{item.name} <span className="text-[#1A1A1A]/40">× {item.quantity}</span></span>
                      <span className="font-bold">₹{item.line_total ?? item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Delivery address */}
                {order.delivery_address && (
                  <div className="flex items-start gap-1.5 mb-4 pt-3 border-t border-[#1A1A1A]/5">
                    <MapPin size={12} className="text-[#5A5A40] mt-0.5 shrink-0" />
                    <p className="text-xs text-[#1A1A1A]/40">{order.delivery_address}</p>
                  </div>
                )}

                {/* Status Timeline */}
                {(() => {
                  const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
                  const isWalkin = (order.order_type || 'online') === 'walkin';
                  const deliveredTime = fmt(order.delivered_at) || (order.status === 'delivered' ? fmt(order.updated_at) : null);
                  const steps = isWalkin ? [
                    { label: 'Ordered',   time: fmt(order.created_at), done: true },
                    { label: 'Billed',    time: fmt(order.accepted_at) || fmt(order.created_at), done: true },
                    { label: 'Delivered', time: deliveredTime, done: order.status === 'delivered' },
                  ] : [
                    { label: 'Ordered',          time: fmt(order.created_at),            done: true },
                    { label: 'Accepted',         time: fmt(order.accepted_at),            done: !!order.accepted_at },
                    { label: 'Out for Delivery', time: fmt(order.out_for_delivery_at),    done: !!order.out_for_delivery_at },
                    { label: 'Delivered',        time: deliveredTime,                     done: order.status === 'delivered' },
                  ];
                  return (
                    <div className="mb-4 pt-3 border-t border-[#1A1A1A]/5">
                      <div className="flex items-start">
                        {steps.map((step, i) => (
                          <div key={step.label} className="flex-1 flex flex-col items-center relative">
                            {i < steps.length - 1 && (
                              <div className={`absolute top-[9px] left-1/2 w-full h-0.5 ${steps[i + 1].done ? 'bg-[#5A5A40]' : 'bg-[#1A1A1A]/10'}`} />
                            )}
                            <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center z-10 shrink-0 ${step.done ? 'bg-[#5A5A40] border-[#5A5A40]' : 'bg-white border-[#1A1A1A]/15'}`}>
                              {step.done && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <p className={`text-[9px] font-bold uppercase tracking-widest mt-1.5 text-center leading-tight ${step.done ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/25'}`}>{step.label}</p>
                            <p className={`text-[8px] text-center mt-0.5 leading-tight ${step.time ? 'text-[#1A1A1A]/40' : 'text-[#1A1A1A]/15'}`}>{step.time || '—'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Action buttons */}
                <div className="flex gap-2 pt-3 border-t border-[#1A1A1A]/5">
                  {transition && (
                    <button
                      disabled={isLocked}
                      onClick={() => advance(order.id, transition.next)}
                      className={`flex-1 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${transition.color}`}
                    >
                      {isLocked ? <Loader2 size={14} className="animate-spin" /> : <transition.icon size={14} />}
                      {transition.label}
                    </button>
                  )}
                  {order.status === 'pending' && (
                    <button
                      disabled={isLocked}
                      onClick={() => reject(order.id)}
                      className="flex-1 border border-red-200 text-red-600 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  )}
                  <button
                    onClick={() => setInvoiceOrder(order)}
                    className="px-4 py-2.5 bg-[#F5F5F0] rounded-xl text-xs font-bold uppercase tracking-widest text-[#5A5A40] hover:bg-[#5A5A40]/10 transition-all flex items-center gap-1.5"
                  >
                    <Receipt size={14} /> Invoice
                  </button>
                  <button
                    onClick={() => shareToWhatsApp(order)}
                    className="px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-xs font-bold uppercase tracking-widest text-green-700 hover:bg-green-100 transition-all flex items-center gap-1.5"
                  >
                    <Share2 size={14} /> WhatsApp
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {invoiceOrder && <InvoiceModal order={invoiceOrder} shopView onClose={() => setInvoiceOrder(null)} />}

    </div>
  );
}

// ── Inventory Panel ───────────────────────────────────────────────
function InventoryPanel({ shopId, allShops, selectedShop, onShopChange }) {
  const [products, setProducts]     = useState([]);
  const [suppliers, setSuppliers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [sortBy, setSortBy]         = useState('newest');
  const [showModal, setShowModal]   = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [subTab, setSubTab]         = useState('catalog');
  const [catFilter, setCatFilter]   = useState('All');
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogItemsPerPage, setCatalogItemsPerPage] = useState(10);

  const SUB_TABS = [
    { key: 'catalog',         label: 'Catalog',          icon: <Settings size={14} /> },
    { key: 'stock',           label: 'Stock',            icon: <Package size={14} /> },
    { key: 'stock_adj',       label: 'Stock Adjustment', icon: <Edit3 size={14} /> },
    { key: 'discounts',       label: 'Bulk Discount',    icon: <DollarSign size={14} /> },
    { key: 'suppliers',       label: 'Credit',           icon: <Receipt size={14} /> },
    { key: 'purchase_orders', label: 'Trash',            icon: <Trash2 size={14} /> },
  ];

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      listProducts(shopId, false),
      listSuppliers(shopId).catch(() => ({ data: [] })),
    ]).then(([prodR, supR]) => {
      setProducts(prodR.data || []);
      setSuppliers(supR.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [shopId]);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (productData) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      const targetShopId = productData._shopId || shopId;
      await deleteProduct(targetShopId, productData.id);
      reload();
    }
    catch (err) { alert(err.response?.data?.detail || 'Failed to delete.'); }
  };

  // Filtering + sorting
  const filtered = useMemo(() => {
    let list = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (catFilter !== 'All') list = list.filter(p => p.category === catFilter);
    if (sortBy === 'newest')   list = [...list].sort((a, b) => b.id - a.id);
    if (sortBy === 'oldest')   list = [...list].sort((a, b) => a.id - b.id);
    if (sortBy === 'name')     list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'price_low') list = [...list].sort((a, b) => a.price - b.price);
    if (sortBy === 'price_high') list = [...list].sort((a, b) => b.price - a.price);
    if (sortBy === 'stock_low') list = [...list].sort((a, b) => a.stock - b.stock);
    return list;
  }, [products, search, catFilter, sortBy]);

  useEffect(() => { setCatalogPage(1); }, [search, catFilter, sortBy]);

  const catalogTotalPages = catalogItemsPerPage === -1 ? 1 : Math.ceil(filtered.length / catalogItemsPerPage);
  const catalogPaginated = useMemo(() => {
    if (catalogItemsPerPage === -1) return filtered;
    const start = (catalogPage - 1) * catalogItemsPerPage;
    return filtered.slice(start, start + catalogItemsPerPage);
  }, [filtered, catalogPage, catalogItemsPerPage]);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category))].filter(Boolean).sort();
    return ['All', ...cats];
  }, [products]);

  const lowStockCount = products.filter(p => p.stock <= (p.low_stock_threshold || 10)).length;

  const expiringProducts = useMemo(() => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return products.filter(p => {
      if (!p.expiry_date) return false;
      const expiryDate = new Date(p.expiry_date);
      return expiryDate <= thirtyDaysFromNow && expiryDate >= new Date();
    }).sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
  }, [products]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="space-y-6">
      {/* ── Sub-tab pills (screenshot style) ────────────────────── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all border ${
              subTab === t.key
                ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-sm'
                : 'bg-white text-[#1A1A1A]/50 border-[#1A1A1A]/10 hover:border-[#5A5A40]/30 hover:text-[#5A5A40]'
            }`}>
            {t.icon}
            {t.label}
            {t.key === 'stock_adj' && lowStockCount > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{lowStockCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Catalog sub-tab ─────────────────────────────────────── */}
      {subTab === 'catalog' && (
        <div>
          {/* Expiry Alerts Alert Box */}
          {expiringProducts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-2xl p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-900">Expiry Alerts</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      {expiringProducts.length} product{expiringProducts.length !== 1 ? 's' : ''} {expiringProducts.length === 1 ? 'is' : 'are'} nearing expiry within the next 30 days.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {expiringProducts.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-100">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-[#1A1A1A]">
                        {p.name} <span className="text-amber-600 font-bold">({formatDate(p.expiry_date)})</span>
                      </p>
                      <p className="text-xs text-[#1A1A1A]/50 mt-0.5">Stock: {p.stock}</p>
                    </div>
                    <button
                      onClick={() => { setSubTab('stock_adj'); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Edit3 size={14} />
                      Adjust Stock
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Header: Title + controls */}
          <div className="flex flex-col gap-4 mb-6">
            <h3 className="font-serif text-2xl font-bold">Product Catalog</h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" />
                <input
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#1A1A1A]/10 rounded-xl text-sm outline-none focus:border-[#5A5A40] transition-colors"
                  placeholder="Search catalog..." value={search} onChange={e => setSearch(e.target.value)}
                />
              </div>
              {/* Shop filter */}
              {Array.isArray(allShops) && allShops.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-[#1A1A1A]/10 rounded-xl">
                  <Store size={14} className="text-[#5A5A40] shrink-0" />
                  <select value={selectedShop?.id ?? allShops[0]?.id ?? ''} onChange={e => {
                    const shop = allShops.find(s => s.id === Number(e.target.value));
                    if (shop) onShopChange(shop);
                  }}
                    className="appearance-none bg-transparent text-sm font-bold pr-4 outline-none cursor-pointer">
                    {allShops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
                  </select>
                </div>
              )}
              {/* Sort */}
              <div className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-[#1A1A1A]/10 rounded-xl">
                <TrendingUp size={14} className="text-[#5A5A40] shrink-0" />
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className="appearance-none bg-transparent text-sm font-bold pr-4 outline-none cursor-pointer">
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name">Name A-Z</option>
                  <option value="price_low">Price Low-High</option>
                  <option value="price_high">Price High-Low</option>
                  <option value="stock_low">Stock Low-High</option>
                </select>
              </div>
              {/* Add Product */}
              <button
                onClick={() => { setEditProduct(null); setShowModal(true); }}
                className="bg-[#5A5A40] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#4A4A30] transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <Plus size={16} /> Add Product
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-[#5A5A40]" /></div>
          ) : filtered.length > 0 ? (
            <div className="rounded-2xl border border-[#1A1A1A]/10 overflow-x-auto bg-white">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="border-b border-[#1A1A1A]/5">
                  <tr>
                    <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Product</th>
                    <th className="text-left px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Category</th>
                    <th className="text-left px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Purchase Price</th>
                    <th className="text-left px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">MRP</th>
                    <th className="text-center px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Stock</th>
                    <th className="text-center px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Status</th>
                    <th className="text-center px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/5">
                  {catalogPaginated.map(p => (
                    <tr key={p.id} className="hover:bg-[#F5F5F0]/50 transition-colors">
                      {/* Product */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-[#F5F5F0] rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-[#1A1A1A]/5">
                            {p.image ? <img src={fixImageUrl(p.image)} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Package size={18} className="text-[#5A5A40]/30" />}
                          </div>
                          <p className="font-bold line-clamp-1">{p.name}</p>
                        </div>
                      </td>
                      {/* Category badge */}
                      <td className="px-4 py-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-[#F5F5F0] text-[#5A5A40] px-2.5 py-1 rounded-md">{p.category}</span>
                      </td>
                      {/* Purchase Price */}
                      <td className="px-4 py-4">
                        <span className="font-serif font-bold">₹{p.price}</span>
                        <span className="text-[#1A1A1A]/30 text-xs ml-1">/ {p.unit}</span>
                      </td>
                      {/* MRP */}
                      <td className="px-4 py-4">
                        <span className="font-serif font-bold">₹{p.mrp || p.price}</span>
                        <span className="text-[#1A1A1A]/30 text-xs ml-1">/ {p.unit}</span>
                      </td>
                      {/* Stock */}
                      <td className="px-4 py-4 text-center">
                        <span className={`font-bold ${p.stock <= (p.low_stock_threshold || 10) ? 'text-red-600' : ''}`}>{p.stock}</span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-4 text-center">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                          p.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
                        }`}>
                          {p.status || 'active'}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => { setEditProduct(p); setShowModal(true); }}
                            className="p-2 rounded-lg hover:bg-[#F5F5F0] transition-colors text-[#1A1A1A]/40 hover:text-[#5A5A40]">
                            <Settings size={16} />
                          </button>
                          <button onClick={() => handleDelete(p)}
                            className="p-2 rounded-lg hover:bg-red-50 transition-colors text-[#1A1A1A]/30 hover:text-red-500">
                            <XCircle size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 0 && (
                <div className="p-6 bg-[#F5F5F0]/30 border-t border-[#1A1A1A]/5 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-widest">
                    Showing {catalogItemsPerPage === -1 ? filtered.length : Math.min(catalogItemsPerPage, filtered.length - (catalogPage - 1) * catalogItemsPerPage)} of {filtered.length} Products
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCatalogItemsPerPage(catalogItemsPerPage === -1 ? 10 : -1)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${catalogItemsPerPage === -1 ? 'bg-[#5A5A40] text-white' : 'bg-white border border-[#1A1A1A]/10 text-[#1A1A1A]/60 hover:bg-[#F5F5F0]'}`}>
                      {catalogItemsPerPage === -1 ? 'Show Paginated' : 'Show All'}
                    </button>
                    {catalogItemsPerPage !== -1 && (
                      <div className="flex items-center gap-1 ml-2">
                        <button disabled={catalogPage === 1} onClick={() => setCatalogPage(p => Math.max(1, p - 1))} className="p-2 bg-white border border-[#1A1A1A]/10 rounded-xl text-[#1A1A1A]/60 hover:bg-[#F5F5F0] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                          <ChevronLeft size={18} />
                        </button>
                        <div className="px-4 py-2 bg-white border border-[#1A1A1A]/10 rounded-xl text-xs font-bold text-[#5A5A40]">Page {catalogPage} of {catalogTotalPages}</div>
                        <button disabled={catalogPage === catalogTotalPages} onClick={() => setCatalogPage(p => Math.min(catalogTotalPages, p + 1))} className="p-2 bg-white border border-[#1A1A1A]/10 rounded-xl text-[#1A1A1A]/60 hover:bg-[#F5F5F0] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center bg-white border border-[#1A1A1A]/10 rounded-2xl">
              <Package size={48} className="mx-auto text-[#5A5A40]/15 mb-4" />
              <p className="text-[#1A1A1A]/30 italic">{search ? 'No products match your search.' : 'No products yet. Add your first product!'}</p>
            </div>
          )}

          <AnimatePresence>
            {showModal && (
              <ProductModal
                shopId={shopId}
                product={editProduct}
                onSave={() => { setShowModal(false); reload(); }}
                onClose={() => setShowModal(false)}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Stock sub-tab (simple stock view) */}
      {subTab === 'stock' && (
        <StockAdjustment products={products} shopId={shopId} onSaved={reload} />
      )}

      {/* Stock Adjustment sub-tab */}
      {subTab === 'stock_adj' && (
        <StockAdjustment products={products} shopId={shopId} onSaved={reload} />
      )}

      {/* Discounts sub-tab */}
      {subTab === 'discounts' && (
        <BulkDiscountManager shopId={shopId} products={products} />
      )}

      {/* Suppliers sub-tab */}
      {subTab === 'suppliers' && (
        <SupplierManager shopId={shopId} />
      )}

      {/* Purchase Orders sub-tab */}
      {subTab === 'purchase_orders' && (
        <PurchaseOrderManager shopId={shopId} products={products} suppliers={suppliers} />
      )}
    </div>
  );
}

// ── Shop Settings Panel ────────────────────────────────────────────
function ShopSettingsPanel({ shop, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(shop?.is_open ?? 1);
  const [timings, setTimings] = useState(shop?.timings || '');
  const [schedule, setSchedule] = useState(shop?.schedule || {
    monday: { open: '09:00', close: '21:00', closed: false },
    tuesday: { open: '09:00', close: '21:00', closed: false },
    wednesday: { open: '09:00', close: '21:00', closed: false },
    thursday: { open: '09:00', close: '21:00', closed: false },
    friday: { open: '09:00', close: '21:00', closed: false },
    saturday: { open: '09:00', close: '21:00', closed: false },
    sunday: { open: '10:00', close: '18:00', closed: true },
  });
  const [unavailableDates, setUnavailableDates] = useState(shop?.unavailable_dates || []);
  const [newDate, setNewDate] = useState('');
  const [periodType, setPeriodType] = useState('day');
  const [expandDatesTable, setExpandDatesTable] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [filterType, setFilterType] = useState('all');
  const [dayOfWeekFilter, setDayOfWeekFilter] = useState(null);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [selectMode, setSelectMode] = useState('single');

  // --- Location & details state ---
  const [shopLat, setShopLat] = useState(shop?.lat ?? null);
  const [shopLng, setShopLng] = useState(shop?.lng ?? null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [deliveryRadius, setDeliveryRadius] = useState(shop?.delivery_radius ?? '');
  const [pincode, setPincode] = useState(shop?.pincode || '');
  const [city, setCity] = useState(shop?.city || '');
  const [state, setState] = useState(shop?.state || '');
  const [upiId, setUpiId] = useState(shop?.upi_id || '');

  // Products for stock management
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [stockUpdating, setStockUpdating] = useState(null);

  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
  const inp = 'w-full bg-[#F5F5F0] border border-[#1A1A1A]/5 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-[#5A5A40] transition-colors';

  useEffect(() => {
    if (!shop) return;
    setIsOpen(shop.is_open ?? 1);
    setTimings(shop.timings || '');
    setSchedule(shop.schedule || schedule);
    setUnavailableDates(shop.unavailable_dates || []);
    setShopLat(shop.lat ?? null);
    setShopLng(shop.lng ?? null);
    setDeliveryRadius(shop.delivery_radius ?? '');
    setPincode(shop.pincode || '');
    setCity(shop.city || '');
    setState(shop.state || '');
    setUpiId(shop.upi_id || '');
  }, [shop?.id]);

  useEffect(() => {
    if (!shop) return;
    setProductsLoading(true);
    listProducts(shop.id, false)
      .then(r => setProducts(r.data))
      .catch(console.error)
      .finally(() => setProductsLoading(false));
  }, [shop?.id]);

  const handleToggleOpen = async () => {
    setSaving(true); setError('');
    try {
      const newVal = isOpen ? 0 : 1;
      await updateShop(shop.id, { is_open: newVal });
      setIsOpen(newVal);
      setSuccess(newVal ? 'Shop is now Open' : 'Shop is now Closed');
      onUpdated?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleSaveTimings = async () => {
    setSaving(true); setError('');
    try {
      await updateShop(shop.id, { timings });
      setSuccess('Timings updated');
      onUpdated?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleSaveLocation = async () => {
    if (!shopLat || !shopLng) { setError('Please set a location first using the map or GPS.'); return; }
    setSaving(true); setError('');
    try {
      await updateShop(shop.id, { lat: parseFloat(shopLat), lng: parseFloat(shopLng) });
      setSuccess('Location saved! Customers can now find your shop on the map.');
      onUpdated?.();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save location');
    } finally { setSaving(false); }
  };

  const getCurrentLocationForShop = () => {
    if (!navigator.geolocation) { setError('Geolocation is not supported by your browser.'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setShopLat(pos.coords.latitude.toFixed(6));
        setShopLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => { setError('Could not get location: ' + err.message); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveSchedule = async () => {
    setSaving(true); setError('');
    try {
      await updateShop(shop.id, { schedule });
      setSuccess('Weekly schedule saved');
      onUpdated?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update');
    } finally { setSaving(false); }
  };

  // Helper function to get all dates for the selected period
  const getDateRangeByPeriod = (dateStr, period) => {
    const date = new Date(dateStr + 'T00:00:00');
    const dates = [];

    if (period === 'day') {
      // Single day
      dates.push(dateStr);
    } else if (period === 'week') {
      // 7 days starting from selected date
      for (let i = 0; i < 7; i++) {
        const d = new Date(date);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
      }
    } else if (period === 'month') {
      // All days in the selected month
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        dates.push(d.toISOString().split('T')[0]);
      }
    } else if (period === 'year') {
      // All days in the selected year
      const year = date.getFullYear();
      
      for (let month = 0; month < 12; month++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
          const d = new Date(year, month, i);
          dates.push(d.toISOString().split('T')[0]);
        }
      }
    }

    return dates;
  };

  const handleAddUnavailableDate = async () => {
    if (!newDate) return;
    
    // Get all dates for the selected period
    const newDates = getDateRangeByPeriod(newDate, periodType);
    
    // Add new dates to existing ones, avoiding duplicates
    const updated = [...new Set([...unavailableDates, ...newDates])].sort();
    
    setSaving(true); setError('');
    try {
      await updateShop(shop.id, { unavailable_dates: updated });
      setUnavailableDates(updated);
      setNewDate('');
      
      const periodLabel = {
        day: 'date',
        week: 'week',
        month: 'month',
        year: 'year'
      };
      setSuccess(`Non-availability ${periodLabel[periodType]} added (${newDates.length} dates)`);
      onUpdated?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleRemoveDate = async (date) => {
    const updated = unavailableDates.filter(d => d !== date);
    setSaving(true); setError('');
    try {
      await updateShop(shop.id, { unavailable_dates: updated });
      setUnavailableDates(updated);
      setSuccess('Date removed');
      onUpdated?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleToggleStock = async (product) => {
    const newStatus = product.status === 'active' ? 'out_of_stock' : 'active';
    setStockUpdating(product.id);
    try {
      await updateProduct(shop.id, product.id, { status: newStatus });
      setProducts(ps => ps.map(p => p.id === product.id ? { ...p, status: newStatus } : p));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update stock');
    } finally { setStockUpdating(null); }
  };

  const handleUpdateStock = async (product, newStock) => {
    setStockUpdating(product.id);
    try {
      await updateProduct(shop.id, product.id, { stock: newStock });
      setProducts(ps => ps.map(p => p.id === product.id ? { ...p, stock: newStock } : p));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update stock');
    } finally { setStockUpdating(null); }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const futureUnavail = unavailableDates.filter(d => d >= todayStr);
  const pastUnavail = unavailableDates.filter(d => d < todayStr);

  return (
    <div className="space-y-6">
      {/* Success / Error messages */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600" />
            <span className="text-sm font-medium text-green-700">{success}</span>
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600" />
            <span className="text-sm font-medium text-red-700">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shop Open/Close Toggle */}
      <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-6 shadow-sm">
        <h3 className="font-serif text-lg font-bold mb-4 flex items-center gap-2">
          <Power size={18} className="text-[#5A5A40]" /> Shop Availability
        </h3>
        <div className="flex items-center justify-between bg-[#F5F5F0] rounded-2xl px-5 py-4">
          <div>
            <p className="font-bold text-sm">Shop Status</p>
            <p className="text-xs text-[#1A1A1A]/40">Customers will see your shop as {isOpen ? 'open' : 'closed'}</p>
          </div>
          <button onClick={handleToggleOpen} disabled={saving}
            className={`relative w-14 h-7 rounded-full transition-all ${isOpen ? 'bg-emerald-500' : 'bg-[#1A1A1A]/20'}`}>
            <motion.div animate={{ x: isOpen ? 28 : 4 }}
              className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm" />
          </button>
        </div>
      </div>

      {/* Timings */}
      <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-6 shadow-sm">
        <h3 className="font-serif text-lg font-bold mb-4 flex items-center gap-2">
          <Clock size={18} className="text-[#5A5A40]" /> Shop Timings
        </h3>
        <div className="space-y-3">
          <input className={inp} placeholder="e.g. 9:00 AM – 9:00 PM" value={timings} onChange={e => setTimings(e.target.value)} />
          <button onClick={handleSaveTimings} disabled={saving}
            className="bg-[#5A5A40] text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Timings
          </button>
        </div>
      </div>

      {/* Shop Location */}
      <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-serif text-lg font-bold flex items-center gap-2">
              <MapPin size={18} className="text-[#5A5A40]" /> Shop Location
            </h3>
            <p className="text-xs text-[#1A1A1A]/40 mt-1">
              Setting your location lets customers find you on the map and see distance.
            </p>
          </div>
          {shopLat && shopLng && (
            <span className="shrink-0 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              <CheckCircle2 size={12} /> Location Set
            </span>
          )}
        </div>

        {/* Current coordinates */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1 block">Latitude</label>
            <input
              className={inp}
              placeholder="e.g. 17.385044"
              type="number"
              step="any"
              value={shopLat ?? ''}
              onChange={e => setShopLat(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1 block">Longitude</label>
            <input
              className={inp}
              placeholder="e.g. 78.486671"
              type="number"
              step="any"
              value={shopLng ?? ''}
              onChange={e => setShopLng(e.target.value)}
            />
          </div>
        </div>

        {/* Map mini-preview if location is set */}
        {shopLat && shopLng && (
          <div className="mb-4 rounded-2xl overflow-hidden border border-[#1A1A1A]/10 shadow-inner" style={{ height: 200 }}>
            <MapContainer
              key={`${shopLat}-${shopLng}`}
              center={[parseFloat(shopLat), parseFloat(shopLng)]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
              <Marker position={[parseFloat(shopLat), parseFloat(shopLng)]} />
            </MapContainer>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMapPickerOpen(true)}
            className="flex items-center gap-2 border border-[#5A5A40]/30 rounded-2xl py-2.5 px-4 text-sm font-bold text-[#5A5A40] hover:bg-[#5A5A40]/5 active:scale-[0.98] transition-all hover:shadow-md cursor-pointer"
          >
            <MapPin size={16} /> Pick on Map
          </button>
          <button
            type="button"
            onClick={getCurrentLocationForShop}
            disabled={locating}
            className="flex items-center gap-2 border border-[#5A5A40]/30 rounded-2xl py-2.5 px-4 text-sm font-bold text-[#5A5A40] hover:bg-[#5A5A40]/5 active:scale-[0.98] transition-all hover:shadow-md cursor-pointer disabled:opacity-50"
          >
            {locating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
            {locating ? 'Getting GPS...' : 'Use My GPS'}
          </button>
          <button
            onClick={handleSaveLocation}
            disabled={saving || !shopLat || !shopLng}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#5A5A40] text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#4A4A30] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Location
          </button>
        </div>
      </div>

      {/* Map Picker Modal */}
      <AnimatePresence>
        {mapPickerOpen && (
          <MapPickerModal
            initialLat={shopLat ? +shopLat : null}
            initialLng={shopLng ? +shopLng : null}
            onConfirm={(lat, lng) => {
              setShopLat(lat.toFixed(6));
              setShopLng(lng.toFixed(6));
              setMapPickerOpen(false);
            }}
            onClose={() => setMapPickerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Shop Details (Delivery Radius, Pincode, City, State) */}
      <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-6 shadow-sm">
        <h3 className="font-serif text-lg font-bold mb-4 flex items-center gap-2">
          <Truck size={18} className="text-[#5A5A40]" /> Delivery & Address Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1 block">Delivery Radius (km)</label>
            <input className={inp} type="number" step="0.5" min="0" placeholder="e.g. 5" value={deliveryRadius} onChange={e => setDeliveryRadius(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1 block">Pincode</label>
            <input className={inp} placeholder="e.g. 500001" maxLength={10} value={pincode} onChange={e => setPincode(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1 block">City</label>
            <input className={inp} placeholder="e.g. Hyderabad" value={city} onChange={e => setCity(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1 block">State</label>
            <input className={inp} placeholder="e.g. Telangana" value={state} onChange={e => setState(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1 block">UPI ID (for receiving payments)</label>
            <input className={inp} placeholder="e.g. shopname@upi" value={upiId} onChange={e => setUpiId(e.target.value)} />
            <p className="text-[10px] text-[#1A1A1A]/30 mt-1">Customers can scan a QR code to pay you directly via UPI</p>
          </div>
        </div>
        <button
          onClick={async () => {
            setSaving(true); setError('');
            try {
              await updateShop(shop.id, {
                delivery_radius: deliveryRadius ? parseFloat(deliveryRadius) : null,
                pincode: pincode || null,
                city: city || null,
                state: state || null,
                upi_id: upiId || null,
              });
              setSuccess('Delivery & address details saved');
              onUpdated?.();
              setTimeout(() => setSuccess(''), 3000);
            } catch (err) {
              setError(err.response?.data?.detail || 'Failed to update');
            } finally { setSaving(false); }
          }}
          disabled={saving}
          className="bg-[#5A5A40] text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Details
        </button>
      </div>

      {/* Weekly Schedule */}
      <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-6 shadow-sm">
        <h3 className="font-serif text-lg font-bold mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-[#5A5A40]" /> Weekly Schedule
        </h3>
        <div className="space-y-2">
          {DAYS.map(day => (
            <div key={day} className="flex items-center gap-3 bg-[#F5F5F0] rounded-xl px-4 py-2.5">
              <span className="font-bold text-sm w-10">{DAY_LABELS[day]}</span>
              <button onClick={() => setSchedule(s => ({ ...s, [day]: { ...s[day], closed: !s[day].closed } }))}
                className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full transition-colors ${schedule[day]?.closed ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                {schedule[day]?.closed ? 'Closed' : 'Open'}
              </button>
              {!schedule[day]?.closed && (
                <div className="flex items-center gap-2 ml-auto">
                  <input type="time" value={schedule[day]?.open || '09:00'}
                    onChange={e => setSchedule(s => ({ ...s, [day]: { ...s[day], open: e.target.value } }))}
                    className="bg-white border border-[#1A1A1A]/10 rounded-lg px-2 py-1 text-xs font-medium" />
                  <span className="text-xs text-[#1A1A1A]/30">to</span>
                  <input type="time" value={schedule[day]?.close || '21:00'}
                    onChange={e => setSchedule(s => ({ ...s, [day]: { ...s[day], close: e.target.value } }))}
                    className="bg-white border border-[#1A1A1A]/10 rounded-lg px-2 py-1 text-xs font-medium" />
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={handleSaveSchedule} disabled={saving}
          className="mt-4 bg-[#5A5A40] text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Schedule
        </button>
      </div>

      {/* Non-Availability Calendar */}
      <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-6 shadow-sm">
        <h3 className="font-serif text-lg font-bold mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-[#5A5A40]" /> Non-Availability Dates
        </h3>
        <p className="text-xs text-[#1A1A1A]/40 mb-4">Mark specific dates or periods when your shop will be closed (holidays, maintenance, etc.)</p>
        
        {/* Period selector and date input */}
        <div className="flex gap-2 mb-4 flex-col sm:flex-row">
          <select value={periodType} onChange={e => setPeriodType(e.target.value)} 
            className={`${inp} sm:w-32`}>
            <option value="day">📅 Single Day</option>
            <option value="week">📆 Week (7 days)</option>
            <option value="month">📊 Full Month</option>
            <option value="year">📈 Full Year</option>
          </select>
          
          <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} min={todayStr}
            className={`${inp} flex-1`} />
          
          <button onClick={handleAddUnavailableDate} disabled={saving || !newDate}
            className="bg-[#5A5A40] text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
            <Plus size={14} /> Add
          </button>
        </div>

        {/* Period info */}
        {newDate && (
          <p className="text-xs text-[#1A1A40]/60 mb-4 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            ℹ️ 
            {periodType === 'day' && ` This will mark ${new Date(newDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} as unavailable.`}
            {periodType === 'week' && ` This will mark the week of ${new Date(newDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${new Date(new Date(newDate + 'T00:00:00').setDate(new Date(newDate + 'T00:00:00').getDate() + 6)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} as unavailable.`}
            {periodType === 'month' && ` This will mark the entire month of ${new Date(newDate + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} as unavailable.`}
            {periodType === 'year' && ` This will mark the entire year ${new Date(newDate + 'T00:00:00').getFullYear()} as unavailable.`}
          </p>
        )}

        {/* Calendar View - Collapsible */}
        <div className="mt-4">
          <button onClick={() => setExpandDatesTable(!expandDatesTable)}
            className="w-full flex items-center justify-between bg-[#F5F5F0] hover:bg-[#EBEBDE] rounded-2xl px-4 py-3 transition-colors mb-3">
            <span className="text-sm font-bold text-[#1A1A1A] flex items-center gap-2">
              📅 View Unavailability Calendar
              {unavailableDates.length > 0 && (
                <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {unavailableDates.length} dates
                </span>
              )}
            </span>
            <motion.div animate={{ rotate: expandDatesTable ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight size={18} className="text-[#5A5A40]" />
            </motion.div>
          </button>

          <AnimatePresence>
            {expandDatesTable && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="bg-[#F5F5F0] rounded-2xl p-4 space-y-4">
                  {/* STATUS FILTERS */}
                  <div className="space-y-2 bg-white rounded-xl p-3 border border-[#1A1A1A]/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/50">Status Filters</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'all', label: '📊 All' },
                        { value: 'unavailable', label: '🔴 Unavailable' },
                        { value: 'available', label: '⚪ Available' },
                        { value: 'past', label: '⏳ Past' },
                      ].map(filter => (
                        <button key={filter.value} onClick={() => setFilterType(filter.value)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
                            filterType === filter.value
                              ? 'bg-[#5A5A40] text-white shadow-sm'
                              : 'bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] hover:border-[#5A5A40]'
                          }`}>
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* DAY OF WEEK FILTERS */}
                  <div className="space-y-2 bg-white rounded-xl p-3 border border-[#1A1A1A]/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/50">Filter by Day</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: null, label: '🔓 All Days' },
                        { value: 1, label: '📅 Monday' },
                        { value: 2, label: '📅 Tuesday' },
                        { value: 3, label: '📅 Wednesday' },
                        { value: 4, label: '📅 Thursday' },
                        { value: 5, label: '📅 Friday' },
                        { value: 6, label: '📅 Saturday' },
                        { value: 0, label: '📅 Sunday' },
                      ].map(day => (
                        <button key={day.value} onClick={() => setDayOfWeekFilter(dayOfWeekFilter === day.value ? null : day.value)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded transition-all ${
                            dayOfWeekFilter === day.value
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] hover:border-purple-400'
                          }`}>
                          {day.label.split(' ')[1] || 'All'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* YEAR & MONTH SELECTORS */}
                  <div className="space-y-3 bg-white rounded-xl p-3 border border-[#1A1A1A]/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/50">Navigation</p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Year Selector */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[#1A1A1A]/60">Year</label>
                        <div className="flex gap-1 items-center">
                          <button onClick={() => setCalendarYear(calendarYear - 1)}
                            className="p-1 hover:bg-[#F5F5F0] rounded transition-colors flex-shrink-0">
                            <ChevronRight size={16} className="transform rotate-180 text-[#5A5A40]" />
                          </button>
                          <select value={calendarYear} onChange={e => setCalendarYear(parseInt(e.target.value))}
                            className="flex-1 bg-[#F5F5F0] border border-[#1A1A1A]/10 rounded px-2 py-1.5 text-xs font-bold text-[#1A1A1A] focus:border-[#5A5A40] outline-none">
                            {[...Array(5)].map((_, i) => {
                              const year = new Date().getFullYear() + i;
                              return <option key={year} value={year}>{year}</option>;
                            })}
                          </select>
                          <button onClick={() => setCalendarYear(calendarYear + 1)}
                            className="p-1 hover:bg-[#F5F5F0] rounded transition-colors flex-shrink-0">
                            <ChevronRight size={16} className="text-[#5A5A40]" />
                          </button>
                        </div>
                      </div>

                      {/* Month Selector */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[#1A1A1A]/60">Month</label>
                        <div className="flex gap-1 items-center">
                          <button onClick={() => {
                            if (calendarMonth === 0) {
                              setCalendarMonth(11);
                              setCalendarYear(calendarYear - 1);
                            } else {
                              setCalendarMonth(calendarMonth - 1);
                            }
                          }}
                            className="p-1 hover:bg-[#F5F5F0] rounded transition-colors flex-shrink-0">
                            <ChevronRight size={16} className="transform rotate-180 text-[#5A5A40]" />
                          </button>
                          <select value={calendarMonth} onChange={e => setCalendarMonth(parseInt(e.target.value))}
                            className="flex-1 bg-[#F5F5F0] border border-[#1A1A1A]/10 rounded px-2 py-1.5 text-xs font-bold text-[#1A1A1A] focus:border-[#5A5A40] outline-none">
                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
                              <option key={idx} value={idx}>{month}</option>
                            ))}
                          </select>
                          <button onClick={() => {
                            if (calendarMonth === 11) {
                              setCalendarMonth(0);
                              setCalendarYear(calendarYear + 1);
                            } else {
                              setCalendarMonth(calendarMonth + 1);
                            }
                          }}
                            className="p-1 hover:bg-[#F5F5F0] rounded transition-colors flex-shrink-0">
                            <ChevronRight size={16} className="text-[#5A5A40]" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Jump to Today */}
                    <button onClick={() => {
                      const now = new Date();
                      setCalendarMonth(now.getMonth());
                      setCalendarYear(now.getFullYear());
                    }}
                      className="w-full text-[10px] font-bold px-3 py-1.5 bg-emerald-100 text-emerald-700 border border-emerald-300 rounded hover:bg-emerald-200 transition-colors">
                      📍 Jump to Today
                    </button>
                  </div>

                  {/* SELECTION MODE */}
                  <div className="space-y-2 bg-white rounded-xl p-3 border border-[#1A1A1A]/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/50">Selection Mode</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'single', label: '1️⃣ Single' },
                        { value: 'week', label: '7️⃣ Full Week' },
                        { value: 'month', label: '📆 Full Month' },
                        { value: 'all-weekday', label: '🔁 All Same Day' },
                      ].map(mode => (
                        <button key={mode.value} onClick={() => setSelectMode(mode.value)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded transition-all ${
                            selectMode === mode.value
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] hover:border-indigo-400'
                          }`}>
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  {(() => {
                    const firstDay = new Date(calendarYear, calendarMonth, 1);
                    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
                    const daysInMonth = lastDay.getDate();
                    const startingDayOfWeek = firstDay.getDay();
                    
                    const calendarDays = [];
                    for (let i = 0; i < startingDayOfWeek; i++) {
                      calendarDays.push(null);
                    }
                    for (let i = 1; i <= daysInMonth; i++) {
                      calendarDays.push(i);
                    }
                    
                    return (
                      <div className="space-y-3 bg-white rounded-xl p-4 border border-[#1A1A1A]/5">
                        <div className="text-sm font-bold text-[#1A1A1A] text-center">
                          {new Date(calendarYear, calendarMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                        </div>
                        
                        {/* Day of week headers */}
                        <div className="grid grid-cols-7 gap-1">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="text-center text-[9px] font-bold uppercase text-[#1A1A1A]/50 py-1">
                              {day}
                            </div>
                          ))}
                        </div>
                        
                        {/* Calendar dates grid */}
                        <div className="grid grid-cols-7 gap-1">
                          {calendarDays.map((day, idx) => {
                            if (day === null) {
                              return <div key={`empty-${idx}`} className="aspect-square"></div>;
                            }
                            
                            const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const dateObj = new Date(dateStr + 'T00:00:00');
                            const dayOfWeek = dateObj.getDay();
                            const isUnavailable = unavailableDates.includes(dateStr);
                            const isPast = dateStr < todayStr;
                            const isSelected = selectedDates.has(dateStr);
                            
                            // Apply filters
                            let matchesStatusFilter = true;
                            if (filterType === 'unavailable') matchesStatusFilter = isUnavailable;
                            else if (filterType === 'available') matchesStatusFilter = !isUnavailable && !isPast;
                            else if (filterType === 'past') matchesStatusFilter = isPast;
                            
                            let matchesDayFilter = dayOfWeekFilter === null || dayOfWeek === dayOfWeekFilter;
                            
                            const shouldShow = matchesStatusFilter && matchesDayFilter;
                            
                            return (
                              <div key={day}
                                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-bold cursor-pointer transition-all relative group
                                  ${!shouldShow 
                                    ? 'opacity-20 pointer-events-none' 
                                    : isSelected
                                    ? 'bg-blue-500 text-white border-2 border-blue-700 shadow-lg transform scale-105'
                                    : isUnavailable 
                                    ? 'bg-red-200 text-red-700 border-2 border-red-400 hover:shadow-md hover:bg-red-300' 
                                    : isPast
                                    ? 'bg-[#E8E8DC] text-[#1A1A1A]/40'
                                    : 'bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] hover:bg-blue-50 hover:shadow-md hover:border-blue-400'
                                  }
                                `}
                                onClick={() => {
                                  if (!shouldShow) return;
                                  
                                  if (isUnavailable) {
                                    handleRemoveDate(dateStr);
                                  } else if (!isPast) {
                                    let datesToAdd = [dateStr];
                                    
                                    // Selection mode logic
                                    if (selectMode === 'week') {
                                      // Add 7 consecutive days starting from this date
                                      const d = new Date(dateStr + 'T00:00:00');
                                      for (let i = 0; i < 7; i++) {
                                        const nextDate = new Date(d);
                                        nextDate.setDate(nextDate.getDate() + i);
                                        datesToAdd.push(nextDate.toISOString().split('T')[0]);
                                      }
                                    } else if (selectMode === 'month') {
                                      // Add all days in the current month
                                      const lastDayOfMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                                      for (let dayNum = 1; dayNum <= lastDayOfMonth; dayNum++) {
                                        const dateStr2 = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                        if (dateStr2 >= todayStr) datesToAdd.push(dateStr2);
                                      }
                                    } else if (selectMode === 'all-weekday') {
                                      // Add all occurrences of this day of week in the month
                                      const lastDayOfMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                                      for (let dayNum = 1; dayNum <= lastDayOfMonth; dayNum++) {
                                        const dateStr2 = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                        const dateObj2 = new Date(dateStr2 + 'T00:00:00');
                                        if (dateObj2.getDay() === dayOfWeek && dateStr2 >= todayStr) {
                                          datesToAdd.push(dateStr2);
                                        }
                                      }
                                    }
                                    
                                    // Toggle selection
                                    const newSet = new Set(selectedDates);
                                    datesToAdd.forEach(d => {
                                      if (newSet.has(d)) newSet.delete(d);
                                      else newSet.add(d);
                                    });
                                    setSelectedDates(newSet);
                                  }
                                }}
                                title={isUnavailable ? 'Click to remove' : isPast ? 'Past date' : 'Click to select'}>
                                {day}
                                {isUnavailable && <span className="text-[7px] mt-0.5">✕</span>}
                                {isSelected && <span className="text-[7px] mt-0.5">✓</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Selected Dates Actions */}
                  {selectedDates.size > 0 && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-bold text-blue-900">
                        ✓ {selectedDates.size} date(s) selected
                      </p>
                      <div className="flex gap-2 flex-wrap max-h-12 overflow-y-auto">
                        {Array.from(selectedDates).sort().map(date => (
                          <span key={date} className="text-[9px] bg-white rounded px-2 py-1 border border-blue-200 whitespace-nowrap">
                            {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-2 flex-wrap">
                        <button onClick={async () => {
                          const updated = [...new Set([...unavailableDates, ...Array.from(selectedDates)])].sort();
                          setSaving(true);
                          try {
                            await updateShop(shop.id, { unavailable_dates: updated });
                            setUnavailableDates(updated);
                            setSelectedDates(new Set());
                            setSuccess(`✓ ${selectedDates.size} date(s) marked as unavailable`);
                            onUpdated?.();
                            setTimeout(() => setSuccess(''), 3000);
                          } catch (err) {
                            setError(err.response?.data?.detail || 'Failed to update');
                          } finally {
                            setSaving(false);
                          }
                        }}
                          className="text-[10px] font-bold px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                          disabled={saving}>
                          🔴 Mark {selectedDates.size} Unavailable
                        </button>
                        <button onClick={() => setSelectedDates(new Set())}
                          className="text-[10px] font-bold px-3 py-1 bg-white border border-[#1A1A1A]/10 rounded hover:bg-[#F5F5F0] transition-colors">
                          ✕ Clear
                        </button>
                      </div>
                    </motion.div>
                  )}
                  
                  {/* Legend */}
                  <div className="bg-white rounded-xl p-3 border border-[#1A1A1A]/5 space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/50">Legend</p>
                    <div className="grid grid-cols-2 gap-3 text-[9px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 bg-red-200 border-2 border-red-400 rounded"></div>
                        <span>Unavailable</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 bg-white border border-[#1A1A1A]/10 rounded"></div>
                        <span>Available</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 bg-blue-500 border-2 border-blue-700 rounded"></div>
                        <span>Selected</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 bg-[#E8E8DC] rounded"></div>
                        <span>Past Date</span>
                      </div>
                    </div>
                  </div>

                  {/* Clear All Filters Button */}
                  <button onClick={() => {
                    setFilterType('all');
                    setDayOfWeekFilter(null);
                    const now = new Date();
                    setCalendarMonth(now.getMonth());
                    setCalendarYear(now.getFullYear());
                    setSelectedDates(new Set());
                  }}
                    className="w-full text-[10px] font-bold px-3 py-2 bg-[#F5F5F0] border border-[#1A1A1A]/10 text-[#1A1A1A] rounded-lg hover:bg-[#EBEBDE] transition-colors">
                    🔄 Reset All Filters
                  </button>

                  {/* Unavailable Dates Table */}
                  {unavailableDates.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#1A1A1A]/10">
                      <h4 className="text-sm font-bold text-[#1A1A1A] mb-3">All Unavailable Dates ({unavailableDates.length})</h4>
                      <div className="bg-white rounded-xl overflow-hidden border border-[#1A1A1A]/5 max-h-60 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-[#EBEBDE] border-b border-[#1A1A1A]/10 sticky top-0">
                            <tr>
                              <th className="text-left px-4 py-2 font-bold text-[#1A1A1A]">Date</th>
                              <th className="text-left px-4 py-2 font-bold text-[#1A1A1A]">Day</th>
                              <th className="text-left px-4 py-2 font-bold text-[#1A1A1A]">Status</th>
                              <th className="text-center px-4 py-2 font-bold text-[#1A1A1A]">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1A1A1A]/5">
                            {[...unavailableDates].sort().map(date => {
                              const dateObj = new Date(date + 'T00:00:00');
                              const dayName = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
                              const isPast = date < todayStr;
                              
                              return (
                                <tr key={date} className={`hover:bg-[#F5F5F0] transition-colors ${isPast ? 'opacity-60' : ''}`}>
                                  <td className="px-4 py-2.5 font-medium text-[#1A1A1A]">
                                    {dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </td>
                                  <td className="px-4 py-2.5 text-[#1A1A1A]/60">{dayName}</td>
                                  <td className="px-4 py-2.5">
                                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                                      isPast 
                                        ? 'bg-[#E8E8DC] text-[#1A1A1A]/40' 
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                      {isPast ? '✓ Passed' : '⊗ Closed'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    {!isPast && (
                                      <button onClick={() => handleRemoveDate(date)}
                                        className="text-red-600 hover:text-red-700 font-bold text-sm hover:bg-red-50 px-2 py-1 rounded transition-colors">
                                        Remove
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {unavailableDates.length === 0 && (
          <p className="text-sm text-[#1A1A1A]/30 italic">No unavailable dates set yet</p>
        )}
      </div>

      {/* Stock Management */}
      <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-6 shadow-sm">
        <h3 className="font-serif text-lg font-bold mb-4 flex items-center gap-2">
          <Package size={18} className="text-[#5A5A40]" /> Stock Management
        </h3>
        {productsLoading ? (
          <div className="py-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-[#5A5A40]/30" /></div>
        ) : products.length > 0 ? (
          <div className="space-y-2">
            {products.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-[#F5F5F0] rounded-xl px-4 py-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex-shrink-0">
                  {p.image ? <img src={fixImageUrl(p.image)} alt={p.name} className="w-full h-full object-cover" /> : <Package size={14} className="m-auto mt-3 text-[#5A5A40]/20" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{p.name}</p>
                  <p className="text-[10px] text-[#1A1A1A]/40">₹{p.price} · {p.category}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center bg-white rounded-lg border border-[#1A1A1A]/10 overflow-hidden">
                    <button onClick={() => handleUpdateStock(p, Math.max(0, p.stock - 1))} disabled={stockUpdating === p.id}
                      className="w-7 h-7 flex items-center justify-center text-[#5A5A40] hover:bg-[#F5F5F0] disabled:opacity-50"><Minus size={12} /></button>
                    <span className="w-8 text-center text-xs font-bold">{p.stock}</span>
                    <button onClick={() => handleUpdateStock(p, p.stock + 1)} disabled={stockUpdating === p.id}
                      className="w-7 h-7 flex items-center justify-center text-[#5A5A40] hover:bg-[#F5F5F0] disabled:opacity-50"><Plus size={12} /></button>
                  </div>
                  <button onClick={() => handleToggleStock(p)} disabled={stockUpdating === p.id}
                    className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg transition-colors ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
                    {stockUpdating === p.id ? '…' : p.status === 'active' ? 'In Stock' : 'Out of Stock'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#1A1A1A]/30 italic py-4 text-center">No products yet. Add products in the Inventory tab.</p>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────
export default function OwnerDashboard() {
  const { currentUser } = useApp();
  const location = useLocation();
  const [shops, setShops]       = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [tab, setTab]           = useState('Overview');
  const [loading, setLoading]   = useState(true);
  const [showOverviewAddModal, setShowOverviewAddModal] = useState(false);
  const [showOverviewBillModal, setShowOverviewBillModal] = useState(false);
  const [showOverviewSupportModal, setShowOverviewSupportModal] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [registering, setRegistering]   = useState(false);

  const loadShops = useCallback(() => {
    setLoading(true);
    getMyShops()
      .then(r => {
        setShops(r.data);
        if (r.data.length > 0) setSelectedShop(r.data[0]);
        else setRegistering(true);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadShops(); }, [loadShops]);

  useEffect(() => {
    if (!selectedShop || selectedShop.status !== 'approved') return;
    setAnalyticsLoading(true);
    getShopAnalytics(selectedShop.id)
      .then(r => setAnalytics(r.data))
      .catch(console.error)
      .finally(() => setAnalyticsLoading(false));
  }, [selectedShop]);

  useEffect(() => {
    if (location.state?.resetTab) {
      setTab('Overview');
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-[#5A5A40]" />
    </div>
  );

  if (registering) return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8">
      <ShopRegistrationForm onSaved={loadShops} />
    </div>
  );

  const lowStockCount = (analytics?.low_stock_items || []).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto p-4 sm:p-8">
      {/* ── Shop Identity Header (mock design) ────────────────────── */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="w-14 h-14 sm:w-20 sm:h-20 bg-white border border-[#1A1A1A]/10 rounded-2xl sm:rounded-3xl flex items-center justify-center text-[#5A5A40] shadow-sm overflow-hidden shrink-0">
            {selectedShop?.logo ? (
              <img src={selectedShop.logo} alt={selectedShop.name} className="w-full h-full object-cover" />
            ) : <Store size={32} />}
          </div>
          <div className="min-w-0">
            <p className="text-[#5A5A40] font-bold uppercase tracking-[0.2em] text-[10px] mb-2">
              Welcome back, {(currentUser?.display_name || 'Owner').split(' ')[0]}
            </p>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="font-serif text-xl sm:text-3xl font-bold truncate">{selectedShop?.name}</h2>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                selectedShop?.status === 'approved' ? 'bg-green-100 text-green-700' :
                selectedShop?.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {selectedShop?.status}
              </span>
            </div>
            <p className="text-[#1A1A1A]/60 flex items-center gap-2">
              <MapPin size={14} /> {selectedShop?.address}
            </p>
            <div className="flex gap-2 mt-2">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-[#F5F5F0] px-2 py-1 rounded text-[#1A1A1A]/40">{selectedShop?.timings}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Pending Approval Banner */}
      {selectedShop?.status === 'pending' && (
        <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-3xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
            <Clock size={24} />
          </div>
          <div>
            <h4 className="font-bold text-amber-900 text-lg">Registration Pending</h4>
            <p className="text-amber-700">Our team is reviewing <span className="font-bold">{selectedShop.name}</span>. It will be live on the marketplace soon.</p>
          </div>
        </div>
      )}

      {/* ── Tabs (mock animated underline) ─────────────────────────── */}
      <div className="flex gap-4 sm:gap-8 mb-8 border-b border-[#1A1A1A]/5 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <TabButton key={t} active={tab === t} onClick={() => setTab(t)} label={t} />
        ))}
      </div>

      {/* ── Tab Panels ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

      {tab === 'Overview' && (
        <motion.div
          key="overview"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-12"
        >
          {/* ── Your Shops horizontal cards ────────────────────────── */}
          <div className="space-y-6">
            <div className="flex items-end justify-between px-2">
              <div>
                <h3 className="font-serif text-2xl font-bold">Your Shops</h3>
                <p className="text-xs text-[#1A1A1A]/40 font-bold uppercase tracking-widest mt-1">Manage all your business locations</p>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
              {shops.map((s, idx) => (
                <div key={s.id} className="relative group">
                  <motion.div
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedShop(s)}
                    className="flex-shrink-0 w-40 sm:w-48 bg-white border border-[#1A1A1A]/5 rounded-2xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="aspect-[4/3] bg-[#F5F5F0] relative overflow-hidden">
                      {s.logo ? (
                        <img src={s.logo} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#5A5A40]/20">
                          <Store size={32} />
                        </div>
                      )}
                      <div className={`absolute top-2 left-2 backdrop-blur px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest border border-[#1A1A1A]/5 ${
                        s.status === 'pending' ? 'bg-amber-100/90 text-amber-700' : 'bg-white/90 text-[#5A5A40]'
                      }`}>
                        {s.status === 'pending' ? 'PENDING' : s.is_open ? 'OPEN' : 'CLOSED'}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <h4 className="font-serif text-sm font-bold truncate leading-tight flex-1">{s.name}</h4>
                        <div className="flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded text-[9px] font-bold text-green-700 border border-green-100 shrink-0">
                          <Star size={8} fill="currentColor" />
                          <span>{s.rating ? Number(s.rating).toFixed(1) : '4.5'}</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-[#1A1A1A]/40 truncate mb-2 flex items-center gap-1">
                        <MapPin size={8} /> {s.address}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-[#1A1A1A]/5">
                        <div className="flex gap-2.5">
                          <Phone size={12} className="text-[#5A5A40] hover:scale-110 transition-transform" />
                          <MessageCircle size={12} className="text-[#5A5A40] hover:scale-110 transition-transform" />
                        </div>
                        <span className="text-[9px] font-bold text-white bg-[#5A5A40] px-3 py-1 rounded-lg">
                          Manage
                        </span>
                      </div>
                    </div>
                  </motion.div>
                  {selectedShop?.id === s.id && (
                    <div className="absolute -top-2 -right-2 bg-[#5A5A40] text-white p-1 rounded-full shadow-lg z-10 border-2 border-white">
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                </div>
              ))}

              {/* Add New Shop card */}
              <button
                onClick={() => setRegistering(true)}
                className="flex-shrink-0 w-40 sm:w-48 bg-[#F5F5F0]/50 border-2 border-dashed border-[#1A1A1A]/10 rounded-2xl flex flex-col items-center justify-center gap-3 text-[#1A1A1A]/40 hover:bg-[#F5F5F0] hover:border-[#5A5A40]/30 transition-all group shadow-sm"
              >
                <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                  <Plus size={24} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">Add New Shop</span>
              </button>
            </div>
          </div>

          {/* ── Stats + Quick Actions grid ─────────────────────────── */}
          {analyticsLoading ? (
            <div className="py-12 text-center"><Loader2 size={32} className="animate-spin mx-auto text-[#5A5A40]" /></div>
          ) : analytics ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
                <StatCard
                  label="Today's Sales"
                  value={`₹${(analytics.today_sales || 0).toLocaleString()}`}
                  icon={<BarChart3 size={24} />}
                  onClick={() => setTab('Reports')}
                />
                <StatCard
                  label="Orders"
                  value={(analytics.today_orders || 0).toString()}
                  icon={<ClipboardList size={24} />}
                  onClick={() => setTab('Orders')}
                />
                <StatCard
                  label="Products"
                  value={(analytics.total_products || 0).toString()}
                  icon={<Package size={24} />}
                  onClick={() => setTab('Inventory')}
                />
                <StatCard
                  label="Low Stock"
                  value={lowStockCount.toString()}
                  icon={<AlertTriangle size={24} className={lowStockCount > 0 ? 'text-red-500' : ''} />}
                  onClick={() => setTab('Inventory')}
                />
              </div>

              <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 sm:p-8 shadow-sm">
                <h3 className="font-serif text-xl font-bold mb-6">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <ActionButton
                    icon={<Plus size={20} />}
                    label="Add Product"
                    color="bg-[#5A5A40]"
                    onClick={() => setShowOverviewAddModal(true)}
                  />
                  <ActionButton
                    icon={<ClipboardList size={20} />}
                    label="New Bill"
                    color="bg-[#1A1A1A]"
                    onClick={() => setShowOverviewBillModal(true)}
                  />
                  <ActionButton
                    icon={<Settings size={20} />}
                    label="Settings"
                    color="bg-[#F5F5F0]"
                    textColor="text-[#1A1A1A]"
                    onClick={() => setTab('Settings')}
                  />
                  <ActionButton
                    icon={<Phone size={20} />}
                    label="Support"
                    color="bg-[#F5F5F0]"
                    textColor="text-[#1A1A1A]"
                    onClick={() => setShowOverviewSupportModal(true)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center">
              <BarChart2 size={48} className="mx-auto text-[#5A5A40]/20 mb-4" />
              <p className="text-[#1A1A1A]/30 italic">Analytics available after shop is approved.</p>
            </div>
          )}

          {/* ── Weekly trend + details ─────────────────────────────── */}
          {analytics && (analytics.daily_sales || []).length > 1 && (
            <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
              <h4 className="font-serif text-lg font-bold mb-2">Weekly Revenue Trend</h4>
              <MiniLineChart data={analytics.daily_sales} valueKey="revenue" height={80} width={500} />
              <div className="flex justify-between mt-2 text-[10px] text-[#1A1A1A]/40 px-1">
                {analytics.daily_sales.map(d => <span key={d.date}>{d.day}</span>)}
              </div>
            </div>
          )}

          {analytics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
                <h4 className="font-serif text-lg font-bold mb-4">Orders by Status</h4>
                <div className="space-y-2">
                  {Object.entries(analytics.orders_by_status || {}).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-sm">
                      <span className="text-[#1A1A1A]/60 capitalize">{status.replace('_',' ')}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  ))}
                  {Object.keys(analytics.orders_by_status || {}).length === 0 && (
                    <p className="text-sm text-[#1A1A1A]/30 italic">No orders yet</p>
                  )}
                </div>
              </div>
              <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
                <h4 className="font-serif text-lg font-bold mb-4">Top Products</h4>
                <div className="space-y-2">
                  {(analytics.top_products || []).slice(0, 5).map((p, i) => (
                    <div key={p.product_id} className="flex justify-between text-sm">
                      <span className="text-[#1A1A1A]/60">{i + 1}. {p.name}</span>
                      <span className="font-bold">{p.quantity_sold} sold</span>
                    </div>
                  ))}
                  {(analytics.top_products || []).length === 0 && (
                    <p className="text-sm text-[#1A1A1A]/30 italic">No sales yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Low Stock Warnings */}
          {lowStockCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-amber-600" />
                <h4 className="font-bold text-amber-800">Low Stock Items</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {analytics.low_stock_items.map((item, i) => (
                  <span key={i} className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">
                    {item.name} ({item.stock})
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {tab === 'Reports' && (
        <motion.div key="reports" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          {analyticsLoading ? (
            <div className="py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-[#5A5A40]" /></div>
          ) : <AnalyticsPanel analytics={analytics} shopName={selectedShop?.name} shopId={selectedShop?.id} />}
        </motion.div>
      )}

      {tab === 'Billing' && selectedShop && (
        <motion.div key="billing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          <BillingPanel shopId={selectedShop.id} shops={shops} selectedShop={selectedShop} onShopChange={setSelectedShop} setTab={setTab} />
        </motion.div>
      )}

      {tab === 'Inventory' && selectedShop && (
        <motion.div key="inventory" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          <InventoryPanel shopId={selectedShop.id} allShops={shops} selectedShop={selectedShop} onShopChange={setSelectedShop} />
        </motion.div>
      )}

      {tab === 'Orders' && selectedShop && (
        <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          <OrdersPanel shopId={selectedShop.id} />
        </motion.div>
      )}

      {tab === 'Settings' && selectedShop && (
        <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          <ShopSettingsPanel shop={selectedShop} onUpdated={loadShops} />
        </motion.div>
      )}

      </AnimatePresence>

      {/* Overview Quick Action modals */}
      <AnimatePresence>
        {showOverviewAddModal && selectedShop && (
          <ProductModal
            shopId={selectedShop.id}
            product={null}
            onSave={() => { setShowOverviewAddModal(false); loadShops(); }}
            onClose={() => setShowOverviewAddModal(false)}
          />
        )}
        {showOverviewBillModal && selectedShop && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowOverviewBillModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
              onClick={e => e.stopPropagation()}>
              <div className="w-16 h-16 bg-[#1A1A1A] rounded-2xl flex items-center justify-center mx-auto mb-5">
                <ClipboardList size={28} className="text-white" />
              </div>
              <h3 className="font-serif text-2xl font-bold mb-2">Start New Bill</h3>
              <p className="text-sm text-[#1A1A1A]/50 mb-6">Open the billing panel to create a walk-in bill for a customer.</p>
              <button
                onClick={() => { setShowOverviewBillModal(false); setTab('Billing'); }}
                className="w-full bg-[#1A1A1A] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2">
                <ClipboardList size={18} /> Open Billing
              </button>
              <button onClick={() => setShowOverviewBillModal(false)}
                className="mt-3 w-full py-3 text-sm text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70 transition-colors">
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
        {showOverviewSupportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowOverviewSupportModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-2xl font-bold">Support</h3>
                <button onClick={() => setShowOverviewSupportModal(false)} className="p-2 rounded-full hover:bg-[#F5F5F0]"><X size={18} /></button>
              </div>
              <p className="text-sm text-[#1A1A1A]/50 mb-6">Need help? Reach us through any of these channels.</p>
              <div className="flex flex-col gap-3">
                <a href="tel:+911800123456"
                  className="flex items-center gap-4 p-4 bg-[#F5F5F0] rounded-2xl hover:bg-[#EBEBEB] transition-all">
                  <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center">
                    <Phone size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Call Us</p>
                    <p className="text-xs text-[#1A1A1A]/50">1800-123-456</p>
                  </div>
                </a>
                <a href="https://wa.me/911800123456" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 bg-[#F5F5F0] rounded-2xl hover:bg-[#EBEBEB] transition-all">
                  <div className="w-10 h-10 bg-[#25D366] rounded-xl flex items-center justify-center">
                    <MessageCircle size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">WhatsApp</p>
                    <p className="text-xs text-[#1A1A1A]/50">Chat with support</p>
                  </div>
                </a>
                <a href="mailto:support@hypermart.in"
                  className="flex items-center gap-4 p-4 bg-[#F5F5F0] rounded-2xl hover:bg-[#EBEBEB] transition-all">
                  <div className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center">
                    <AlertCircle size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Email</p>
                    <p className="text-xs text-[#1A1A1A]/50">support@hypermart.in</p>
                  </div>
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
