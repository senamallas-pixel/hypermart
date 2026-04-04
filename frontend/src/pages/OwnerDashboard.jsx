// src/pages/OwnerDashboard.jsx
// Shop owner portal — Analytics, Inventory, Orders, Billing

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package, ShoppingBag, TrendingUp, DollarSign, Plus, Search,
  Edit3, Trash2, X, CheckCircle2, XCircle, Clock, ChevronRight,
  Truck, Store, AlertCircle, Loader2, BarChart2, Menu, Minus,
  Receipt, PieChart, Activity, ArrowUpRight, ArrowDownRight, Users,
  MapPin, Upload, Navigation, Image, Calendar, Power, Save,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  getMyShops, createShop, updateShop,
  listProducts, createProduct, updateProduct, deleteProduct,
  getShopOrders, updateOrderStatus,
  getShopAnalytics, placeWalkinOrder,
  uploadFile,
} from '../api/client';
import { useApp } from '../context/AppContext';
import InvoiceModal from '../components/InvoiceModal';
import DailySalesCalendar from '../components/DailySalesCalendar';

// Fix Leaflet default marker icon (broken in bundlers)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const TABS      = ['Overview', 'Analytics', 'Billing', 'Inventory', 'Orders', 'Settings'];
const CATEGORIES= ['Grocery','Dairy','Vegetables & Fruits','Meat','Bakery & Snacks','Beverages','Household','Personal Care'];
const LOCATIONS = ['Green Valley','Central Market','Food Plaza','Milk Lane','Old Town'];
const SHOP_CATS = ['Grocery','Dairy','Vegetables & Fruits','Meat','Bakery & Snacks','Beverages','Household','Personal Care','General'];

