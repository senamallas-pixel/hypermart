// src/pages/OwnerDashboard.jsx
// Shop owner portal — Analytics, Inventory, Orders, Billing

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package, ShoppingBag, TrendingUp, DollarSign, Plus, Search,
  Edit3, Trash2, X, CheckCircle2, XCircle, Clock, ChevronRight,
  Truck, Store, AlertCircle, Loader2, BarChart2, Menu, Minus,
  Receipt, PieChart, Activity, ArrowUpRight, ArrowDownRight, Users,
  MapPin, Upload, Navigation, Image,
} from 'lucide-react';
import {
  getMyShops, createShop, updateShop,
  listProducts, createProduct, updateProduct, deleteProduct,
  getShopOrders, updateOrderStatus,
  getShopAnalytics, placeWalkinOrder,
  uploadFile,
} from '../api/client';
import { useApp } from '../context/AppContext';
import InvoiceModal from '../components/InvoiceModal';

const TABS      = ['Overview', 'Analytics', 'Billing', 'Inventory', 'Orders'];
const CATEGORIES= ['Grocery','Dairy','Vegetables & Fruits','Meat','Bakery & Snacks','Beverages','Household','Personal Care'];
const LOCATIONS = ['Green Valley','Central Market','Food Plaza','Milk Lane','Old Town'];
const SHOP_CATS = ['Grocery','Dairy','Vegetables & Fruits','Meat','Bakery & Snacks','Beverages','Household','Personal Care','General'];

