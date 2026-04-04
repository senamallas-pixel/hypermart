// src/App.jsx — Root component: auth, nav, cart, shell

import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Store, ShoppingCart, User, LayoutDashboard, Settings,
  LogOut, MapPin, ChevronDown, ShoppingBag, Loader2, ArrowRight,
  Search, Package, ChevronRight, CheckCircle2, Eye, EyeOff, Phone,
  XCircle, Clock, Truck, Edit3, Save, Lock, AlertCircle, Plus,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import AIChatWidget from './components/AIChatWidget';
import { login, register, placeOrder, getMyOrders, getMyShops, getShopAnalytics, updateMe, changePassword, listProducts, uploadFile } from './api/client';
import { initI18n } from './lib/i18n';
import Marketplace        from './pages/Marketplace';
import OwnerDashboard     from './pages/OwnerDashboard';
import AdminPanel         from './pages/AdminPanel';
import CustomerProfile    from './pages/CustomerProfile';
import OrderHistory       from './pages/OrderHistory';
import CustomerSettings   from './pages/CustomerSettings';
import InvoiceModal       from './components/InvoiceModal';
import LanguageSelector   from './components/LanguageSelector';

// ── Constants ─────────────────────────────────────────────────────
const DEMO = [
  { label: 'Customer',   email: 'ravi@example.com',   password: 'Customer@123', role: 'customer' },
  { label: 'Shop Owner', email: 'anand@example.com',  password: 'Owner@123',    role: 'owner'    },
  { label: 'Admin',      email: 'senamallas@gmail.com', password: 'Admin@123',  role: 'admin'    },
];

const LOCATIONS = ['All', 'Green Valley', 'Central Market', 'Food Plaza', 'Milk Lane', 'Old Town'];

function roleHome(role) {
  if (role === 'admin') return '/admin';
  if (role === 'owner') return '/owner';
  return '/marketplace';
}

// ── Auth Guard ─────────────────────────────────────────────────────
function RequireAuth({ children, roles }) {
  const { currentUser, authLoading } = useApp();
  if (authLoading) return (
    <div className="h-screen flex items-center justify-center bg-[#F5F5F0]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-[#5A5A40] rounded-2xl flex items-center justify-center text-white font-serif font-bold text-xl animate-pulse">H</div>
        <Loader2 size={20} className="animate-spin text-[#5A5A40]/40" />
      </div>
    </div>
  );
  if (!currentUser) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(currentUser.role)) return <Navigate to={roleHome(currentUser.role)} replace />;
  return children;
}