// ── Stat Card ─────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-xl transition-shadow duration-300"
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${accent || 'bg-[#5A5A40]/10'}`}>
        <Icon size={24} className="text-[#5A5A40]" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/40 mb-1">{label}</p>
        <p className="font-serif text-3xl font-bold text-[#1A1A1A]">{value}</p>
        {sub && <p className="text-xs text-[#1A1A1A]/40 mt-1">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ── Product Form Modal ────────────────────────────────────────────
function ProductModal({ shopId, product, onSave, onClose }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    price: product?.price || '',
    mrp: product?.mrp || '',
    unit: product?.unit || 'kg',
    category: product?.category || CATEGORIES[0],
    stock: product?.stock ?? 100,
    image: product?.image || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFile(file);
      setForm(f => ({ ...f, image: `${import.meta.env.VITE_API_URL}${res.data.url}` }));
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
      const payload = { ...form, price: +form.price, mrp: +form.mrp || +form.price, stock: +form.stock };
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
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <h3 className="font-serif text-2xl font-bold">{product ? 'Edit Product' : 'Add Product'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-full"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className={inp} placeholder="Product name *" value={form.name} onChange={set('name')} required />
          <div className="grid grid-cols-2 gap-4">
            <input className={inp} placeholder="Selling price ₹ *" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} required />
            <input className={inp} placeholder="MRP ₹ (optional)" type="number" min="0" step="0.01" value={form.mrp} onChange={set('mrp')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input className={inp} placeholder="Unit (kg, pcs…) *" value={form.unit} onChange={set('unit')} required />
            <input className={inp} placeholder="Stock qty" type="number" min="0" value={form.stock} onChange={set('stock')} />
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
            {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : 'Save Product'}
          </button>
        </form>
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
      setForm(f => ({ ...f, logo: `${import.meta.env.VITE_API_URL}${res.data.url}` }));
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
    catch (err) { alert(err.response?.data?.detail || 'Failed to register shop.'); }
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
        <div className="grid grid-cols-2 gap-4">
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
function BillingPanel({ shopId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [bill, setBill]         = useState([]);        // { product, quantity }
  const [customerName, setCustomerName] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [placing, setPlacing]   = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);

  useEffect(() => {
    setLoading(true);
    listProducts(shopId)
      .then(r => setProducts(r.data))
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

  const billTotal = bill.reduce((s, b) => s + b.product.price * b.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!bill.length) return;
    setPlacing(true);
    try {
      const res = await placeWalkinOrder(shopId, {
        items: bill.map(b => ({ product_id: b.product.id, quantity: b.quantity })),
        customer_name: customerName || 'Walk-in Customer',
        payment_status: paymentStatus,
      });
      setLastOrder(res.data);
      setBill([]);
      setCustomerName('');
      // refresh products to reflect stock changes
      const pRes = await listProducts(shopId);
      setProducts(pRes.data);
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
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" />
          <input className="w-full pl-11 pr-4 py-3 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm font-medium outline-none focus:border-[#5A5A40] transition-colors"
            placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map(p => {
            const inBill = bill.find(b => b.product.id === p.id);
            return (
              <button key={p.id} onClick={() => addToBill(p)} disabled={p.stock < 1}
                className={`text-left bg-white border rounded-2xl p-4 transition-all hover:shadow-md disabled:opacity-40 ${inBill ? 'border-[#5A5A40] ring-1 ring-[#5A5A40]/20' : 'border-[#1A1A1A]/10'}`}>
                {p.image && <img src={p.image} alt={p.name} className="w-full h-20 object-cover rounded-xl mb-2" referrerPolicy="no-referrer" />}
                <p className="font-bold text-sm line-clamp-1">{p.name}</p>
                <p className="text-xs text-[#1A1A1A]/40">{p.unit} · Stock: {p.stock}</p>
                <p className="font-bold text-[#5A5A40] mt-1">₹{p.price}</p>
                {inBill && <span className="text-[10px] font-bold text-[#5A5A40] bg-[#5A5A40]/10 px-2 py-0.5 rounded-full mt-1 inline-block">×{inBill.quantity}</span>}
              </button>
            );
          })}
          {filtered.length === 0 && <p className="col-span-full text-center text-[#1A1A1A]/30 py-10 italic">No products found</p>}
        </div>
      </div>

      {/* Bill Summary */}
      <div className="lg:col-span-2">
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 sticky top-4">
          <div className="flex items-center gap-2 mb-5">
            <Receipt size={20} className="text-[#5A5A40]" />
            <h3 className="font-serif text-xl font-bold">Current Bill</h3>
          </div>

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
              {bill.map(b => (
                <div key={b.product.id} className="flex items-center gap-3 bg-[#F5F5F0] rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm line-clamp-1">{b.product.name}</p>
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
              ))}
            </div>
          )}

          {bill.length > 0 && (
            <>
              <div className="border-t border-[#1A1A1A]/10 pt-4 mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#1A1A1A]/50">Items</span>
                  <span className="font-bold">{bill.reduce((s, b) => s + b.quantity, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-serif text-2xl font-bold text-[#5A5A40]">₹{billTotal.toFixed(2)}</span>
                </div>
              </div>
              {/* Payment Status */}
              <div className="flex gap-2 mb-4">
                {['paid', 'pending'].map(s => (
                  <button key={s} onClick={() => setPaymentStatus(s)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${paymentStatus === s ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#1A1A1A]/50 border-[#1A1A1A]/10 hover:border-[#5A5A40]'}`}>
                    {s === 'paid' ? '✓ Paid' : '⏳ Pending'}
                  </button>
                ))}
              </div>
              <button onClick={handlePlaceOrder} disabled={placing}
                className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {placing ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : <><Receipt size={18} /> Bill ₹{billTotal.toFixed(2)}</>}
              </button>
            </>
          )}

          {/* Last Order Success */}
          <AnimatePresence>
            {lastOrder && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={18} className="text-green-600" />
                  <span className="font-bold text-green-800 text-sm">Order #{lastOrder.id} placed!</span>
                </div>
                <p className="text-xs text-green-700 mb-3">₹{lastOrder.total} · {lastOrder.delivery_address}</p>
                <div className="flex gap-2">
                  <button onClick={() => setInvoiceOrder(lastOrder)}
                    className="flex-1 text-xs font-bold uppercase tracking-widest text-[#5A5A40] border border-[#5A5A40]/30 py-2 rounded-xl hover:bg-[#5A5A40]/5 transition-all">
                    View Invoice
                  </button>
                  <button onClick={() => setLastOrder(null)}
                    className="px-4 py-2 text-xs font-bold text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70 transition-colors">
                    Dismiss
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {invoiceOrder && <InvoiceModal order={invoiceOrder} shopView onClose={() => setInvoiceOrder(null)} />}
      </div>
    </div>
  );
}

