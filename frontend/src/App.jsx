// src/App.jsx — Root component: auth, nav, cart, shell

import { useState, useEffect, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Store, ShoppingCart, User, LayoutDashboard, Settings,
  LogOut, MapPin, ChevronDown, ShoppingBag, Loader2, ArrowRight,
  Search, Package, CheckCircle2, Eye, EyeOff, Phone, Tag, Percent,
  Navigation, Check, X,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import AIChatWidget from './components/AIChatWidget';
import { login, register, placeOrder, forgotPassword, getShopDiscounts, createRazorpayOrder, verifyRazorpayPayment, getShopUPI, nearbyShops, listShops } from './api/client';
import Marketplace        from './pages/Marketplace';
import OwnerDashboard     from './pages/OwnerDashboard';
import AdminPanel         from './pages/AdminPanel';
import CustomerProfile    from './pages/CustomerProfile';
import OrderHistory       from './pages/OrderHistory';
import CustomerSettings   from './pages/CustomerSettings';
import InvoiceModal       from './components/InvoiceModal';
import LanguageSelector   from './components/LanguageSelector';
import GlobalSearch       from './components/GlobalSearch';

// Fix Leaflet default marker icon (broken in bundlers)
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

// ── Constants ─────────────────────────────────────────────────────
const DEMO = [
  { label: 'Customer',   email: 'ravi@example.com',   password: 'Customer@123', role: 'customer' },
  { label: 'Shop Owner', email: 'anand@example.com',  password: 'Owner@123',    role: 'owner'    },
  { label: 'Admin',      email: 'senamallas@gmail.com', password: 'Admin@123',  role: 'admin'    },
];


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
  const [forgotEmail, setForgotEmail] = useState('');
  const [showForgot, setShowForgot]   = useState(false);
  const [forgotMsg, setForgotMsg]     = useState('');

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
                <button onClick={() => setShowForgot(true)} className="w-full text-center text-xs text-[#5A5A40]/60 hover:text-[#5A5A40] transition-colors py-1">
                  Forgot password?
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

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForgot(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-serif text-xl font-bold mb-2">Reset Password</h3>
            <p className="text-sm text-[#1A1A1A]/50 mb-4">Enter your email and we'll send a reset link.</p>
            <input className="w-full bg-[#F5F5F0] border border-transparent rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-[#5A5A40] focus:bg-white transition-all placeholder:text-[#1A1A1A]/30 mb-3"
              placeholder="Email address" type="email" value={forgotEmail}
              onChange={e => { setForgotEmail(e.target.value); setForgotMsg(''); }} />
            {forgotMsg && <p className="text-xs text-emerald-600 font-semibold mb-3 px-1">{forgotMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowForgot(false)}
                className="flex-1 py-3 rounded-2xl border border-[#1A1A1A]/10 text-sm font-bold text-[#1A1A1A]/60 hover:bg-[#F5F5F0]">
                Cancel
              </button>
              <button onClick={async () => {
                  if (!forgotEmail) return;
                  try {
                    await forgotPassword(forgotEmail.trim());
                    setForgotMsg('If this email exists, a reset link has been sent. Check console in dev.');
                  } catch { setForgotMsg('Something went wrong.'); }
                }}
                className="flex-1 py-3 rounded-2xl bg-[#5A5A40] text-white text-sm font-bold hover:bg-[#4A4A30] transition-all">
                Send Reset
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ── Top Nav ────────────────────────────────────────────────────────
function TopNav() {
  const { currentUser, signOut, search, setSearch, activeLocation, setActiveLocation } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLocMenu, setShowLocMenu] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [allLocations, setAllLocations] = useState(['All']);
  const [userCity, setUserCity] = useState('');
  const [locLoading, setLocLoading] = useState(true);
  const [selectedMapCoords, setSelectedMapCoords] = useState(null);
  const [mapLocationName, setMapLocationName] = useState('');
  const locRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (locRef.current && !locRef.current.contains(e.target)) setShowLocMenu(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      // Always load all shop zones from backend
      try {
        const res = await listShops({ size: 100 });
        const shops = res.data?.items || [];
        const locs = [...new Set(shops.map(s => s.location_name).filter(Boolean))];
        if (!cancelled && locs.length) setAllLocations(['All', ...locs]);
      } catch { /* keep ['All'] */ }

      // Try to reverse-geocode user's real city
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 })
        );
        const geo = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
          { headers: { 'Accept-Language': 'en' } }
        ).then(r => r.json());
        const city = geo.address?.city || geo.address?.town || geo.address?.suburb || geo.address?.county || '';
        if (!cancelled && city) setUserCity(city);
      } catch { /* location denied or unavailable */ }

      if (!cancelled) setLocLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const isAuth = location.pathname === '/login';
  if (isAuth) return null;

  const handleSignOut = () => { signOut(); navigate('/'); setShowUserMenu(false); };

  return (
    <>
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#1A1A1A]/6 safe-top">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
        <button
          onClick={() => {
            if (currentUser?.role === 'owner') {
              navigate('/owner', { state: { resetTab: true } });
            } else if (currentUser?.role === 'admin') {
              navigate('/admin', { state: { resetTab: true } });
            } else {
              navigate('/marketplace', { state: { homeReset: Date.now() } });
            }
          }}
          className="flex items-center gap-2 shrink-0 active:scale-95 transition-transform z-[60] relative bg-transparent border-0 p-0 cursor-pointer">
          <div className="w-8 h-8 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white shadow-sm">
            <Store size={16} />
          </div>
          <span className="font-serif text-lg font-bold tracking-tight hidden sm:block">HyperMart</span>
        </button>

        <GlobalSearch />

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <div className="relative" ref={locRef}>
            <button
              onClick={() => setShowLocMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F5F0] rounded-full border border-[#1A1A1A]/6 hover:bg-[#EBEBDB] transition-all">
              {locLoading
                ? <Loader2 size={12} className="text-[#5A5A40] animate-spin shrink-0" />
                : <MapPin size={12} className="text-[#5A5A40] shrink-0" />}
              <span className="text-[10px] font-bold uppercase tracking-widest max-w-[70px] sm:max-w-[100px] truncate">
                {locLoading ? 'Locating…' : activeLocation || userCity || 'Location'}
              </span>
              <ChevronDown size={11} className="text-[#5A5A40] shrink-0" />
            </button>

            {showLocMenu && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-[#1A1A1A]/8 rounded-2xl shadow-xl min-w-[240px] overflow-hidden z-[70]">
                {userCity && (
                  <div className="px-4 py-3 border-b border-[#1A1A1A]/5 flex items-center gap-2 bg-[#F5F5F0]">
                    <Navigation size={14} className="text-[#5A5A40] shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 leading-none mb-0.5">Your Location</p>
                      <p className="text-sm font-bold text-[#5A5A40]">{userCity}</p>
                    </div>
                  </div>
                )}
                <div className="py-3 px-4 border-t border-[#1A1A1A]/5">
                  <button
                    onClick={() => { setShowMapModal(true); setShowLocMenu(false); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#5A5A40] text-white rounded-xl font-bold hover:bg-[#4A4A30] transition-all text-sm"
                  >
                    <MapPin size={16} />
                    Select Location on Map
                  </button>
                </div>
              </div>
            )}
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

    {/* Location Map Picker Modal */}
    {showMapModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A]/10">
            <h3 className="font-serif text-xl font-bold">Select Your Location</h3>
            <button onClick={() => setShowMapModal(false)} className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors">
              <X size={20} className="text-[#1A1A1A]/60" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden min-h-[400px]">
            <MapContainer center={[17.3850, 78.4867]} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={true} attributionControl={true}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {selectedMapCoords && <Marker position={selectedMapCoords} />}
              <LocationMapClickHandler setCoords={setSelectedMapCoords} setName={setMapLocationName} />
            </MapContainer>
          </div>
          <div className="px-6 py-4 border-t border-[#1A1A1A]/10 flex items-center justify-between gap-3">
            <div>
              {mapLocationName && <p className="text-sm font-medium text-[#5A5A40]">{mapLocationName}</p>}
              {selectedMapCoords && <p className="text-xs text-[#1A1A1A]/60">{selectedMapCoords[0].toFixed(4)}, {selectedMapCoords[1].toFixed(4)}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowMapModal(false)} className="px-5 py-2 rounded-xl border border-[#1A1A1A]/20 font-bold text-sm hover:bg-[#F5F5F0] transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (mapLocationName) {
                    setActiveLocation(mapLocationName);
                    setShowMapModal(false);
                  }
                }}
                disabled={!mapLocationName}
                className="px-5 py-2 rounded-xl bg-[#5A5A40] text-white font-bold text-sm hover:bg-[#4A4A30] disabled:opacity-50 transition-colors">
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// Location map click handler - must be inside MapContainer
function LocationMapClickHandler({ setCoords, setName }) {
  const map = useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      setCoords([lat, lng]);

      // Reverse geocode to get location name
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { 'Accept-Language': 'en' } }
        ).then(r => r.json());
        const name = res.address?.city || res.address?.town || res.address?.suburb || res.address?.county || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        setName(name);
      } catch {
        setName(`Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      }
    }
  });
  return null;
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
  const [productDiscounts, setProductDiscounts] = useState([]);
  const [orderDiscounts, setOrderDiscounts] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [shopUPI, setShopUPI] = useState(null);
  const [showUPIQR, setShowUPIQR] = useState(false);

  useEffect(() => {
    if (!cart.shopId) return;
    getShopDiscounts(cart.shopId)
      .then(r => {
        setProductDiscounts(r.data.product_discounts || []);
        setOrderDiscounts(r.data.order_discounts || []);
      })
      .catch(() => {});
    getShopUPI(cart.shopId)
      .then(r => setShopUPI(r.data))
      .catch(() => {});
  }, [cart.shopId]);

  const isOfferValid = (validTill) => !validTill || new Date(validTill) >= new Date();

  const calculations = useMemo(() => {
    let subtotal = 0;
    let itemDiscounts = 0;

    cart.items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;

      const discount = productDiscounts.find(d => d.product_id === item.productId && d.status === 'active' && isOfferValid(d.valid_till));
      if (discount) {
        if (discount.type === 'bogo') {
          itemDiscounts += Math.floor(item.quantity / 2) * item.price;
        } else if (discount.type === 'buy_x_get_y') {
          const freeQty = Math.floor(item.quantity / ((discount.buy_qty || 1) + (discount.get_qty || 1))) * (discount.get_qty || 1);
          itemDiscounts += freeQty * item.price;
        } else if (discount.type === 'bulk_price') {
          if (item.quantity >= (discount.buy_qty || 1)) {
            const sets = Math.floor(item.quantity / discount.buy_qty);
            const remainder = item.quantity % discount.buy_qty;
            itemDiscounts += (itemTotal - (sets * (discount.bulk_price || 0) + remainder * item.price));
          }
        } else if (discount.type === 'individual' && discount.discount_value) {
          itemDiscounts += (itemTotal * discount.discount_value) / 100;
        }
      }
    });

    const intermediateTotal = subtotal - itemDiscounts;
    let billDiscount = 0;
    const applicableOrderDiscount = orderDiscounts
      .filter(d => d.status === 'active' && intermediateTotal >= d.min_bill_value && isOfferValid(d.valid_till))
      .sort((a, b) => b.min_bill_value - a.min_bill_value)[0];

    if (applicableOrderDiscount) {
      billDiscount = applicableOrderDiscount.discount_type === 'percentage'
        ? (intermediateTotal * applicableOrderDiscount.discount_value) / 100
        : applicableOrderDiscount.discount_value;
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
  }, [cart.items, productDiscounts, orderDiscounts]);

  const handlePlace = async () => {
    if (cart.items.length === 0) return;
    if (!currentUser) { navigate('/login'); return; }

    // UPI — show QR, user pays outside, then we place order as "upi"
    if (paymentMethod === 'upi') {
      if (!shopUPI?.upi_id) { alert('This shop has not set up UPI payments yet.'); return; }
      setShowUPIQR(true);
      return;
    }

    setPlacing(true);
    try {
      const res = await placeOrder({
        shop_id:          cart.shopId,
        items:            cart.items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
        delivery_address: 'Default Address',
        payment_method:   paymentMethod,
        subtotal:         calculations.subtotal,
        item_discounts:   calculations.itemDiscounts,
        bill_discount:    calculations.billDiscount,
        total_discount:   calculations.totalDiscount,
      });

      // Razorpay — open checkout after order is created
      if (paymentMethod === 'razorpay') {
        try {
          const rzRes = await createRazorpayOrder(res.data.id);
          const rz = rzRes.data;
          const options = {
            key: rz.key_id,
            amount: rz.amount,
            currency: rz.currency,
            name: 'HyperMart',
            description: `Order #${res.data.id}`,
            order_id: rz.razorpay_order_id,
            handler: async (response) => {
              try {
                await verifyRazorpayPayment({
                  order_id:            res.data.id,
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                });
              } catch { /* verification failed — order stays pending */ }
              clearCart();
              setPlacedOrder({ ...res.data, payment_status: 'paid', payment_method: 'razorpay' });
              setPlacing(false);
            },
            modal: { ondismiss: () => { setPlacing(false); clearCart(); setPlacedOrder(res.data); } },
            prefill: { email: currentUser.email, contact: currentUser.phone || '' },
          };
          if (window.Razorpay) {
            new window.Razorpay(options).open();
          } else {
            alert('Razorpay SDK not loaded. Order placed — pay later.');
            clearCart(); setPlacedOrder(res.data); setPlacing(false);
          }
          return;
        } catch {
          alert('Could not initiate Razorpay payment. Order placed — pay later.');
          clearCart(); setPlacedOrder(res.data); setPlacing(false);
          return;
        }
      }

      clearCart();
      setPlacedOrder(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to place order.');
    } finally {
      setPlacing(false);
    }
  };

  const confirmUPIPayment = async () => {
    setShowUPIQR(false);
    setPlacing(true);
    try {
      const res = await placeOrder({
        shop_id:          cart.shopId,
        items:            cart.items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
        delivery_address: 'Default Address',
        payment_method:   'upi',
        subtotal:         calculations.subtotal,
        item_discounts:   calculations.itemDiscounts,
        bill_discount:    calculations.billDiscount,
        total_discount:   calculations.totalDiscount,
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

          {cart.items.map(item => {
            const itemDiscount = productDiscounts.find(d => d.product_id === item.productId && d.status === 'active' && isOfferValid(d.valid_till));
            return (
            <div key={item.productId} className="bg-white border border-[#1A1A1A]/5 rounded-2xl p-4 flex gap-3 items-center">
              <div className="w-14 h-14 bg-[#F5F5F0] rounded-xl overflow-hidden flex-shrink-0 relative">
                {item.image ? <img src={fixImageUrl(item.image)} className="w-full h-full object-cover" alt={item.name} /> : <Package size={16} className="m-auto mt-4 text-[#5A5A40]/20" />}
                {itemDiscount && <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[7px] px-1 py-0.5 rounded-full font-bold">{itemDiscount.type === 'bogo' ? 'BOGO' : 'Offer'}</span>}
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
            );
          })}

          <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-5 space-y-3">
            {calculations.remainingForNext > 0 && (
              <div className="bg-[#5A5A40]/5 border border-[#5A5A40]/10 rounded-xl p-3">
                <p className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-widest text-center">
                  Add &#8377;{calculations.remainingForNext} more to unlock {calculations.nextDiscount?.discount_type === 'percentage' ? `${calculations.nextDiscount.discount_value}%` : `₹${calculations.nextDiscount?.discount_value}`} OFF!
                </p>
              </div>
            )}
            <div className="flex justify-between text-sm text-[#1A1A1A]/50">
              <span>Subtotal</span><span className="font-medium">&#8377;{calculations.subtotal.toFixed(2)}</span>
            </div>
            {calculations.itemDiscounts > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span className="flex items-center gap-1"><Tag size={12} /> Item Offers</span>
                <span className="font-bold">- &#8377;{calculations.itemDiscounts.toFixed(2)}</span>
              </div>
            )}
            {calculations.billDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span className="flex items-center gap-1"><Percent size={12} /> Bill Offer</span>
                <span className="font-bold">- &#8377;{calculations.billDiscount.toFixed(2)}</span>
              </div>
            )}
            {calculations.totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-red-500 pt-1 border-t border-dashed border-[#1A1A1A]/10">
                <span className="font-bold text-[10px] uppercase tracking-widest">Total Savings</span>
                <span className="font-bold">&#8377;{calculations.totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-[#1A1A1A]/50">
              <span>Delivery</span><span className="text-green-600 font-bold">FREE</span>
            </div>
            <div className="flex justify-between items-center border-t border-[#1A1A1A]/6 pt-3">
              <span className="font-bold uppercase tracking-widest text-xs text-[#1A1A1A]/40">Total</span>
              <span className="font-serif text-3xl font-bold">&#8377;{calculations.total.toFixed(2)}</span>
            </div>
            {/* Payment Method Selector */}
            <div className="pt-3 border-t border-[#1A1A1A]/6">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Payment Method</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'cash', label: 'Cash', icon: '💵' },
                  { key: 'upi',  label: 'UPI',  icon: '📱' },
                  { key: 'razorpay', label: 'Online', icon: '💳' },
                ].map(m => (
                  <button key={m.key} onClick={() => setPaymentMethod(m.key)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-bold transition-all ${paymentMethod === m.key
                      ? 'border-[#5A5A40] bg-[#5A5A40]/10 text-[#5A5A40]'
                      : 'border-[#1A1A1A]/10 text-[#1A1A1A]/50 hover:border-[#5A5A40]/30'}`}>
                    <span className="text-lg">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
              {paymentMethod === 'upi' && !shopUPI?.upi_id && (
                <p className="text-[10px] text-red-500 mt-1">This shop hasn't set up UPI payments yet.</p>
              )}
            </div>

            <button onClick={handlePlace} disabled={placing || (paymentMethod === 'upi' && !shopUPI?.upi_id)}
              className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#5A5A40]/20 mt-2">
              {placing ? <><Loader2 size={16} className="animate-spin" /> Placing Order&hellip;</> :
                paymentMethod === 'razorpay' ? 'Pay Online' :
                paymentMethod === 'upi' ? 'Pay via UPI' : 'Place Order (COD)'}
            </button>
          </div>

          {/* UPI QR Modal */}
          {showUPIQR && shopUPI?.upi_id && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowUPIQR(false)}>
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="font-serif text-xl font-bold text-center">Scan & Pay</h3>
                <p className="text-xs text-center text-[#1A1A1A]/50">Scan the QR code or use UPI ID to pay the shop owner directly</p>
                <div className="flex justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=${encodeURIComponent(shopUPI.upi_id)}&pn=${encodeURIComponent(shopUPI.shop_name)}&am=${calculations.total}&cu=INR`}
                    alt="UPI QR Code" className="w-48 h-48 rounded-xl"
                  />
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">UPI ID</p>
                  <p className="font-mono font-bold text-sm mt-1">{shopUPI.upi_id}</p>
                </div>
                <p className="text-center font-serif text-2xl font-bold">&#8377;{calculations.total.toFixed(2)}</p>
                <button onClick={confirmUPIPayment}
                  className="w-full bg-[#5A5A40] text-white py-3 rounded-2xl font-bold uppercase tracking-widest text-sm hover:bg-[#4A4A30] transition-all">
                  I've Paid — Confirm Order
                </button>
                <button onClick={() => setShowUPIQR(false)}
                  className="w-full py-2 text-xs text-[#1A1A1A]/40 font-bold uppercase tracking-widest">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── App Shell ──────────────────────────────────────────────────────
function AppShell() {
  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans overflow-x-hidden">
      <TopNav />
      <main className="pb-16 sm:pb-0">
        <Routes>
          <Route path="/"            element={<Navigate to="/marketplace" replace />} />
          <Route path="/login"       element={<SignIn />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/cart" element={<RequireAuth><CartPage /></RequireAuth>} />
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
