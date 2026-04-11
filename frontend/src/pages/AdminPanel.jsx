// src/pages/AdminPanel.jsx
// Platform admin portal — Pending Approvals, All Shops, Owners, Users

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Store, Users, CheckCircle2, XCircle, Loader2,
  TrendingUp, ShoppingBag, DollarSign, Package, UserCheck,
  AlertCircle, Building2, Search, Trash2, Lock, MapPin,
} from 'lucide-react';
import {
  listShops, updateShopStatus,
  listUsers, changeRole, deleteUser,
  getPlatformAnalytics,
  listSubscriptions,
  toggleMultiLocation,
} from '../api/client';
import { useApp } from '../context/AppContext';

const ADMIN_TABS = ['pending', 'all', 'owners', 'users'];

export default function AdminPanel() {
  const { currentUser } = useApp();
  const [tab, setTab] = useState('pending');
  const [shops, setShops] = useState([]);
  const [allShops, setAllShops] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [deletingUser, setDeletingUser] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  const showMsg = (type, text) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, allRes, usersRes] = await Promise.all([
        listShops({ status: 'pending', size: 200 }),
        listShops({ size: 200 }),
        listUsers(),
      ]);
      setShops(pendingRes.data.items);
      setAllShops(allRes.data.items);
      setUsers(usersRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleApprove = async (shopId) => {
    setActing(shopId);
    try {
      await updateShopStatus(shopId, 'approved');
      showMsg('success', 'Shop approved successfully.');
      reload();
    } catch (err) { showMsg('error', err.response?.data?.detail || 'Failed.'); }
    finally { setActing(null); }
  };

  const handleReject = async (shopId) => {
    setActing(shopId);
    try {
      await updateShopStatus(shopId, 'rejected');
      showMsg('success', 'Shop rejected.');
      reload();
    } catch (err) { showMsg('error', err.response?.data?.detail || 'Failed.'); }
    finally { setActing(null); }
  };

  const handleApproveAll = async () => {
    try {
      await Promise.all(shops.map(s => updateShopStatus(s.id, 'approved')));
      showMsg('success', 'All pending shops approved!');
      reload();
    } catch (err) { showMsg('error', err.response?.data?.detail || 'Failed.'); }
  };

  const handleChangeRole = async (userId, newRole) => {
    if (userId === currentUser?.id) { alert("You can't change your own role."); return; }
    setActing(userId);
    try {
      await changeRole(userId, newRole);
      showMsg('success', `Role updated to ${newRole}.`);
      reload();
    } catch (err) { showMsg('error', err.response?.data?.detail || 'Failed.'); }
    finally { setActing(null); }
  };

  const handleToggleMultiLoc = async (userId, enabled) => {
    setActing(userId);
    try {
      await toggleMultiLocation(userId, enabled);
      showMsg('success', `Multi-location ${enabled ? 'enabled' : 'disabled'}.`);
      reload();
    } catch (err) { showMsg('error', err.response?.data?.detail || 'Failed.'); }
    finally { setActing(null); }
  };

  const handleDeleteUser = async (userId) => {
    setActing(userId);
    try {
      await deleteUser(userId);
      setDeletingUser(null);
      showMsg('success', 'User deleted.');
      reload();
    } catch (err) { showMsg('error', err.response?.data?.detail || 'Failed.'); }
    finally { setActing(null); }
  };

  const pendingCount = shops.length;
  const ownersList = users.filter(u => u.role === 'owner');
  const customersList = users.filter(u => u.role !== 'owner');

  const STATUS_BADGE = {
    approved: 'bg-green-100 text-green-700 border-green-200',
    pending:  'bg-amber-100 text-amber-700 border-amber-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  };

  const tabLabels = {
    pending: `Pending Approvals (${pendingCount})`,
    all: `All Shops (${allShops.length})`,
    owners: `Owners (${ownersList.length})`,
    users: `Users (${customersList.length})`,
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="font-serif text-3xl font-bold">Admin Dashboard</h2>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <AnimatePresence>
            {statusMsg && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  statusMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {statusMsg.text}
              </motion.div>
            )}
          </AnimatePresence>
          {pendingCount > 0 && (
            <button onClick={handleApproveAll}
              className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2">
              <CheckCircle2 size={16} /> Approve All Pending
            </button>
          )}
        </div>
      </div>

      {/* Tabs with animated underline */}
      <div className="flex gap-2 sm:gap-4 mb-6 border-b border-[#1A1A1A]/10 overflow-x-auto no-scrollbar">
        {ADMIN_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-4 px-2 text-xs sm:text-sm font-bold uppercase tracking-normal sm:tracking-widest transition-all relative shrink-0 ${tab === t ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/40'}`}>
            {tabLabels[t]}
            {tab === t && <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-20 text-center text-[#1A1A1A]/40">
            <Loader2 size={32} className="animate-spin mx-auto mb-4 text-[#5A5A40]" />
            Loading data...
          </div>
        ) : tab === 'pending' ? (
          /* ── Pending Approvals ── */
          shops.length > 0 ? (
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {shops.map(shop => (
                <div key={shop.id} className="bg-[#F5F5F0]/30 rounded-3xl border border-[#1A1A1A]/5 overflow-hidden flex flex-col">
                  <div className="aspect-[4/3] bg-[#F5F5F0] relative overflow-hidden">
                    {shop.logo ? (
                      <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#5A5A40]/20">
                        <Store size={48} />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border border-amber-200">
                      PENDING
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h4 className="font-bold text-lg mb-1">{shop.name}</h4>
                    <p className="text-xs text-[#1A1A1A]/60 line-clamp-2 mb-2">{shop.address}</p>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-white/50 p-2 rounded-xl border border-[#1A1A1A]/5">
                        <p className="text-[8px] font-bold text-[#1A1A1A]/40 uppercase tracking-widest">Pincode</p>
                        <p className="text-xs font-bold">{shop.pincode || 'N/A'}</p>
                      </div>
                      <div className="bg-white/50 p-2 rounded-xl border border-[#1A1A1A]/5">
                        <p className="text-[8px] font-bold text-[#1A1A1A]/40 uppercase tracking-widest">City</p>
                        <p className="text-xs font-bold">{shop.city || 'N/A'}</p>
                      </div>
                      <div className="bg-white/50 p-2 rounded-xl border border-[#1A1A1A]/5">
                        <p className="text-[8px] font-bold text-[#1A1A1A]/40 uppercase tracking-widest">Radius</p>
                        <p className="text-xs font-bold">{shop.delivery_radius || 3} km</p>
                      </div>
                      <div className="bg-white/50 p-2 rounded-xl border border-[#1A1A1A]/5">
                        <p className="text-[8px] font-bold text-[#1A1A1A]/40 uppercase tracking-widest">Category</p>
                        <p className="text-xs font-bold">{shop.category || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-auto">
                      <button onClick={() => handleReject(shop.id)} disabled={acting === shop.id}
                        className="flex-1 py-2 border border-red-200 text-red-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-all disabled:opacity-50">
                        {acting === shop.id ? <Loader2 size={10} className="animate-spin mx-auto" /> : 'Reject'}
                      </button>
                      <button onClick={() => handleApprove(shop.id)} disabled={acting === shop.id}
                        className="flex-1 py-2 bg-green-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all shadow-sm disabled:opacity-50">
                        {acting === shop.id ? <Loader2 size={10} className="animate-spin mx-auto" /> : 'Approve'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <p className="text-[#1A1A1A]/60 font-medium">All caught up!</p>
              <p className="text-[#1A1A1A]/30 text-sm italic mt-1">No pending shop registrations.</p>
            </div>
          )
        ) : tab === 'all' ? (
          /* ── All Shops ── */
          allShops.length > 0 ? (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {allShops.map(shop => (
                <div key={shop.id} className="bg-white rounded-3xl border border-[#1A1A1A]/5 overflow-hidden flex flex-col group hover:shadow-md transition-all">
                  <div className="aspect-[4/3] bg-[#F5F5F0] relative overflow-hidden">
                    {shop.logo ? (
                      <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#5A5A40]/20">
                        <Store size={48} />
                      </div>
                    )}
                    <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border ${STATUS_BADGE[shop.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {shop.status}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h4 className="font-bold mb-1">{shop.name}</h4>
                    <p className="text-xs text-[#1A1A1A]/40 line-clamp-1 mb-2">{shop.address || '—'}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {shop.category && <span className="text-[8px] font-bold uppercase tracking-widest bg-[#5A5A40]/10 text-[#5A5A40] px-1.5 py-0.5 rounded">{shop.category}</span>}
                      {shop.location_name && <span className="text-[8px] font-bold uppercase tracking-widest bg-[#F5F5F0] text-[#1A1A1A]/50 px-1.5 py-0.5 rounded">{shop.location_name}</span>}
                    </div>
                    <div className="flex gap-2 mt-auto">
                      {shop.status !== 'approved' && (
                        <button onClick={() => handleApprove(shop.id)} disabled={acting === shop.id}
                          className="flex-1 py-1.5 bg-green-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all disabled:opacity-50">
                          Approve
                        </button>
                      )}
                      {shop.status !== 'rejected' && (
                        <button onClick={() => handleReject(shop.id)} disabled={acting === shop.id}
                          className="flex-1 py-1.5 border border-red-200 text-red-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-all disabled:opacity-50">
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-20 text-center text-[#1A1A1A]/30 italic">No shops found.</div>
          )
        ) : (tab === 'owners' || tab === 'users') ? (
          /* ── Owners / Users ── */
          <div className="p-6">
            <div className="mb-6 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" size={16} />
              <input type="text"
                placeholder={`Search ${tab === 'owners' ? 'owners' : 'users'} by email or name...`}
                value={userSearch} onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/10 transition-all text-sm" />
            </div>
            <div className="space-y-4">
              {(tab === 'owners' ? ownersList : customersList)
                .filter(u =>
                  (u.display_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
                  (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
                )
                .map(u => (
                  <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#F5F5F0]/30 rounded-2xl border border-[#1A1A1A]/5 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {u.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-bold text-sm truncate">{u.display_name || 'User'}</h5>
                        <p className="text-xs text-[#1A1A1A]/40 truncate">{u.email}</p>
                        <div className="flex gap-2 mt-1">
                          <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            u.role === 'owner' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {u.role}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {u.id !== currentUser?.id && (
                        <select value={u.role} disabled={acting === u.id}
                          onChange={e => handleChangeRole(u.id, e.target.value)}
                          className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-widest bg-white border border-[#1A1A1A]/10 px-2 py-2 rounded-xl outline-none focus:border-[#5A5A40] transition-colors cursor-pointer disabled:opacity-50">
                          <option value="customer">Customer</option>
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}

                      {u.role === 'owner' && (
                        <button onClick={() => handleToggleMultiLoc(u.id, !u.multi_location_enabled)}
                          disabled={acting === u.id}
                          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 ${
                            u.multi_location_enabled
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}>
                          <Lock size={10} />
                          <span className="whitespace-nowrap">
                            {u.multi_location_enabled ? 'Multi-Loc: ON' : 'Multi-Loc: OFF'}
                          </span>
                        </button>
                      )}

                      {u.id !== currentUser?.id && (
                        deletingUser === u.id ? (
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button onClick={() => handleDeleteUser(u.id)}
                              className="flex-1 sm:flex-none px-3 py-2 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-700">
                              Confirm
                            </button>
                            <button onClick={() => setDeletingUser(null)}
                              className="flex-1 sm:flex-none px-3 py-2 bg-[#F5F5F0] text-[#1A1A1A]/60 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#E5E5E0]">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setDeletingUser(u.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Delete User">
                            <XCircle size={18} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              {(tab === 'owners' ? ownersList : customersList).filter(u =>
                (u.display_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
                (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
              ).length === 0 && (
                <div className="p-10 text-center text-[#1A1A1A]/30 italic">
                  No {tab === 'owners' ? 'owners' : 'users'} found.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