// ── Analytics Panel ───────────────────────────────────────────────
function AnalyticsPanel({ analytics }) {
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

  return (
    <div className="space-y-6">
      {/* Daily Sales Calendar With Walk-in and Online Breakdown */}
      <DailySalesCalendar analytics={analytics} />

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
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} className="text-amber-600" />
            <h4 className="font-serif text-lg font-bold">Low Stock Alerts</h4>
          </div>
          {lowStock.length > 0 ? (
            <div className="space-y-2">
              {lowStock.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <span className="text-sm font-medium text-amber-800">{item.name}</span>
                  <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{item.stock} left</span>
                </div>
              ))}
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
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    getShopOrders(shopId)
      .then(r => setOrders(r.data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [shopId]);

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

  if (loading) return (
    <div className="py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-[#5A5A40]" /></div>
  );

  return (
    <div className="space-y-4">
      {orders.length === 0 ? (
        <div className="py-20 text-center bg-white border border-[#1A1A1A]/10 rounded-3xl">
          <p className="text-[#1A1A1A]/30 italic">No orders yet.</p>
        </div>
      ) : orders.map(order => {
        const transition = ORDER_TRANSITIONS[order.status];
        const isLocked = updating === order.id;
        return (
          <div key={order.id} className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-widest">Order #{order.id}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${STATUS_BADGE[order.status] || 'bg-gray-50 text-gray-700'}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm font-bold">Customer #{order.customer_id}</p>
                <p className="text-xs text-[#1A1A1A]/40">{new Date(order.created_at).toLocaleString()}</p>
              </div>
              <p className="font-serif text-2xl font-bold">₹{order.total}</p>
            </div>
            <div className="mb-5 space-y-1">
              {order.items.map((item, i) => (
                <p key={i} className="text-sm text-[#1A1A1A]/70">{item.name} × {item.quantity} — <strong>₹{item.line_total ?? item.price * item.quantity}</strong></p>
              ))}
            </div>
            {order.delivery_address && (
              <p className="text-xs text-[#1A1A1A]/40 mb-4 border-t border-[#1A1A1A]/5 pt-4">{order.delivery_address}</p>
            )}
            {transition && (
              <div className="flex gap-3">
                <button
                  disabled={isLocked}
                  onClick={() => advance(order.id, transition.next)}
                  className={`flex-1 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${transition.color}`}
                >
                  {isLocked ? <Loader2 size={14} className="animate-spin" /> : <transition.icon size={14} />}
                  {transition.label}
                </button>
                {order.status === 'pending' && (
                  <button
                    disabled={isLocked}
                    onClick={() => reject(order.id)}
                    className="flex-1 border border-red-200 text-red-600 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 transition-all disabled:opacity-50"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                )}
              </div>
            )}
            <div className={`${transition ? 'mt-3 pt-3 border-t border-[#1A1A1A]/5' : ''}`}>
              <button onClick={() => setInvoiceOrder(order)}
                className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] hover:underline">
                View Invoice
              </button>
            </div>
          </div>
        );
      })}
      {invoiceOrder && <InvoiceModal order={invoiceOrder} shopView onClose={() => setInvoiceOrder(null)} />}
    </div>
  );
}