// ── Stat Card ─────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-6 flex flex-col gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${accent || 'bg-[#5A5A40]/10'}`}>
        <Icon size={24} className="text-[#5A5A40]" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/40 mb-1">{label}</p>
        <p className="font-serif text-3xl font-bold text-[#1A1A1A]">{value}</p>
        {sub && <p className="text-xs text-[#1A1A1A]/40 mt-1">{sub}</p>}
      </div>
    </div>
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
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      setForm(f => ({ ...f, image: `${baseUrl}${res.data.url}` }));
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
          <select className={sel} value={form.category} onChange={set('category')}>
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
            className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
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
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      setForm(f => ({ ...f, logo: `${baseUrl}${res.data.url}` }));
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
    <div className="max-w-lg mx-auto">
      <h2 className="font-serif text-3xl font-bold mb-2">Register Your Shop</h2>
      <p className="text-sm text-[#1A1A1A]/40 mb-8">Fill in the details. You can update them later. Shops go live after admin approval.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className={inp} placeholder="Shop name *" value={form.name} onChange={set('name')} required />
        <input className={inp} placeholder="Full address *" value={form.address} onChange={set('address')} required />
        <div className="grid grid-cols-2 gap-4">
          <select className={`${inp} appearance-none`} value={form.category} onChange={set('category')}>
            {SHOP_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className={`${inp} appearance-none`} value={form.location_name} onChange={set('location_name')}>
            {LOCATIONS.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <input className={inp} placeholder="Timings (e.g. 9:00 AM – 9:00 PM)" value={form.timings} onChange={set('timings')} />

        {/* Location (Lat/Lng) */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/40 mb-2 block">Shop Location</label>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input className={inp} placeholder="Latitude" type="number" step="any" value={form.lat} onChange={set('lat')} />
            <input className={inp} placeholder="Longitude" type="number" step="any" value={form.lng} onChange={set('lng')} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={getCurrentLocation} disabled={locating}
              className="flex-1 flex items-center justify-center gap-2 border border-[#5A5A40]/30 rounded-2xl py-3 text-sm font-bold text-[#5A5A40] hover:bg-[#5A5A40]/5 transition-all disabled:opacity-50">
              {locating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
              {locating ? 'Getting location...' : 'Use Current Location'}
            </button>
            <button type="button" onClick={() => setMapPickerOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 border border-[#5A5A40]/30 rounded-2xl py-3 text-sm font-bold text-[#5A5A40] hover:bg-[#5A5A40]/5 transition-all">
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
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/40 mb-2 block">Shop Photo / Logo</label>
          <label className={`flex items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-[#1A1A1A]/15 rounded-2xl py-5 hover:border-[#5A5A40] transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 size={18} className="animate-spin text-[#5A5A40]" /> : <Upload size={18} className="text-[#5A5A40]" />}
            <span className="text-sm font-medium text-[#1A1A1A]/50">{uploading ? 'Uploading...' : 'Upload Shop Photo'}</span>
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
          </label>
          <input className={`${inp} mt-2`} placeholder="Or paste logo URL" value={form.logo} onChange={set('logo')} />
          {form.logo && (
            <div className="relative mt-3 w-full aspect-video rounded-2xl overflow-hidden bg-[#F5F5F0] border border-[#1A1A1A]/5">
              <img src={form.logo} alt="Shop logo preview" className="w-full h-full object-cover" referrerPolicy="no-referrer"
                onError={e => { e.target.style.display = 'none'; }} />
              <button type="button" onClick={() => setForm(f => ({ ...f, logo: '' }))}
                className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full hover:bg-white shadow-sm">
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        <button type="submit" disabled={saving}
          className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={18} className="animate-spin" /> Registering...</> : 'Submit for Approval'}
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
    </div>
  );
}

// ── Map Picker Modal (uses OpenStreetMap + Leaflet-like click-to-pick) ──────
function MapPickerModal({ initialLat, initialLng, onConfirm, onClose }) {
  const [pin, setPin] = useState({
    lat: initialLat || 17.385,
    lng: initialLng || 78.4867,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const mapRef = useRef(null);
  const [mapCenter, setMapCenter] = useState({
    lat: initialLat || 17.385,
    lng: initialLng || 78.4867,
  });
  const [zoom, setZoom] = useState(14);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const centerStart = useRef(null);

  // Tile math helpers for OSM
  const lon2tile = (lon, z) => ((lon + 180) / 360) * Math.pow(2, z);
  const lat2tile = (lat, z) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * Math.pow(2, z);
  const tile2lon = (x, z) => (x / Math.pow(2, z)) * 360 - 180;
  const tile2lat = (y, z) => {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  };

  const handleMapClick = (e) => {
    if (dragging) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const centerTileX = lon2tile(mapCenter.lng, zoom);
    const centerTileY = lat2tile(mapCenter.lat, zoom);
    const tileSize = 256;
    const scale = Math.pow(2, zoom);

    const pixelOffsetX = (x - w / 2);
    const pixelOffsetY = (y - h / 2);

    const tileX = centerTileX + pixelOffsetX / tileSize;
    const tileY = centerTileY + pixelOffsetY / tileSize;

    const clickLng = tile2lon(tileX, zoom);
    const clickLat = tile2lat(tileY, zoom);

    setPin({ lat: clickLat, lng: clickLng });
  };

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
    const scale = Math.pow(2, zoom);
    const tileSize = 256;
    const newCenterTileX = lon2tile(centerStart.current.lng, zoom) - dx / tileSize;
    const newCenterTileY = lat2tile(centerStart.current.lat, zoom) - dy / tileSize;
    setMapCenter({
      lat: tile2lat(newCenterTileY, zoom),
      lng: tile2lon(newCenterTileX, zoom),
    });
  };

  const handleMouseUp = () => {
    dragStart.current = null;
    centerStart.current = null;
  };

  // Search using Nominatim (free OSM geocoder)
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await resp.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lon);
        setPin({ lat: parsedLat, lng: parsedLng });
        setMapCenter({ lat: parsedLat, lng: parsedLng });
      } else {
        alert('Location not found. Try a different search term.');
      }
    } catch {
      alert('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  // Render tiles
  const renderTiles = () => {
    if (!mapRef.current) return null;
    const rect = mapRef.current.getBoundingClientRect();
    const w = rect.width || 500;
    const h = rect.height || 400;
    const tileSize = 256;

    const centerTileX = lon2tile(mapCenter.lng, zoom);
    const centerTileY = lat2tile(mapCenter.lat, zoom);

    const tilesX = Math.ceil(w / tileSize) + 2;
    const tilesY = Math.ceil(h / tileSize) + 2;

    const startTileX = Math.floor(centerTileX - tilesX / 2);
    const startTileY = Math.floor(centerTileY - tilesY / 2);

    const offsetX = (centerTileX - startTileX) * tileSize - w / 2;
    const offsetY = (centerTileY - startTileY) * tileSize - h / 2;

    const tiles = [];
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const tileXIdx = startTileX + tx;
        const tileYIdx = startTileY + ty;
        const maxTile = Math.pow(2, zoom);
        if (tileYIdx < 0 || tileYIdx >= maxTile) continue;
        const wrappedX = ((tileXIdx % maxTile) + maxTile) % maxTile;
        tiles.push(
          <img
            key={`${zoom}-${wrappedX}-${tileYIdx}`}
            src={`https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileYIdx}.png`}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: tx * tileSize - offsetX,
              top: ty * tileSize - offsetY,
              width: tileSize,
              height: tileSize,
              imageRendering: 'auto',
            }}
          />
        );
      }
    }

    // Pin marker position
    const pinTileX = lon2tile(pin.lng, zoom);
    const pinTileY = lat2tile(pin.lat, zoom);
    const pinPixelX = (pinTileX - startTileX) * tileSize - offsetX;
    const pinPixelY = (pinTileY - startTileY) * tileSize - offsetY;

    tiles.push(
      <div key="pin" style={{ position: 'absolute', left: pinPixelX - 12, top: pinPixelY - 32, zIndex: 10, pointerEvents: 'none' }}>
        <div className="flex flex-col items-center">
          <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
          <div className="w-0.5 h-3 bg-red-500" />
        </div>
      </div>
    );

    return tiles;
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="flex justify-between items-center p-5 border-b border-[#1A1A1A]/5">
          <h3 className="font-serif text-xl font-bold flex items-center gap-2"><MapPin size={20} className="text-[#5A5A40]" /> Pick Location</h3>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-full"><X size={20} /></button>
        </div>

        <div className="p-4">
          {/* Search bar */}
          <div className="flex gap-2 mb-3">
            <input
              className="flex-1 bg-[#F5F5F0] border border-[#1A1A1A]/5 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#5A5A40] transition-colors"
              placeholder="Search for a place..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} disabled={searching}
              className="px-4 py-2.5 bg-[#5A5A40] text-white rounded-xl text-sm font-bold hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center gap-2">
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Search
            </button>
          </div>

          {/* Map area */}
          <div
            ref={mapRef}
            className="relative w-full rounded-2xl overflow-hidden border border-[#1A1A1A]/10 cursor-crosshair select-none"
            style={{ height: 350 }}
            onClick={handleMapClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {renderTiles()}
            {/* Zoom controls */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
              <button type="button" onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(z + 1, 18)); }}
                className="w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center font-bold text-lg hover:bg-gray-50">+</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(z - 1, 2)); }}
                className="w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center font-bold text-lg hover:bg-gray-50">−</button>
            </div>
            {/* Attribution */}
            <div className="absolute bottom-0 right-0 z-20 text-[8px] text-[#1A1A1A]/40 bg-white/80 px-1">© OpenStreetMap</div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-[#1A1A1A]/50">
              📍 {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
            </p>
            <button type="button" onClick={() => onConfirm(pin.lat, pin.lng)}
              className="px-6 py-2.5 bg-[#5A5A40] text-white rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all flex items-center gap-2">
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
    </motion.div>
  );
}