// ── Sign In / Register ────────────────────────────────────────────
function SignIn() {
  const { signIn, currentUser, authLoading } = useApp();
  const navigate = useNavigate();
  const [tab, setTab]         = useState('login');   // 'login' | 'register'
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Login fields
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regName, setRegName]       = useState('');
  const [regEmail, setRegEmail]     = useState('');
  const [regPhone, setRegPhone]     = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole]       = useState('customer');

  if (!authLoading && currentUser) return <Navigate to={roleHome(currentUser.role)} replace />;
  if (authLoading) return (
    <div className="h-screen flex items-center justify-center bg-[#F5F5F0]">
      <Loader2 size={20} className="animate-spin text-[#5A5A40]/40" />
    </div>
  );

  const handleLogin = async (emailOvr, pwOvr) => {
    const e = (emailOvr || email).trim().toLowerCase();
    const p  = pwOvr || password;
    if (!e || !p) { setError('Email and password are required.'); return; }
    setLoading(true); setError('');
    try {
      const res = await login({ email: e, password: p });
      signIn(res.data.access_token, res.data.user);
      navigate(roleHome(res.data.user.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check credentials.');
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!regName || !regEmail || !regPassword) { setError('Name, email and password are required.'); return; }
    setLoading(true); setError('');
    try {
      const res = await register({ display_name: regName.trim(), email: regEmail.trim().toLowerCase(), phone: regPhone.trim() || undefined, password: regPassword, role: regRole });
      signIn(res.data.access_token, res.data.user);
      navigate(roleHome(res.data.user.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Try again.');
    } finally { setLoading(false); }
  };

  const ROLES = [
    { key: 'customer', label: 'Customer',   desc: 'Browse shops & order' },
    { key: 'owner',    label: 'Shop Owner', desc: 'List & manage your shop' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F0] via-[#F0F0E8] to-[#E8E8DC] flex items-center justify-center px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl shadow-[#5A5A40]/10 overflow-hidden">
          {/* Header */}
          <div className="bg-[#5A5A40] px-8 pt-10 pb-6">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
              <Store size={28} className="text-white" />
            </div>
            <h1 className="font-serif text-3xl font-bold text-white mb-0.5">HyperMart</h1>
            <p className="text-white/55 text-sm">Your neighbourhood marketplace</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#1A1A1A]/6">
            {['login', 'register'].map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-widest transition-all ${tab === t ? 'text-[#5A5A40] border-b-2 border-[#5A5A40] bg-[#5A5A40]/3' : 'text-[#1A1A1A]/35 hover:text-[#1A1A1A]/60'}`}>
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <div className="px-8 py-7 space-y-3">
            {tab === 'login' ? (
              <>
                <input className="w-full bg-[#F5F5F0] border border-transparent rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-[#5A5A40] focus:bg-white transition-all placeholder:text-[#1A1A1A]/30"
                  placeholder="Email address" type="email" value={email} autoComplete="email"
                  onChange={e => { setEmail(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                <div className="relative">
                  <input className="w-full bg-[#F5F5F0] border border-transparent rounded-2xl px-4 py-3.5 pr-11 text-sm outline-none focus:border-[#5A5A40] focus:bg-white transition-all placeholder:text-[#1A1A1A]/30"
                    placeholder="Password" type={showPw ? 'text' : 'password'} value={password} autoComplete="current-password"
                    onChange={e => { setPassword(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                  <button onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 hover:text-[#5A5A40] transition-colors">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-semibold text-red-500 px-1">{error}</motion.p>}
                <button onClick={() => handleLogin()} disabled={loading}
                  className="w-full bg-[#5A5A40] text-white py-3.5 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A30] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#5A5A40]/20">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in&hellip;</> : <>Sign In <ArrowRight size={16} /></>}
                </button>
                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-[#1A1A1A]/8" /><span className="text-[10px] font-bold text-[#1A1A1A]/25 uppercase tracking-widest">Quick demo</span><div className="flex-1 h-px bg-[#1A1A1A]/8" />
                </div>
                <div className="flex gap-2">
                  {DEMO.map(d => (
                    <button key={d.role} onClick={() => handleLogin(d.email, d.password)} disabled={loading}
                      className="flex-1 flex flex-col items-center gap-1.5 bg-[#F5F5F0] hover:bg-[#5A5A40]/8 border border-[#1A1A1A]/6 hover:border-[#5A5A40]/25 rounded-2xl px-2 py-3 transition-all disabled:opacity-50">
                      <div className="w-8 h-8 rounded-xl bg-[#5A5A40]/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-[#5A5A40]">{d.label[0]}</span>
                      </div>
                      <span className="text-[10px] font-bold text-[#1A1A1A]/60 truncate w-full text-center">{d.label}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <input className="w-full bg-[#F5F5F0] border border-transparent rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-[#5A5A40] focus:bg-white transition-all placeholder:text-[#1A1A1A]/30"
                  placeholder="Full name *" value={regName} onChange={e => { setRegName(e.target.value); setError(''); }} />
                <input className="w-full bg-[#F5F5F0] border border-transparent rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-[#5A5A40] focus:bg-white transition-all placeholder:text-[#1A1A1A]/30"
                  placeholder="Email address *" type="email" value={regEmail} autoComplete="email"
                  onChange={e => { setRegEmail(e.target.value); setError(''); }} />
                <div className="relative">
                  <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 pointer-events-none" />
                  <input className="w-full bg-[#F5F5F0] border border-transparent rounded-2xl pl-10 pr-4 py-3.5 text-sm outline-none focus:border-[#5A5A40] focus:bg-white transition-all placeholder:text-[#1A1A1A]/30"
                    placeholder="Phone number (optional)" type="tel" value={regPhone}
                    onChange={e => { setRegPhone(e.target.value); setError(''); }} />
                </div>
                <div className="relative">
                  <input className="w-full bg-[#F5F5F0] border border-transparent rounded-2xl px-4 py-3.5 pr-11 text-sm outline-none focus:border-[#5A5A40] focus:bg-white transition-all placeholder:text-[#1A1A1A]/30"
                    placeholder="Password (min 6 chars) *" type={showPw ? 'text' : 'password'} value={regPassword} autoComplete="new-password"
                    onChange={e => { setRegPassword(e.target.value); setError(''); }} />
                  <button onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 hover:text-[#5A5A40] transition-colors">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Role selector */}
                <div className="flex gap-2 pt-0.5">
                  {ROLES.map(r => (
                    <button key={r.key} onClick={() => setRegRole(r.key)}
                      className={`flex-1 p-3 rounded-2xl border-2 text-left transition-all ${regRole === r.key ? 'border-[#5A5A40] bg-[#5A5A40]/5' : 'border-[#1A1A1A]/8 hover:border-[#5A5A40]/25'}`}>
                      <p className="font-bold text-xs">{r.label}</p>
                      <p className="text-[10px] text-[#1A1A1A]/40 mt-0.5">{r.desc}</p>
                      {regRole === r.key && <div className="w-1.5 h-1.5 rounded-full bg-[#5A5A40] mt-1.5" />}
                    </button>
                  ))}
                </div>
                {regRole === 'owner' && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2.5">
                    <span className="text-amber-500 text-xs font-bold mt-0.5">&#8377;</span>
                    <p className="text-xs text-amber-700"><span className="font-bold">Shop Owner Subscription: &#8377;10/month</span> — required to create and manage shops. Activate after registration.</p>
                  </div>
                )}
                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-semibold text-red-500 px-1">{error}</motion.p>}
                <button onClick={handleRegister} disabled={loading}
                  className="w-full bg-[#5A5A40] text-white py-3.5 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A30] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#5A5A40]/20">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account&hellip;</> : <>Create Account <ArrowRight size={16} /></>}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Profile ────────────────────────────────────────────────────────
function Profile() {
  const { currentUser, signOut, setCurrentUser } = useApp();
  const navigate = useNavigate();
  const [selLoc, setSelLoc] = useState(localStorage.getItem('hm_location') || LOCATIONS[0]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [shops, setShops] = useState([]);
  const [shopAnalytics, setShopAnalytics] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);

  // Profile editing state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ display_name: '', phone: '', address: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Password change state
  const [showPwForm, setShowPwForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setEditForm({ display_name: currentUser.display_name || '', phone: currentUser.phone || '', address: currentUser.address || '' });
    if (currentUser.role === 'customer') {
      setOrdersLoading(true);
      getMyOrders().then(r => setOrders(r.data.items)).catch(console.error).finally(() => setOrdersLoading(false));
    }
    if (currentUser.role === 'owner') {
      getMyShops().then(r => {
        setShops(r.data);
        if (r.data.length > 0 && r.data[0].status === 'approved') {
          getShopAnalytics(r.data[0].id).then(a => setShopAnalytics(a.data)).catch(console.error);
        }
      }).catch(console.error);
    }
  }, [currentUser]);

  const handleLocationChange = loc => { setSelLoc(loc); localStorage.setItem('hm_location', loc); };
  const handleSignOut = () => { signOut(); navigate('/marketplace', { replace: true }); };

  const handleProfileSave = async () => {
    setEditSaving(true); setEditError(''); setEditSuccess('');
    try {
      const res = await updateMe({ display_name: editForm.display_name.trim(), phone: editForm.phone.trim() || null, address: editForm.address.trim() || null });
      setCurrentUser(res.data);
      setEditing(false);
      setEditSuccess('Profile updated successfully');
      setTimeout(() => setEditSuccess(''), 3000);
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Failed to update profile');
    } finally { setEditSaving(false); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const res = await uploadFile(file);
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const photoUrl = `${baseUrl}${res.data.url}`;
      const updated = await updateMe({ photo_url: photoUrl });
      setCurrentUser(updated.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to upload photo');
    } finally { setUploadingPhoto(false); }
  };

  const handlePasswordChange = async () => {
    setPwError(''); setPwSuccess('');
    if (!pwForm.current_password || !pwForm.new_password) { setPwError('All fields are required'); return; }
    if (pwForm.new_password.length < 6) { setPwError('New password must be at least 6 characters'); return; }
    if (pwForm.new_password !== pwForm.confirm_password) { setPwError('Passwords do not match'); return; }
    setPwSaving(true);
    try {
      await changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwSuccess('Password changed successfully');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setShowPwForm(false);
      setTimeout(() => setPwSuccess(''), 3000);
    } catch (err) {
      setPwError(err.response?.data?.detail || 'Failed to change password');
    } finally { setPwSaving(false); }
  };

  const ROLE_BG = { admin: 'bg-purple-100 text-purple-700 border-purple-200', owner: 'bg-blue-100 text-blue-700 border-blue-200', customer: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  const STATUS_CLS = {
    pending: 'bg-amber-100 text-amber-700', accepted: 'bg-blue-100 text-blue-700', ready: 'bg-indigo-100 text-indigo-700',
    out_for_delivery: 'bg-purple-100 text-purple-700', delivered: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
  };
  const inp = 'w-full bg-[#F5F5F0] border border-[#1A1A1A]/5 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-[#5A5A40] transition-colors';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto px-4 pb-28 pt-4 sm:pt-8 space-y-4">
      {/* Success Messages */}
      <AnimatePresence>
        {(editSuccess || pwSuccess) && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600" />
            <span className="text-sm font-medium text-green-700">{editSuccess || pwSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Card with Photo */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#1A1A1A]/5">
        <div className="flex items-center gap-4">
          <div className="relative group">
            {currentUser?.photo_url ? (
              <img src={currentUser.photo_url} alt={currentUser.display_name}
                className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-[#5A5A40] to-[#3A3A28] rounded-2xl flex items-center justify-center text-white font-serif text-2xl font-bold flex-shrink-0">
                {currentUser?.display_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              {uploadingPhoto ? <Loader2 size={18} className="text-white animate-spin" /> : <Edit3 size={14} className="text-white" />}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
            </label>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-bold truncate">{currentUser?.display_name || 'Guest'}</h2>
            <p className="text-sm text-[#1A1A1A]/40 truncate">{currentUser?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block text-[9px] font-bold uppercase tracking-widest border px-2 py-0.5 rounded-full ${ROLE_BG[currentUser?.role] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {currentUser?.role}
              </span>
              {currentUser?.phone && <span className="text-xs text-[#1A1A1A]/40">{currentUser.phone}</span>}
            </div>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="p-2 hover:bg-[#F5F5F0] rounded-xl transition-colors" title="Edit Profile">
              <Edit3 size={16} className="text-[#5A5A40]" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-[#1A1A1A]/5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35">Member Since</p>
            <p className="text-sm font-bold">{currentUser?.created_at ? new Date(currentUser.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35">User ID</p>
            <p className="text-xs font-mono text-[#1A1A1A]/50">{currentUser?.uid?.slice(0, 8)}…</p>
          </div>
          {currentUser?.role === 'customer' && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35">Total Orders</p>
              <p className="text-sm font-bold">{orders.length}</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Form */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#1A1A1A]/5 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 flex items-center gap-2">
                  <Edit3 size={12} /> Edit Profile
                </h3>
                <button onClick={() => { setEditing(false); setEditError(''); }} className="text-xs font-bold text-[#1A1A1A]/40 hover:text-[#1A1A1A]/60">Cancel</button>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1 block">Display Name</label>
                <input className={inp} value={editForm.display_name} onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Your name" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1 block">Phone</label>
                <input className={inp} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" type="tel" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1 block">Address</label>
                <textarea className={`${inp} resize-none`} rows={2} value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} placeholder="Your delivery address" />
              </div>
              {editError && <p className="text-xs font-semibold text-red-500">{editError}</p>}
              <button onClick={handleProfileSave} disabled={editSaving}
                className="w-full bg-[#5A5A40] text-white py-3 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {editSaving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save Changes</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change Password */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#1A1A1A]/5 overflow-hidden">
        <button onClick={() => { setShowPwForm(v => !v); setPwError(''); setPwSuccess(''); }}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#F5F5F0]/50 transition-colors">
          <span className="flex items-center gap-3 text-sm font-bold text-[#1A1A1A]/70"><Lock size={16} className="text-[#5A5A40]" /> Change Password</span>
          <ChevronRight size={16} className={`text-[#1A1A1A]/30 transition-transform ${showPwForm ? 'rotate-90' : ''}`} />
        </button>
        <AnimatePresence>
          {showPwForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-6 pb-5 space-y-3 border-t border-[#1A1A1A]/5 pt-4">
                <div className="relative">
                  <input className={inp} type={showCurrentPw ? 'text' : 'password'} placeholder="Current password"
                    value={pwForm.current_password} onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} />
                  <button onClick={() => setShowCurrentPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 hover:text-[#5A5A40]">
                    {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div className="relative">
                  <input className={inp} type={showNewPw ? 'text' : 'password'} placeholder="New password (min 6 chars)"
                    value={pwForm.new_password} onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} />
                  <button onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 hover:text-[#5A5A40]">
                    {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <input className={inp} type="password" placeholder="Confirm new password"
                  value={pwForm.confirm_password} onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))} />
                {pwError && <p className="text-xs font-semibold text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {pwError}</p>}
                <button onClick={handlePasswordChange} disabled={pwSaving}
                  className="w-full bg-[#5A5A40] text-white py-3 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {pwSaving ? <><Loader2 size={14} className="animate-spin" /> Changing…</> : 'Update Password'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Owner: Shop Summary */}
      {currentUser?.role === 'owner' && shops.length > 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#1A1A1A]/5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-4 flex items-center gap-2">
            <Store size={12} /> My Shops
          </h3>
          <div className="space-y-3">
            {shops.map(s => (
              <div key={s.id} className="flex items-center gap-3 bg-[#F5F5F0] rounded-2xl px-4 py-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex-shrink-0">
                  {s.logo ? <img src={s.logo} alt={s.name} className="w-full h-full object-cover" /> : <Store size={16} className="m-auto mt-3 text-[#5A5A40]/30" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{s.name}</p>
                  <p className="text-xs text-[#1A1A1A]/40">{s.category} · {s.location_name}</p>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${s.status === 'approved' ? 'bg-green-100 text-green-700' : s.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
          {shopAnalytics && (
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#1A1A1A]/5">
              <div className="bg-[#F5F5F0] rounded-xl px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35">Revenue</p>
                <p className="font-serif text-lg font-bold">₹{(shopAnalytics.total_revenue || 0).toLocaleString()}</p>
              </div>
              <div className="bg-[#F5F5F0] rounded-xl px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35">Orders</p>
                <p className="font-serif text-lg font-bold">{shopAnalytics.total_orders || 0}</p>
              </div>
              <div className="bg-[#F5F5F0] rounded-xl px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35">Products</p>
                <p className="font-serif text-lg font-bold">{shopAnalytics.total_products || 0}</p>
              </div>
              <div className="bg-[#F5F5F0] rounded-xl px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35">Today Sales</p>
                <p className="font-serif text-lg font-bold">₹{(shopAnalytics.today_sales || 0).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customer: Location */}
      {currentUser?.role === 'customer' && (
        <div className="bg-white rounded-3xl px-6 py-5 shadow-sm border border-[#1A1A1A]/5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-4 flex items-center gap-2">
            <MapPin size={12} /> Delivery Location
          </h3>
          <div className="flex flex-wrap gap-2">
            {LOCATIONS.map(loc => (
              <button key={loc} onClick={() => handleLocationChange(loc)}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${selLoc === loc ? 'bg-[#5A5A40]/10 border-[#5A5A40] text-[#5A5A40] font-bold' : 'bg-[#F5F5F0] border-transparent text-[#1A1A1A]/50 hover:border-[#5A5A40]/20'}`}>
                {loc}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Customer: Recent Orders */}
      {currentUser?.role === 'customer' && (
        <div className="bg-white rounded-3xl px-6 py-5 shadow-sm border border-[#1A1A1A]/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 flex items-center gap-2">
              <Package size={12} /> Recent Orders
            </h3>
            {orders.length > 0 && (
              <button onClick={() => navigate('/orders')} className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] hover:underline">
                View All →
              </button>
            )}
          </div>
          {ordersLoading ? (
            <div className="py-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-[#5A5A40]/30" /></div>
          ) : orders.length > 0 ? (
            <div className="space-y-2">
              {orders.slice(0, 5).map(order => (
                <div key={order.id} className="flex items-center justify-between bg-[#F5F5F0] rounded-xl px-4 py-3 hover:bg-[#EBEBDB] transition-colors cursor-pointer"
                  onClick={() => setInvoiceOrder(order)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <p className="font-bold text-sm">#{order.id} · {order.shop_name}</p>
                      <p className="text-xs text-[#1A1A1A]/40">{new Date(order.created_at).toLocaleDateString('en-IN')} · {order.items.length} items</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${STATUS_CLS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                    <span className="font-bold text-sm">₹{order.total}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#1A1A1A]/30 italic py-4 text-center">No orders yet</p>
          )}
        </div>
      )}

      {/* App Info */}
      <div className="bg-white rounded-3xl px-6 py-4 shadow-sm border border-[#1A1A1A]/5 divide-y divide-[#1A1A1A]/5">
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-[#1A1A1A]/60">Version</span>
          <span className="text-xs font-bold text-[#5A5A40]">HyperMart v2</span>
        </div>
      </div>

      <button onClick={handleSignOut}
        className="w-full flex items-center justify-between px-6 py-4 bg-red-50 border border-red-100 rounded-3xl text-red-600 font-bold hover:bg-red-100 active:scale-[0.98] transition-all">
        <span className="flex items-center gap-3 text-sm"><LogOut size={16} /> Sign Out</span>
        <ChevronRight size={16} className="opacity-40" />
      </button>

      {invoiceOrder && <InvoiceModal order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />}
    </motion.div>
  );
}

// ── Top Nav ────────────────────────────────────────────────────────
function TopNav() {
  const { currentUser, signOut, search, setSearch, activeLocation, setActiveLocation } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isAuth = location.pathname === '/login';
  if (isAuth) return null;

  const isMarketplace = location.pathname === '/marketplace';
  const handleSignOut = () => { signOut(); navigate('/'); setShowUserMenu(false); };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#1A1A1A]/6 safe-top">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(currentUser ? roleHome(currentUser.role) : '/marketplace')}
          className="flex items-center gap-2 shrink-0 active:scale-95 transition-transform">
          <div className="w-8 h-8 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white shadow-sm">
            <Store size={16} />
          </div>
          <span className="font-serif text-lg font-bold tracking-tight hidden sm:block">HyperMart</span>
        </button>

        {isMarketplace && (
          <div className="flex-1 max-w-xs sm:max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 pointer-events-none" size={14} />
            <input type="text" placeholder="Search shops or categories&hellip;" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#F5F5F0] rounded-xl text-sm outline-none focus:ring-2 ring-[#5A5A40]/15 transition-all placeholder:text-[#1A1A1A]/30" />
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <div className="flex items-center gap-1 px-3 py-1.5 bg-[#F5F5F0] rounded-full border border-[#1A1A1A]/6 hover:bg-[#EBEBDB] transition-all cursor-pointer">
            <MapPin size={12} className="text-[#5A5A40] shrink-0" />
            <div className="relative flex items-center">
              <select value={activeLocation} onChange={e => setActiveLocation(e.target.value)}
                className="appearance-none bg-transparent pr-4 text-[10px] font-bold uppercase tracking-widest focus:outline-none cursor-pointer max-w-[72px] sm:max-w-[110px] truncate">
                {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-0 pointer-events-none text-[#5A5A40]" />
            </div>
          </div>

          <LanguageSelector />

          {currentUser ? (
            <div className="relative flex items-center gap-1">
              <div className="hidden md:flex flex-col items-end mr-1">
                <span className="text-[9px] font-bold text-[#5A5A40] uppercase tracking-widest leading-none">{currentUser.role}</span>
                <span className="text-xs font-bold truncate max-w-[90px] leading-tight">{currentUser.display_name}</span>
              </div>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                title="User menu"
                className="w-8 h-8 flex items-center justify-center hover:bg-[#F5F5F0] rounded-xl transition-colors text-[#5A5A40]">
                <User size={16} />
              </button>
              
              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute top-full mt-1 right-0 bg-white border border-[#1A1A1A]/10 rounded-xl shadow-lg min-w-max">
                  <button
                    onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-[#F5F5F0] transition-colors text-sm font-medium flex items-center gap-2 border-b border-[#1A1A1A]/5"
                  >
                    <User size={14} /> Profile
                  </button>
                  <button
                    onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-[#F5F5F0] transition-colors text-sm font-medium flex items-center gap-2 border-b border-[#1A1A1A]/5"
                  >
                    <Settings size={14} /> Settings
                  </button>
                  {currentUser.role === 'customer' && (
                    <button
                      onClick={() => { navigate('/orders'); setShowUserMenu(false); }}
                      className="w-full text-left px-4 py-2 hover:bg-[#F5F5F0] transition-colors text-sm font-medium flex items-center gap-2 border-b border-[#1A1A1A]/5"
                    >
                      <ShoppingBag size={14} /> Orders
                    </button>
                  )}
                  <button 
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 hover:bg-[#F5F5F0] transition-colors text-sm font-medium flex items-center gap-2 text-red-600"
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => navigate('/login')}
              className="bg-[#5A5A40] text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#4A4A30] active:scale-95 transition-all shadow-sm">
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Bottom Nav ─────────────────────────────────────────────────────
function BottomNav() {
  const { currentUser, cartItemCount } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const GUEST_TABS = [
    { path: '/marketplace', icon: ShoppingBag,  label: 'Shop'    },
    { path: '/cart',        icon: ShoppingCart,  label: 'Cart',   badge: cartItemCount },
    { path: '/orders',      icon: CheckCircle2,  label: 'Orders'  },
    { path: '/login',       icon: User,          label: 'Login'   },
  ];
  const CUSTOMER_TABS = [
    { path: '/marketplace', icon: ShoppingBag,  label: 'Shop'    },
    { path: '/cart',        icon: ShoppingCart,  label: 'Cart',   badge: cartItemCount },
    { path: '/orders',      icon: CheckCircle2,  label: 'Orders'  },
    { path: '/profile',     icon: User,          label: 'Profile' },
  ];
  const OWNER_TABS = [
    { path: '/owner',   icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/profile', icon: User,            label: 'Profile'   },
  ];
  const ADMIN_TABS = [
    { path: '/admin',   icon: Settings, label: 'Admin'   },
    { path: '/profile', icon: User,     label: 'Profile' },
  ];

  const tabs = !currentUser ? GUEST_TABS : currentUser.role === 'admin' ? ADMIN_TABS : currentUser.role === 'owner' ? OWNER_TABS : CUSTOMER_TABS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#1A1A1A]/8 safe-bottom sm:hidden z-50">
      <div className="flex justify-around items-center px-2 py-1.5">
        {tabs.map(tab => {
          const active = location.pathname === tab.path || (tab.path !== '/' && location.pathname.startsWith(tab.path));
          return (
            <button key={tab.path} onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-2xl transition-all active:scale-90 ${active ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/35'}`}>
              <div className="relative">
                {active && <div className="absolute inset-0 -m-1.5 bg-[#5A5A40]/10 rounded-xl" />}
                <tab.icon size={20} className="relative" />
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[#FF3269] text-white text-[8px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-bold uppercase tracking-[0.08em]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── Cart Page ──────────────────────────────────────────────────────
function CartPage() {
  const { currentUser, cart, cartTotal, updateQuantity, clearCart } = useApp();
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);

  const handlePlace = async () => {
    if (cart.items.length === 0) return;
    if (!currentUser) { navigate('/login'); return; }
    setPlacing(true);
    try {
      const res = await placeOrder({
        shop_id:          cart.shopId,
        items:            cart.items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
        delivery_address: 'Default Address',
      });
      clearCart();
      setPlacedOrder(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to place order.');
    } finally {
      setPlacing(false);
    }
  };

  if (placedOrder) return (
    <>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-[60vh] flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>
        <h2 className="font-serif text-2xl font-bold mb-2">Order Placed!</h2>
        <p className="text-[#1A1A1A]/40 text-sm mb-6">Your order #{placedOrder.id} has been confirmed.</p>
        <div className="flex gap-3">
          <button onClick={() => setShowInvoice(true)}
            className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-sm flex items-center gap-2">
            View Invoice
          </button>
          <button onClick={() => navigate('/orders')}
            className="px-6 py-3 rounded-2xl border border-[#1A1A1A]/10 text-sm font-bold text-[#1A1A1A]/60 hover:bg-[#F5F5F0] transition-all">
            My Orders
          </button>
        </div>
      </motion.div>
      {showInvoice && <InvoiceModal order={placedOrder} onClose={() => setShowInvoice(false)} />}
    </>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto px-4 pb-32 pt-4 sm:pt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-2xl font-bold">Your Cart</h2>
        {cart.items.length > 0 && (
          <button onClick={clearCart} className="text-xs font-bold text-red-500 uppercase tracking-widest hover:text-red-600">Clear all</button>
        )}
      </div>

      {cart.items.length === 0 ? (
        <div className="py-20 text-center bg-white border border-[#1A1A1A]/5 rounded-3xl">
          <div className="w-16 h-16 bg-[#F5F5F0] rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart size={28} className="text-[#5A5A40]/30" />
          </div>
          <p className="text-[#1A1A1A]/30 italic mb-6 text-sm">Your cart is empty</p>
          <button onClick={() => navigate('/marketplace')}
            className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-sm">
            Browse Shops
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white border border-[#1A1A1A]/5 rounded-2xl px-5 py-3 flex items-center gap-3">
            <Store size={14} className="text-[#5A5A40]" />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35">Ordering from</p>
              <p className="font-bold text-sm">{cart.shopName}</p>
            </div>
          </div>

          {cart.items.map(item => (
            <div key={item.productId} className="bg-white border border-[#1A1A1A]/5 rounded-2xl p-4 flex gap-3 items-center">
              <div className="w-14 h-14 bg-[#F5F5F0] rounded-xl overflow-hidden flex-shrink-0">
                {item.image ? <img src={item.image} className="w-full h-full object-cover" alt={item.name} /> : <Package size={16} className="m-auto mt-4 text-[#5A5A40]/20" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{item.name}</p>
                <p className="text-xs text-[#1A1A1A]/40">&#8377;{item.price} / {item.unit}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="font-bold text-sm">&#8377;{item.price * item.quantity}</p>
                <div className="flex items-center bg-[#F5F5F0] rounded-xl overflow-hidden border border-[#1A1A1A]/6">
                  <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center font-bold text-[#5A5A40] hover:bg-[#5A5A40]/10 active:bg-[#5A5A40]/20 transition-colors">&#8722;</button>
                  <span className="w-7 text-center text-sm font-bold">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center font-bold text-[#5A5A40] hover:bg-[#5A5A40]/10 active:bg-[#5A5A40]/20 transition-colors">&#43;</button>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-5 space-y-3">
            <div className="flex justify-between text-sm text-[#1A1A1A]/50">
              <span>Subtotal</span><span className="font-medium">&#8377;{cartTotal}</span>
            </div>
            <div className="flex justify-between text-sm text-[#1A1A1A]/50">
              <span>Delivery</span><span className="text-green-600 font-bold">FREE</span>
            </div>
            <div className="flex justify-between items-center border-t border-[#1A1A1A]/6 pt-3">
              <span className="font-bold uppercase tracking-widest text-xs text-[#1A1A1A]/40">Total</span>
              <span className="font-serif text-3xl font-bold">&#8377;{cartTotal}</span>
            </div>
            <button onClick={handlePlace} disabled={placing}
              className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#5A5A40]/20 mt-2">
              {placing ? <><Loader2 size={16} className="animate-spin" /> Placing Order&hellip;</> : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Orders Page ────────────────────────────────────────────────────
const ORDER_STEPS = ['pending', 'accepted', 'ready', 'out_for_delivery', 'delivered'];
const STEP_LABELS = { pending: 'Order Placed', accepted: 'Accepted', ready: 'Ready', out_for_delivery: 'Out for Delivery', delivered: 'Delivered' };
const STEP_ICONS = { pending: Clock, accepted: CheckCircle2, ready: Package, out_for_delivery: Truck, delivered: CheckCircle2 };

function OrderTracker({ status }) {
  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-2 bg-red-50 rounded-xl px-4 py-2.5 mt-3">
        <XCircle size={16} className="text-red-500" />
        <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Order Rejected</span>
      </div>
    );
  }
  const currentIdx = ORDER_STEPS.indexOf(status);
  return (
    <div className="mt-3 pt-3 border-t border-[#1A1A1A]/5">
      <div className="flex items-center justify-between relative">
        {/* Connecting line */}
        <div className="absolute top-3 left-4 right-4 h-0.5 bg-[#F5F5F0]" />
        <div className="absolute top-3 left-4 h-0.5 bg-[#5A5A40] transition-all" style={{ width: currentIdx >= 0 ? `${Math.min((currentIdx / (ORDER_STEPS.length - 1)) * 100, 100)}%` : '0%' }} />
        {ORDER_STEPS.map((step, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          const StepIcon = STEP_ICONS[step];
          return (
            <div key={step} className="flex flex-col items-center relative z-10">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${done ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] text-[#1A1A1A]/25'} ${active ? 'ring-2 ring-[#5A5A40]/30 ring-offset-1' : ''}`}>
                <StepIcon size={12} />
              </div>
              <span className={`text-[8px] font-bold uppercase tracking-widest mt-1.5 text-center leading-tight max-w-[56px] ${done ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/25'}`}>
                {STEP_LABELS[step]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrdersPage() {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    getMyOrders()
      .then(r => setOrders(r.data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentUser]);

  if (!currentUser) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto px-4 pb-32 pt-12 text-center">
        <div className="w-16 h-16 bg-[#F5F5F0] rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-[#5A5A40]/25" />
        </div>
        <h2 className="font-serif text-2xl font-bold mb-2">Track your orders</h2>
        <p className="text-[#1A1A1A]/40 text-sm mb-6">Sign in to view your order history.</p>
        <button onClick={() => navigate('/login')}
          className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-sm">
          Sign In
        </button>
      </motion.div>
    );
  }

  const STATUS = {
    pending:          { cls: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500'   },
    accepted:         { cls: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500'    },
    ready:            { cls: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500'  },
    out_for_delivery: { cls: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500'  },
    delivered:        { cls: 'bg-green-100 text-green-700',   dot: 'bg-green-500'   },
    rejected:         { cls: 'bg-red-100 text-red-700',       dot: 'bg-red-500'     },
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto px-4 pb-28 pt-4 sm:pt-8">
      <h2 className="font-serif text-2xl font-bold mb-6">My Orders</h2>
      <div className="space-y-3">
        {loading
          ? Array(3).fill(0).map((_, i) => <div key={i} className="h-28 bg-white animate-pulse rounded-2xl" />)
          : orders.length > 0
            ? orders.map(order => {
                const s = STATUS[order.status] || { cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
                const isExpanded = expandedOrder === order.id;
                return (
                  <div key={order.id} className="bg-white border border-[#1A1A1A]/5 rounded-2xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-4 mb-3 cursor-pointer" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-[#1A1A1A]/30 uppercase tracking-widest">#{order.id}</span>
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${s.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {order.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="font-bold text-sm">{order.shop_name}</p>
                        <p className="text-[9px] text-[#1A1A1A]/35 uppercase tracking-widest font-bold mt-0.5">
                          {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-serif text-xl font-bold">₹{order.total}</p>
                        <p className="text-xs text-[#1A1A1A]/30">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    {/* Order Tracking Timeline */}
                    <OrderTracker status={order.status} />

                    {/* Expanded: Items + Actions */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="border-t border-[#1A1A1A]/5 pt-3 mt-3 space-y-1">
                            {order.items.map((item, i) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-[#1A1A1A]/50">{item.name} <span className="text-[#1A1A1A]/30">× {item.quantity}</span></span>
                                <span className="font-bold">₹{item.line_total ?? item.price * item.quantity}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#1A1A1A]/5 mt-2">
                              <span>Total</span>
                              <span>₹{order.total}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3 pt-3 border-t border-[#1A1A1A]/5">
                            <button onClick={() => setInvoiceOrder(order)}
                              className="flex-1 text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] border border-[#5A5A40]/20 py-2.5 rounded-xl hover:bg-[#5A5A40]/5 transition-all text-center">
                              View Invoice
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            : (
              <div className="py-20 text-center bg-white border border-[#1A1A1A]/5 rounded-3xl">
                <div className="w-16 h-16 bg-[#F5F5F0] rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart size={28} className="text-[#5A5A40]/25" />
                </div>
                <p className="text-[#1A1A1A]/30 italic text-sm mb-4">No orders yet.</p>
                <button onClick={() => navigate('/marketplace')}
                  className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-sm">
                  Browse Shops
                </button>
              </div>
            )
        }
      </div>
      {invoiceOrder && <InvoiceModal order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />}
    </motion.div>
  );
}

// ── App Shell ──────────────────────────────────────────────────────
function AppShell() {
  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans overflow-x-hidden">
      <TopNav />
      <main>
        <Routes>
          <Route path="/"            element={<Navigate to="/marketplace" replace />} />
          <Route path="/login"       element={<SignIn />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/owner" element={<RequireAuth roles={['owner','admin']}><OwnerDashboard /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminPanel /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><CustomerProfile /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><CustomerSettings /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><OrderHistory /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/marketplace" replace />} />
        </Routes>
      </main>
      <BottomNav />
      <AIChatWidget />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
    </AppProvider>
  );
}
