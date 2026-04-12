// src/components/GlobalSearch.jsx — Flipkart/Swiggy-style search overlay
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, X, Store, Package, Clock, Loader2, ArrowRight, TrendingUp,
} from 'lucide-react';
import { searchProducts, listShops } from '../api/client';
import { useApp } from '../context/AppContext';

const RECENT_KEY = 'hypermart_recent_searches';
const MAX_RECENT = 6;

const TRENDING = ['Milk', 'Rice', 'Bread', 'Eggs', 'Vegetables', 'Fruits'];

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function saveRecent(arr) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, MAX_RECENT)));
}

function fixImageUrl(url) {
  if (!url) return null;
  const idx = url.indexOf('https://res.cloudinary.com');
  if (idx > 0) return url.slice(idx);
  return url;
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSearch, setTargetShopId } = useApp();

  const [query, setQuery]       = useState('');
  const [focused, setFocused]   = useState(false);
  const [products, setProducts] = useState([]);
  const [shops, setShops]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [recent, setRecent]     = useState(getRecent);

  const inputRef     = useRef(null);
  const containerRef = useRef(null);

  // ── Debounced API search ──────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) { setProducts([]); setShops([]); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      const q = query.trim();
      const [prodRes, shopRes] = await Promise.allSettled([
        searchProducts(q, { size: 6 }),
        listShops({ search: q, size: 5 }),
      ]);
      setProducts(
        prodRes.status === 'fulfilled'
          ? (prodRes.value.data?.items || (Array.isArray(prodRes.value.data) ? prodRes.value.data : []))
          : []
      );
      setShops(
        shopRes.status === 'fulfilled'
          ? (shopRes.value.data?.items || (Array.isArray(shopRes.value.data) ? shopRes.value.data : []))
          : []
      );
      setLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // ── Close on outside click ────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setFocused(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Close when route changes ──────────────────────────────────
  useEffect(() => { setFocused(false); }, [location.pathname]);

  // ── Handlers ──────────────────────────────────────────────────
  const pushRecent = (term) => {
    const next = [term, ...recent.filter(r => r !== term)].slice(0, MAX_RECENT);
    setRecent(next);
    saveRecent(next);
  };

  const handleSelectProduct = (product) => {
    pushRecent(product.name);
    setQuery('');
    setFocused(false);
    setSearch('');
    setTargetShopId(product.shop_id);
    navigate('/marketplace');
  };

  const handleSelectShop = (shop) => {
    pushRecent(shop.name);
    setQuery('');
    setFocused(false);
    setSearch('');
    setTargetShopId(shop.id);
    navigate('/marketplace');
  };

  const handleRecentClick = (term) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  const handleTrendingClick = (term) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  const clearRecent = () => { setRecent([]); saveRecent([]); };

  const hasResults = products.length > 0 || shops.length > 0;

  return (
    <div ref={containerRef} className="flex-1 max-w-xs sm:max-w-lg relative z-50">
      {/* ── Search input ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 pointer-events-none" size={14} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search products, shops…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') { setFocused(false); inputRef.current?.blur(); }
          }}
          className="w-full pl-9 pr-8 py-2 bg-[#F5F5F0] rounded-xl text-sm outline-none focus:ring-2 ring-[#5A5A40]/20 focus:bg-white transition-all placeholder:text-[#1A1A1A]/30"
        />
        {query && (
          <button onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 hover:text-[#1A1A1A]/60 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Dropdown overlay ── */}
      {focused && (
        <>
          {/* Mobile backdrop */}
          <div className="fixed inset-0 bg-black/20 z-40 sm:hidden" onClick={() => setFocused(false)} />

          <div className="absolute top-full left-0 right-0 sm:right-auto sm:min-w-[420px] mt-2 bg-white rounded-2xl shadow-2xl border border-[#1A1A1A]/8 z-50 overflow-hidden max-h-[75vh] overflow-y-auto">

            {/* ─ Loading ─ */}
            {loading && (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 size={16} className="animate-spin text-[#5A5A40]" />
                <span className="text-xs text-[#1A1A1A]/40 font-medium">Searching…</span>
              </div>
            )}

            {/* ─ Empty state: recent + trending ─ */}
            {!loading && !query.trim() && (
              <div className="p-4 space-y-4">
                {recent.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 flex items-center gap-1.5">
                        <Clock size={10} /> Recent
                      </p>
                      <button onClick={clearRecent}
                        className="text-[9px] font-bold text-[#5A5A40] uppercase tracking-widest hover:underline">Clear</button>
                    </div>
                    <div className="space-y-0.5">
                      {recent.map((term, i) => (
                        <button key={i} onClick={() => handleRecentClick(term)}
                          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-[#F5F5F0] transition-colors text-left group">
                          <Clock size={12} className="text-[#1A1A1A]/20 shrink-0" />
                          <span className="text-sm text-[#1A1A1A]/70 flex-1">{term}</span>
                          <ArrowRight size={12} className="text-[#1A1A1A]/0 group-hover:text-[#1A1A1A]/30 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 flex items-center gap-1.5 mb-2">
                    <TrendingUp size={10} /> Trending
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {TRENDING.map(t => (
                      <button key={t} onClick={() => handleTrendingClick(t)}
                        className="px-3 py-1.5 bg-[#F5F5F0] rounded-lg text-xs font-medium text-[#1A1A1A]/60 hover:bg-[#5A5A40]/10 hover:text-[#5A5A40] transition-all">
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─ No results ─ */}
            {!loading && query.trim() && !hasResults && (
              <div className="py-10 px-6 text-center">
                <Package size={28} className="mx-auto text-[#1A1A1A]/12 mb-3" />
                <p className="text-sm font-bold text-[#1A1A1A]/50">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-[11px] text-[#1A1A1A]/30 mt-1">Try a different search term</p>
              </div>
            )}

            {/* ─ Products ─ */}
            {!loading && products.length > 0 && (
              <div className="p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 px-2 mb-2 flex items-center gap-1.5">
                  <Package size={10} /> Products
                </p>
                {products.map(p => (
                  <button key={p.id} onClick={() => handleSelectProduct(p)}
                    className="flex items-center gap-3 w-full px-2 py-2.5 rounded-xl hover:bg-[#F5F5F0] transition-colors text-left group">
                    <div className="w-11 h-11 bg-[#F5F5F0] rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-[#1A1A1A]/5">
                      {p.image
                        ? <img src={fixImageUrl(p.image)} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                        : <Package size={16} className="text-[#1A1A1A]/15" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate text-[#1A1A1A]/80">{p.name}</p>
                      <p className="text-[10px] text-[#1A1A1A]/35 truncate">
                        {p.shop_name}{p.category ? ` · ${p.category}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-[#5A5A40]">₹{p.price}</span>
                      {p.mrp > p.price && (
                        <p className="text-[9px] text-[#1A1A1A]/30 line-through">₹{p.mrp}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ─ Shops ─ */}
            {!loading && shops.length > 0 && (
              <div className={`p-3 ${products.length > 0 ? 'border-t border-[#1A1A1A]/6' : ''}`}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 px-2 mb-2 flex items-center gap-1.5">
                  <Store size={10} /> Shops
                </p>
                {shops.map(s => (
                  <button key={s.id} onClick={() => handleSelectShop(s)}
                    className="flex items-center gap-3 w-full px-2 py-2.5 rounded-xl hover:bg-[#F5F5F0] transition-colors text-left group">
                    <div className="w-11 h-11 bg-[#5A5A40]/8 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-[#1A1A1A]/5">
                      {s.logo
                        ? <img src={fixImageUrl(s.logo)} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                        : <Store size={16} className="text-[#5A5A40]/60" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate text-[#1A1A1A]/80">{s.name}</p>
                      <p className="text-[10px] text-[#1A1A1A]/35 truncate">
                        {s.category}{s.location_name ? ` · ${s.location_name}` : ''}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-[#1A1A1A]/0 group-hover:text-[#1A1A1A]/30 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
