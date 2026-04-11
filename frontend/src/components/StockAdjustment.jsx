import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Search, Plus, Save, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Package, X, AlertTriangle, Clock,
} from 'lucide-react';
import { bulkUpdateProducts } from '../api/client';

export default function StockAdjustment({ products, shopId, onSaved }) {
  const [search, setSearch] = useState('');
  const [localEdits, setLocalEdits] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filterMode, setFilterMode] = useState('all');

  const isLowStock = (p) => {
    const threshold = p.low_stock_threshold ?? 0;
    return p.stock <= threshold && threshold > 0;
  };

  const isExpiring = (p) => {
    if (!p.expiry_date) return false;
    const diff = new Date(p.expiry_date).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };

  const filteredProducts = useMemo(() => {
    let base = products;
    if (filterMode === 'low_stock') base = products.filter(isLowStock);
    else if (filterMode === 'expiring') base = products.filter(isExpiring);
    return base.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search, filterMode]);

  useEffect(() => { setCurrentPage(1); }, [search, filterMode]);

  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    if (itemsPerPage === -1) return filteredProducts;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const handleLocalUpdate = (productId, updates) => {
    setLocalEdits(prev => ({ ...prev, [productId]: { ...prev[productId], ...updates } }));
    setSaveStatus('idle');
  };

  const getVal = (p, field) => localEdits[p.id]?.[field] ?? p[field];

  const handleSave = async () => {
    const editEntries = Object.entries(localEdits);
    if (editEntries.length === 0) return;
    setIsSaving(true);
    try {
      const items = editEntries.map(([id, updates]) => {
        const item = { product_id: parseInt(id) };
        if (updates.stock != null) item.stock = updates.stock;
        if (updates.low_stock_threshold != null) item.low_stock_threshold = updates.low_stock_threshold;
        if (updates.expiry_date !== undefined) item.expiry_date = updates.expiry_date || "";
        return item;
      });
      await bulkUpdateProducts(shopId, items);
      setLocalEdits({});
      setSaveStatus('success');
      if (onSaved) onSaved();
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Error saving:', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const lowStockItems  = products.filter(isLowStock);
  const expiringItems  = products.filter(isExpiring);
  const lowStockCount  = lowStockItems.length;
  const expiringCount  = expiringItems.length;

  return (
    <div className="space-y-4">

      {/* ── Low Stock Alert Banner ─────────────────────────────── */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="p-2 bg-red-100 rounded-xl shrink-0">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-bold text-red-800">Low Stock Alert</p>
              <span className="text-[10px] font-bold bg-red-200 text-red-700 px-2 py-0.5 rounded-full">{lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(p => (
                <button
                  key={p.id}
                  onClick={() => setFilterMode('low_stock')}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-colors"
                >
                  {p.image && <img src={p.image} alt="" className="w-4 h-4 rounded object-cover" referrerPolicy="no-referrer" />}
                  {p.name}
                  <span className="bg-red-200 text-red-800 px-1.5 rounded text-[10px]">{p.stock} left</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Expiring Alert Banner ──────────────────────────────── */}
      {expiringItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-xl shrink-0">
            <Clock size={18} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-bold text-amber-800">Expiring Soon</p>
              <span className="text-[10px] font-bold bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">{expiringItems.length} item{expiringItems.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {expiringItems.map(p => {
                const days = Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <button
                    key={p.id}
                    onClick={() => setFilterMode('expiring')}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-bold rounded-lg transition-colors"
                  >
                    {p.image && <img src={p.image} alt="" className="w-4 h-4 rounded object-cover" referrerPolicy="no-referrer" />}
                    {p.name}
                    <span className="bg-amber-200 text-amber-800 px-1.5 rounded text-[10px]">{days}d left</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Header + filters ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">Stock Adjustment</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${filterMode === 'all' ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] text-[#1A1A1A]/40 hover:bg-[#5A5A40]/10'}`}
            >All</button>
            <button
              onClick={() => setFilterMode('low_stock')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-1 ${filterMode === 'low_stock' ? 'bg-red-500 text-white' : 'bg-[#F5F5F0] text-[#1A1A1A]/40 hover:bg-red-500/10'}`}
            >
              <AlertTriangle size={10} />
              Low Stock {lowStockCount > 0 && <span className={`px-1.5 rounded-full text-[9px] ${filterMode === 'low_stock' ? 'bg-white/30 text-white' : 'bg-red-100 text-red-600'}`}>{lowStockCount}</span>}
            </button>
            <button
              onClick={() => setFilterMode('expiring')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-1 ${filterMode === 'expiring' ? 'bg-amber-500 text-white' : 'bg-[#F5F5F0] text-[#1A1A1A]/40 hover:bg-amber-500/10'}`}
            >
              <Clock size={10} />
              Expiring {expiringCount > 0 && <span className={`px-1.5 rounded-full text-[9px] ${filterMode === 'expiring' ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-600'}`}>{expiringCount}</span>}
            </button>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" size={16} />
          <input
            type="text" placeholder="Search products..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#1A1A1A]/10 rounded-xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
          />
        </div>
      </div>

      <div className="bg-white border border-[#1A1A1A]/10 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F5F5F0]/50 border-b border-[#1A1A1A]/5">
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Product</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center w-32">Price</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center w-32">MRP</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center w-40">Stock Qty</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center w-40">Restock Level</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center w-40">Expiry Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {paginatedProducts.map(p => {
                const stock = Number(getVal(p, 'stock'));
                const threshold = Number(getVal(p, 'low_stock_threshold') ?? 0);
                const lowStock = stock <= threshold && threshold > 0;
                const expiry = getVal(p, 'expiry_date');
                const expiryDate = expiry ? new Date(expiry) : null;
                const now = new Date();
                const thirtyDays = new Date(); thirtyDays.setDate(now.getDate() + 30);
                const isExp = expiryDate && expiryDate < now;
                const isExpSoon = expiryDate && !isExp && expiryDate <= thirtyDays;

                return (
                  <tr key={p.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#F5F5F0] rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Package size={20} className="text-[#5A5A40]/20" />}
                        </div>
                        <div>
                          <p className="font-bold text-[#1A1A1A]">{p.name}</p>
                          <p className="text-[10px] text-[#1A1A1A]/40 uppercase tracking-widest">{p.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6 text-center font-bold text-sm">₹{p.price}</td>
                    <td className="p-6 text-center font-bold text-sm text-[#5A5A40]">₹{p.mrp}</td>
                    <td className="p-6">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleLocalUpdate(p.id, { stock: Math.max(0, stock - 1) })} className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition-colors">
                            <Plus size={14} className="rotate-45" />
                          </button>
                          <input type="number" value={stock} onChange={e => handleLocalUpdate(p.id, { stock: Number(e.target.value) })} className="w-16 bg-[#F5F5F0] rounded-lg text-center font-bold py-1.5 outline-none" />
                          <button onClick={() => handleLocalUpdate(p.id, { stock: stock + 1 })} className="p-1.5 hover:bg-green-100 text-green-600 rounded-lg transition-colors">
                            <Plus size={14} />
                          </button>
                        </div>
                        {lowStock && <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[8px] font-bold uppercase tracking-widest rounded-md">Low Stock</span>}
                      </div>
                    </td>
                    <td className="p-6">
                      <input type="number" value={getVal(p, 'low_stock_threshold') ?? 0} onChange={e => handleLocalUpdate(p.id, { low_stock_threshold: Number(e.target.value) })} className="w-full bg-transparent border-b border-transparent focus:border-[#5A5A40] text-center font-bold outline-none py-1" />
                    </td>
                    <td className="p-6">
                      <div className="relative">
                        <input
                          type="date"
                          value={expiry ? expiry.split('T')[0] : ''}
                          onChange={e => handleLocalUpdate(p.id, { expiry_date: e.target.value || null })}
                          className={`w-full bg-transparent border-b border-transparent focus:border-[#5A5A40] text-center text-xs font-medium outline-none py-1 transition-colors ${isExp ? 'text-red-600 font-bold' : isExpSoon ? 'text-amber-600 font-bold' : ''}`}
                        />
                        {isExpSoon && !isExp && <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-amber-600 uppercase tracking-widest whitespace-nowrap">Expiring Soon</div>}
                        {isExp && <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-red-600 uppercase tracking-widest whitespace-nowrap">Expired</div>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedProducts.length === 0 && (
                <tr><td colSpan={6} className="p-12 text-center text-[#1A1A1A]/40 italic">No products found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredProducts.length > 0 && (
          <div className="p-6 bg-[#F5F5F0]/30 border-t border-[#1A1A1A]/5 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-widest">
              Showing {itemsPerPage === -1 ? filteredProducts.length : Math.min(itemsPerPage, filteredProducts.length - (currentPage - 1) * itemsPerPage)} of {filteredProducts.length} Products
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setItemsPerPage(itemsPerPage === -1 ? 10 : -1)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${itemsPerPage === -1 ? 'bg-[#5A5A40] text-white' : 'bg-white border border-[#1A1A1A]/10 text-[#1A1A1A]/60 hover:bg-[#F5F5F0]'}`}>
                {itemsPerPage === -1 ? 'Show Paginated' : 'Show All'}
              </button>
              {itemsPerPage !== -1 && (
                <div className="flex items-center gap-1 ml-2">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-2 bg-white border border-[#1A1A1A]/10 rounded-xl text-[#1A1A1A]/60 hover:bg-[#F5F5F0] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <ChevronLeft size={18} />
                  </button>
                  <div className="px-4 py-2 bg-white border border-[#1A1A1A]/10 rounded-xl text-xs font-bold text-[#5A5A40]">Page {currentPage} of {totalPages}</div>
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-2 bg-white border border-[#1A1A1A]/10 rounded-xl text-[#1A1A1A]/60 hover:bg-[#F5F5F0] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center pt-4">
        <motion.button
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          onClick={handleSave}
          disabled={isSaving || Object.keys(localEdits).length === 0}
          className={`flex items-center gap-3 px-10 py-4 rounded-2xl font-bold text-lg shadow-lg transition-all active:scale-95 ${
            saveStatus === 'success' ? 'bg-green-500 text-white' :
            saveStatus === 'error' ? 'bg-red-500 text-white' :
            'bg-[#5A5A40] text-white hover:bg-[#4A4A30] disabled:opacity-30 disabled:cursor-not-allowed'
          }`}
        >
          {isSaving ? 'Saving...' :
           saveStatus === 'success' ? <><CheckCircle2 size={20} /> Saved Successfully</> :
           saveStatus === 'error' ? <><AlertCircle size={20} /> Error Saving</> :
           <><Save size={20} /> Save Changes {Object.keys(localEdits).length > 0 && <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-lg text-xs">{Object.keys(localEdits).length}</span>}</>}
        </motion.button>
      </div>
    </div>
  );
}