// ── Inventory Panel ───────────────────────────────────────────────
function InventoryPanel({ shopId }) {
  const [products, setProducts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    listProducts(shopId)
      .then(r => setProducts(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [shopId]);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try { await deleteProduct(shopId, id); reload(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to delete.'); }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" />
          <input
            className="w-full pl-11 pr-4 py-3 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm font-medium outline-none focus:border-[#5A5A40] transition-colors"
            placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => { setEditProduct(null); setShowModal(true); }}
          className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all flex items-center gap-2"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-[#5A5A40]" /></div>
      ) : filtered.length > 0 ? (
        <div className="rounded-3xl border border-[#1A1A1A]/10 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[#1A1A1A]/5 bg-[#F5F5F0]">
              <tr>
                <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Product</th>
                <th className="text-left px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 hidden sm:table-cell">Category</th>
                <th className="text-right px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Price</th>
                <th className="text-right px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 hidden md:table-cell">Stock</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-[#F5F5F0]/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F5F5F0] rounded-xl overflow-hidden flex-shrink-0">
                        {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Package size={16} className="m-auto mt-3 text-[#5A5A40]/30" />}
                      </div>
                      <div>
                        <p className="font-bold line-clamp-1">{p.name}</p>
                        <p className="text-xs text-[#1A1A1A]/40">{p.unit}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-[#1A1A1A]/50 hidden sm:table-cell">{p.category}</td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-bold">₹{p.price}</p>
                    {p.mrp > p.price && <p className="text-xs text-[#1A1A1A]/30 line-through">₹{p.mrp}</p>}
                  </td>
                  <td className="px-4 py-4 text-right text-xs text-[#1A1A1A]/50 hidden md:table-cell">{p.stock}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditProduct(p); setShowModal(true); }}
                        className="p-2 bg-[#F5F5F0] rounded-xl hover:bg-[#5A5A40]/10 transition-colors"><Edit3 size={14} /></button>
                      <button onClick={() => handleDelete(p.id)}
                        className="p-2 bg-[#F5F5F0] rounded-xl hover:bg-red-100 text-red-600 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-20 text-center bg-white border border-[#1A1A1A]/10 rounded-3xl">
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
  const [periodType, setPeriodType] = useState('day'); // day, week, month, year
  const [expandDatesTable, setExpandDatesTable] = useState(false); // Collapsible table state
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [filterType, setFilterType] = useState('all'); // all, unavailable, available, past
  const [dayOfWeekFilter, setDayOfWeekFilter] = useState(null); // Filter by day of week (0=Sun to 6=Sat)
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [selectMode, setSelectMode] = useState('single'); // single, week, month, all-weekday

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
                  {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <Package size={14} className="m-auto mt-3 text-[#5A5A40]/20" />}
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
  const [shops, setShops]       = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [tab, setTab]           = useState('Overview');
  const [loading, setLoading]   = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showShopMenu, setShowShopMenu] = useState(false);
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto p-4 sm:p-8">
      {/* Shop Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 bg-white border border-[#1A1A1A]/5 rounded-2xl flex items-center justify-center shadow-sm overflow-hidden">
            {selectedShop?.logo ? (
              <img src={selectedShop.logo} alt={selectedShop.name} className="w-full h-full object-cover" />
            ) : <Store size={24} className="text-[#5A5A40]/30" />}
          </div>
          <div>
            <h2 className="font-serif text-2xl font-bold">{selectedShop?.name}</h2>
            <div className="flex items-center gap-2">
              {selectedShop?.status === 'pending' && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertCircle size={10} /> Pending Approval
                </span>
              )}
              {selectedShop?.status === 'approved' && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={10} /> Live
                </span>
              )}
              {selectedShop?.status === 'rejected' && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <XCircle size={10} /> Rejected
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {shops.length > 1 && (
            <div className="relative">
              <button onClick={() => setShowShopMenu(v => !v)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm font-bold hover:bg-[#F5F5F0] transition-all">
                <Menu size={16} /> Switch Shop
              </button>
              {showShopMenu && (
                <div className="absolute right-0 mt-2 bg-white border border-[#1A1A1A]/10 rounded-2xl shadow-xl z-50 min-w-[200px] overflow-hidden">
                  {shops.map(s => (
                    <button key={s.id} onClick={() => { setSelectedShop(s); setShowShopMenu(false); }}
                      className={`w-full text-left px-4 py-3 text-sm font-medium hover:bg-[#F5F5F0] transition-colors ${s.id === selectedShop?.id ? 'bg-[#5A5A40]/5 font-bold' : ''}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={() => { setRegistering(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#5A5A40] text-white border border-[#5A5A40] rounded-2xl text-sm font-bold hover:bg-[#4A4A30] transition-all">
            <Plus size={16} /> New Shop
          </button>
        </div>
      </div>

      {/* Pending Approval Banner */}
      {selectedShop?.status === 'pending' && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-3xl p-6 flex gap-4 items-start">
          <AlertCircle size={24} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-800 mb-1">Awaiting Admin Approval</h4>
            <p className="text-amber-700/70 text-sm">Your shop is under review. You can start adding products now, but it will only be visible to customers after approval.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-[#F5F5F0] p-1 rounded-2xl w-fit max-w-full overflow-x-auto border border-[#1A1A1A]/5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap ${tab === t ? 'bg-white text-[#5A5A40] shadow-sm' : 'text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {tab === 'Overview' && (
        analyticsLoading ? (
          <div className="py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-[#5A5A40]" /></div>
        ) : analytics ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={DollarSign} label="Today's Sales"     value={`₹${(analytics.today_sales || 0).toLocaleString()}`} sub="Today" accent="bg-green-100" />
              <StatCard icon={ShoppingBag} label="Today's Orders"    value={analytics.today_orders || 0} sub="Today" accent="bg-blue-100" />
              <StatCard icon={TrendingUp}  label="Total Revenue"     value={`₹${(analytics.total_revenue || 0).toLocaleString()}`} sub="All time" />
              <StatCard icon={Package}    label="Products"           value={analytics.total_products || 0} sub="In inventory" />
            </div>
            {/* Mini trend line */}
            {(analytics.daily_sales || []).length > 1 && (
              <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
                <h4 className="font-serif text-lg font-bold mb-2">Weekly Revenue Trend</h4>
                <MiniLineChart data={analytics.daily_sales} valueKey="revenue" height={80} width={500} />
                <div className="flex justify-between mt-2 text-[10px] text-[#1A1A1A]/40 px-1">
                  {analytics.daily_sales.map(d => <span key={d.date}>{d.day}</span>)}
                </div>
              </div>
            )}
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
            {/* Low Stock Warnings */}
            {(analytics.low_stock_items || []).length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={18} className="text-amber-600" />
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
          </div>
        ) : (
          <div className="py-20 text-center">
            <BarChart2 size={48} className="mx-auto text-[#5A5A40]/20 mb-4" />
            <p className="text-[#1A1A1A]/30 italic">Analytics available after shop is approved.</p>
          </div>
        )
      )}

      {tab === 'Analytics' && (
        analyticsLoading ? (
          <div className="py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-[#5A5A40]" /></div>
        ) : <AnalyticsPanel analytics={analytics} />
      )}

      {tab === 'Billing' && selectedShop && (
        <BillingPanel shopId={selectedShop.id} />
      )}

      {tab === 'Inventory' && selectedShop && (
        <InventoryPanel shopId={selectedShop.id} />
      )}

      {tab === 'Orders' && selectedShop && (
        <OrdersPanel shopId={selectedShop.id} />
      )}

      {tab === 'Settings' && selectedShop && (
        <ShopSettingsPanel shop={selectedShop} onUpdated={loadShops} />
      )}
    </motion.div>
  );
}
