// src/pages/AdminPanel.jsx
// Platform admin portal — approve shops, manage users, view analytics

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Store, Users, BarChart2, CheckCircle2, XCircle, Loader2,
  TrendingUp, ShoppingBag, DollarSign, Package, UserCheck,
  AlertCircle, Building2,
} from 'lucide-react';
import {
  listShops, updateShopStatus,
  listUsers, changeRole,
  getPlatformAnalytics,
} from '../api/client';
import { useApp } from '../context/AppContext';

const ADMIN_TABS = ['Shops', 'Users', 'Analytics'];

// ── Stat Card ─────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-6 flex flex-col gap-4">
      <div className="w-12 h-12 bg-[#5A5A40]/10 rounded-2xl flex items-center justify-center">
        <Icon size={24} className="text-[#5A5A40]" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/40 mb-1">{label}</p>
        <p className="font-serif text-3xl font-bold">{value}</p>
        {sub && <p className="text-xs text-[#1A1A1A]/40 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Shops Tab ─────────────────────────────────────────────────────
function ShopsTab() {
  const [shops, setShops]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('pending');
  const [acting, setActing]   = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    listShops({ status: filter, size: 200 })
      .then(r => setShops(r.data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { reload(); }, [reload]);

  const setStatus = async (shopId, status) => {
    setActing(shopId);
    try { await updateShopStatus(shopId, status); reload(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed.'); }
    finally { setActing(null); }
  };

  const FILTER_OPTS = [
    { key: 'pending',  label: 'Pending',  color: 'text-amber-700  bg-amber-50  border-amber-100' },
    { key: 'approved', label: 'Approved', color: 'text-green-700  bg-green-50  border-green-100' },
    { key: 'rejected', label: 'Rejected', color: 'text-red-700    bg-red-50    border-red-100' },
    { key: '',         label: 'All',      color: 'text-[#1A1A1A]/60 bg-[#F5F5F0] border-[#1A1A1A]/10' },
  ];
  const BADGE = {
    pending:  'bg-amber-50 text-amber-700 border-amber-100',
    approved: 'bg-green-50 text-green-700 border-green-100',
    rejected: 'bg-red-50 text-red-700 border-red-100',
  };

  return (
    <div>
      {/* Filter chips */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        {FILTER_OPTS.map(opt => (
          <button key={opt.key} onClick={() => setFilter(opt.key)}
            className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border whitespace-nowrap transition-all ${filter === opt.key ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : opt.color}`}>
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-[#5A5A40]" /></div>
      ) : shops.length === 0 ? (
        <div className="py-20 text-center bg-white border border-[#1A1A1A]/10 rounded-3xl">
          <Building2 size={40} className="mx-auto text-[#5A5A40]/20 mb-4" />
          <p className="text-[#1A1A1A]/30 italic">No shops in this category.</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-[#1A1A1A]/10 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[#1A1A1A]/5 bg-[#F5F5F0]">
              <tr>
                <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Shop</th>
                <th className="text-left px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 hidden sm:table-cell">Category</th>
                <th className="text-left px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 hidden md:table-cell">Location</th>
                <th className="text-left px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Status</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {shops.map(shop => (
                <tr key={shop.id} className="hover:bg-[#F5F5F0]/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F5F5F0] rounded-xl overflow-hidden flex-shrink-0">
                        {shop.logo ? <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Store size={16} className="m-auto mt-3 text-[#5A5A40]/30" />}
                      </div>
                      <div>
                        <p className="font-bold">{shop.name}</p>
                        <p className="text-[10px] text-[#1A1A1A]/40 truncate max-w-[160px]">{shop.address}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-[#1A1A1A]/50 hidden sm:table-cell">{shop.category}</td>
                  <td className="px-4 py-4 text-xs text-[#1A1A1A]/50 hidden md:table-cell">{shop.location_name || '—'}</td>
                  <td className="px-4 py-4">
                    <span className={`text-[9px] font-bold uppercase tracking-widest border px-2 py-0.5 rounded ${BADGE[shop.status] || 'bg-gray-50 text-gray-700'}`}>
                      {shop.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      {shop.status !== 'approved' && (
                        <button
                          disabled={acting === shop.id}
                          onClick={() => setStatus(shop.id, 'approved')}
                          className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all disabled:opacity-50"
                        >
                          {acting === shop.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />} Approve
                        </button>
                      )}
                      {shop.status !== 'rejected' && (
                        <button
                          disabled={acting === shop.id}
                          onClick={() => setStatus(shop.id, 'rejected')}
                          className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-red-200 text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-all disabled:opacity-50"
                        >
                          {acting === shop.id ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />} Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────
function UsersTab() {
  const { currentUser } = useApp();
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    listUsers()
      .then(r => setUsers(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleChangeRole = async (uid, newRole) => {
    if (uid === currentUser?.uid) { alert("You can't change your own role."); return; }
    setActing(uid);
    try { await changeRole(uid, newRole); reload(); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to change role.'); }
    finally { setActing(null); }
  };

  const ROLE_BADGE = {
    admin:    'bg-purple-50 text-purple-700 border-purple-100',
    owner:    'bg-blue-50 text-blue-700 border-blue-100',
    customer: 'bg-green-50 text-green-700 border-green-100',
  };

  return (
    <div>
      {loading ? (
        <div className="py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-[#5A5A40]" /></div>
      ) : (
        <div className="rounded-3xl border border-[#1A1A1A]/10 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[#1A1A1A]/5 bg-[#F5F5F0]">
              <tr>
                <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">User</th>
                <th className="text-left px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Role</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {users.map(user => (
                <tr key={user.uid} className="hover:bg-[#F5F5F0]/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#5A5A40]/10 rounded-xl flex items-center justify-center">
                        <span className="text-sm font-bold text-[#5A5A40]">{user.display_name?.[0]?.toUpperCase() || '?'}</span>
                      </div>
                      <p className="font-bold">{user.display_name || 'Unknown'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-[#1A1A1A]/50 hidden sm:table-cell">{user.email}</td>
                  <td className="px-4 py-4">
                    <span className={`text-[9px] font-bold uppercase tracking-widest border px-2 py-0.5 rounded ${ROLE_BADGE[user.role] || 'bg-gray-50 text-gray-700'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.uid !== currentUser?.uid && (
                      <select
                        value={user.role}
                        disabled={acting === user.uid}
                        onChange={e => handleChangeRole(user.uid, e.target.value)}
                        className="bg-[#F5F5F0] border border-[#1A1A1A]/10 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest outline-none focus:border-[#5A5A40] transition-colors appearance-none cursor-pointer disabled:opacity-50"
                      >
                        <option value="customer">Customer</option>
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────
function AnalyticsTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlatformAnalytics()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-[#5A5A40]" /></div>;
  if (!data) return <div className="py-20 text-center text-[#1A1A1A]/30 italic">Failed to load analytics.</div>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign}   label="Total Revenue"    value={`₹${(data.total_revenue || 0).toLocaleString()}`} sub="Platform-wide" />
        <StatCard icon={ShoppingBag}  label="Total Orders"     value={data.total_orders || 0} sub="All time" />
        <StatCard icon={Store}        label="Active Shops"      value={data.approved_shops || 0} sub={`${data.pending_shops || 0} pending`} />
        <StatCard icon={Users}        label="Total Users"       value={data.total_users || 0} sub={`${data.total_owners || 0} owners`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Orders by Status */}
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
          <h4 className="font-serif text-xl font-bold mb-6">Orders by Status</h4>
          <div className="space-y-3">
            {Object.entries(data.orders_by_status || {}).map(([status, count]) => {
              const max = Math.max(...Object.values(data.orders_by_status));
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#1A1A1A]/60 capitalize font-medium">{status.replace('_', ' ')}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                  <div className="h-2 bg-[#F5F5F0] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${(count / max) * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-[#5A5A40] rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shops by Category */}
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
          <h4 className="font-serif text-xl font-bold mb-6">Shops by Category</h4>
          <div className="space-y-3">
            {Object.entries(data.shops_by_category || {}).slice(0, 8).map(([cat, count]) => {
              const max = Math.max(...Object.values(data.shops_by_category));
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#1A1A1A]/60 font-medium">{cat}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                  <div className="h-2 bg-[#F5F5F0] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${(count / max) * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-[#5A5A40]/60 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Shops */}
      {(data.top_shops || []).length > 0 && (
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
          <h4 className="font-serif text-xl font-bold mb-6">Top Shops by Revenue</h4>
          <div className="space-y-4">
            {data.top_shops.map((shop, i) => (
              <div key={shop.shop_id} className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#5A5A40]/10 flex items-center justify-center text-[10px] font-bold text-[#5A5A40]">{i + 1}</span>
                  <div>
                    <p className="text-sm font-bold">{shop.shop_name}</p>
                    <p className="text-[10px] text-[#1A1A1A]/40">{shop.order_count} orders</p>
                  </div>
                </div>
                <p className="font-serif font-bold">₹{shop.revenue?.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Panel ──────────────────────────────────────────────
export default function AdminPanel() {
  const [tab, setTab] = useState('Shops');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto p-4 sm:p-8">
      <div className="mb-8">
        <h2 className="font-serif text-3xl font-bold">Admin Panel</h2>
        <p className="text-sm text-[#1A1A1A]/40 mt-1">Platform management</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-[#F5F5F0] p-1 rounded-2xl w-fit border border-[#1A1A1A]/5">
        {ADMIN_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${tab === t ? 'bg-white text-[#5A5A40] shadow-sm' : 'text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Shops'     && <ShopsTab />}
      {tab === 'Users'     && <UsersTab />}
      {tab === 'Analytics' && <AnalyticsTab />}
    </motion.div>
  );
}
