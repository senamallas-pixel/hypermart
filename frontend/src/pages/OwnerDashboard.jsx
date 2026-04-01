// src/pages/OwnerDashboard.jsx
// Shop owner portal — Analytics, Inventory, Orders, Billing

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package, ShoppingBag, TrendingUp, DollarSign, Plus, Search,
  Edit3, Trash2, X, CheckCircle2, XCircle, Clock, ChevronRight,
  Truck, Store, AlertCircle, Loader2, BarChart2, Menu, Minus,
  Receipt, PieChart, Activity, ArrowUpRight, ArrowDownRight, Users,
} from 'lucide-react';
import {
  getMyShops, createShop, updateShop,
  listProducts, createProduct, updateProduct, deleteProduct,
  getShopOrders, updateOrderStatus,
  getShopAnalytics, placeWalkinOrder,
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
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

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
          <input className={inp} placeholder="Image URL (optional)" value={form.image} onChange={set('image')} />
          {form.image && (
            <div className="w-full aspect-video rounded-2xl overflow-hidden bg-[#F5F5F0] border border-[#1A1A1A]/5">
              <img src={form.image} alt="preview" className="w-full h-full object-cover" referrerPolicy="no-referrer"
                onError={e => { e.target.style.display = 'none'; }} />
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
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const inp = 'w-full bg-[#F5F5F0] border border-[#1A1A1A]/5 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-[#5A5A40] transition-colors';

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await createShop(form); onSaved(); }
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
        <input className={inp} placeholder="Logo URL (optional)" value={form.logo} onChange={set('logo')} />
        <button type="submit" disabled={saving}
          className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={18} className="animate-spin" /> Registering...</> : 'Submit for Approval'}
        </button>
      </form>
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
      <div className="flex gap-1 mb-8 bg-[#F5F5F0] p-1 rounded-2xl w-fit border border-[#1A1A1A]/5">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${tab === t ? 'bg-white text-[#5A5A40] shadow-sm' : 'text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70'}`}>
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
              <StatCard icon={DollarSign} label="Total Revenue"   value={`₹${analytics.total_revenue?.toLocaleString() || 0}`} sub="All time" />
              <StatCard icon={ShoppingBag} label="Total Orders"   value={analytics.total_orders || 0} sub="All time" />
              <StatCard icon={TrendingUp}  label="Orders This Month" value={analytics.orders_this_month || 0} sub={new Date().toLocaleString('default',{month:'long'})} />
              <StatCard icon={Package}    label="Products"         value={analytics.product_count || 0} sub="In inventory" />
            </div>
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
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center">
            <BarChart2 size={48} className="mx-auto text-[#5A5A40]/20 mb-4" />
            <p className="text-[#1A1A1A]/30 italic">Analytics available after shop is approved.</p>
          </div>
        )
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
