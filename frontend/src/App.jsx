// src/App.jsx — Root component: auth, nav, cart, shell

import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Store, ShoppingCart, User, LayoutDashboard, Settings,
  LogOut, MapPin, ChevronDown, ShoppingBag, Loader2, ArrowRight,
  Search, Package, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { login, placeOrder } from './api/client';
import Marketplace    from './pages/Marketplace';
import OwnerDashboard from './pages/OwnerDashboard';
import AdminPanel     from './pages/AdminPanel';

// ── Constants ─────────────────────────────────────────────────────
const DEMO = [
  { label: 'Customer',   email: 'customer1@example.com', role: 'customer' },
  { label: 'Shop Owner', email: 'anand@example.com',     role: 'owner'    },
  { label: 'Admin',      email: 'senamallas@gmail.com',  role: 'admin'    },
];

const LOCATIONS = ['Green Valley', 'Central Market', 'Food Plaza', 'Milk Lane', 'Old Town'];

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
  if (!currentUser) return <Navigate to="/" replace />;
  if (roles && !roles.includes(currentUser.role)) return <Navigate to={roleHome(currentUser.role)} replace />;
  return children;
}

// ── Sign In ────────────────────────────────────────────────────────
function SignIn() {
  const { signIn, currentUser, authLoading } = useApp();
  const navigate = useNavigate();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  if (!authLoading && currentUser) return <Navigate to={roleHome(currentUser.role)} replace />;

  const handleSignIn = async (emailOverride) => {
    const target = (emailOverride || email).trim().toLowerCase();
    if (!target) { setError('Please enter your email.'); return; }
    setLoading(true); setError('');
    try {
      const res = await login({ email: target });
      signIn(res.data);
      navigate(roleHome(res.data.role), { replace: true });
    } catch (err) {
      if (err.response?.status === 404) {
        navigate(`/role-selection?email=${encodeURIComponent(target)}`, { replace: true });
      } else {
        setError(err.response?.data?.detail || 'Login failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F0] via-[#F0F0E8] to-[#E8E8DC] flex items-center justify-center px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl shadow-[#5A5A40]/10 overflow-hidden">
          <div className="bg-[#5A5A40] px-8 pt-10 pb-8">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-5">
              <Store size={28} className="text-white" />
            </div>
            <h1 className="font-serif text-3xl font-bold text-white mb-1">HyperMart</h1>
            <p className="text-white/60 text-sm">Your neighbourhood marketplace</p>
          </div>
          <div className="px-8 py-8">
            <h2 className="font-serif text-xl font-bold mb-1">Welcome back</h2>
            <p className="text-sm text-[#1A1A1A]/40 mb-6">Sign in to continue shopping</p>
            <div className="space-y-3">
              <input
                className="w-full bg-[#F5F5F0] border border-transparent rounded-2xl px-4 py-3.5 text-sm font-medium outline-none focus:border-[#5A5A40] focus:bg-white transition-all placeholder:text-[#1A1A1A]/30"
                placeholder="Email address"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                autoComplete="email"
              />
              {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-semibold text-red-500 px-1">{error}</motion.p>}
              <button
                onClick={() => handleSignIn()}
                disabled={loading}
                className="w-full bg-[#5A5A40] text-white py-3.5 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A30] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#5A5A40]/20"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in&hellip;</> : <>Continue <ArrowRight size={16} /></>}
              </button>
            </div>
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-[#1A1A1A]/8" />
              <span className="text-[10px] font-bold text-[#1A1A1A]/25 uppercase tracking-widest">Quick demo</span>
              <div className="flex-1 h-px bg-[#1A1A1A]/8" />
            </div>
            <div className="flex gap-2">
              {DEMO.map(d => (
                <button key={d.role} onClick={() => handleSignIn(d.email)} disabled={loading}
                  className="flex-1 flex flex-col items-center gap-1.5 bg-[#F5F5F0] hover:bg-[#5A5A40]/8 border border-[#1A1A1A]/6 hover:border-[#5A5A40]/25 rounded-2xl px-2 py-3 transition-all disabled:opacity-50">
                  <div className="w-8 h-8 rounded-xl bg-[#5A5A40]/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-[#5A5A40]">{d.label[0]}</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#1A1A1A]/60 truncate w-full text-center">{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-center text-[10px] text-[#1A1A1A]/30 mt-5">New here? Just enter your email to get started.</p>
      </motion.div>
    </div>
  );
}

// ── Role Selection ─────────────────────────────────────────────────
function RoleSelection() {
  const { signIn } = useApp();
  const navigate   = useNavigate();
  const location   = useLocation();
  const email      = new URLSearchParams(location.search).get('email') || '';
  const [name, setName]       = useState('');
  const [role, setRole]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!role)        { setError('Please choose a role.'); return; }
    setLoading(true); setError('');
    try {
      const res = await login({ email, display_name: name.trim(), role });
      signIn(res.data);
      navigate(roleHome(res.data.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const ROLES = [
    { key: 'customer', icon: ShoppingBag, title: 'Shop as Customer', desc: 'Browse local shops & order essentials.' },
    { key: 'owner',    icon: Store,        title: 'Register my Shop', desc: 'List your shop, manage products & orders.' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F0] to-[#E8E8DC] flex items-center justify-center px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl shadow-[#5A5A40]/10 overflow-hidden">
          <div className="bg-[#5A5A40] px-8 pt-10 pb-6">
            <button onClick={() => navigate('/')} className="text-white/60 text-sm font-bold flex items-center gap-1 mb-6 hover:text-white transition-colors">
              &#8592; Back
            </button>
            <h2 className="font-serif text-2xl font-bold text-white mb-1">Create account</h2>
            <p className="text-white/60 text-sm truncate">{email}</p>
          </div>
          <div className="px-8 py-8 space-y-4">
            <input
              className="w-full bg-[#F5F5F0] border border-transparent rounded-2xl px-4 py-3.5 text-sm font-medium outline-none focus:border-[#5A5A40] focus:bg-white transition-all placeholder:text-[#1A1A1A]/30"
              placeholder="Your full name *"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
            />
            <div className="space-y-3">
              {ROLES.map(r => (
                <button key={r.key} onClick={() => { setRole(r.key); setError(''); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${role === r.key ? 'border-[#5A5A40] bg-[#5A5A40]/5 shadow-sm' : 'border-[#1A1A1A]/8 hover:border-[#5A5A40]/30'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${role === r.key ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] text-[#5A5A40]'}`}>
                    <r.icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{r.title}</p>
                    <p className="text-[11px] text-[#1A1A1A]/45 mt-0.5">{r.desc}</p>
                  </div>
                  {role === r.key && <CheckCircle2 size={18} className="text-[#5A5A40] shrink-0" />}
                </button>
              ))}
            </div>
            {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-semibold text-red-500 px-1">{error}</motion.p>}
            <button onClick={handleCreate} disabled={loading}
              className="w-full bg-[#5A5A40] text-white py-3.5 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A30] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#5A5A40]/20">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creating&hellip;</> : <>Get Started <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Profile ────────────────────────────────────────────────────────
function Profile() {
  const { currentUser, signOut } = useApp();
  const navigate = useNavigate();
  const [selLoc, setSelLoc] = useState(localStorage.getItem('hm_location') || LOCATIONS[0]);

  const handleLocationChange = loc => { setSelLoc(loc); localStorage.setItem('hm_location', loc); };
  const handleSignOut = () => { signOut(); navigate('/', { replace: true }); };

  const ROLE_BG = { admin: 'bg-purple-100 text-purple-700 border-purple-200', owner: 'bg-blue-100 text-blue-700 border-blue-200', customer: 'bg-emerald-100 text-emerald-700 border-emerald-200' };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto px-4 pb-28 pt-4 sm:pt-8 space-y-3">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#1A1A1A]/5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[#5A5A40] to-[#3A3A28] rounded-2xl flex items-center justify-center text-white font-serif text-2xl font-bold flex-shrink-0">
            {currentUser?.display_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <h2 className="font-serif text-xl font-bold truncate">{currentUser?.display_name || 'Guest'}</h2>
            <p className="text-sm text-[#1A1A1A]/40 truncate">{currentUser?.email}</p>
            <span className={`inline-block mt-1 text-[9px] font-bold uppercase tracking-widest border px-2 py-0.5 rounded-full ${ROLE_BG[currentUser?.role] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
              {currentUser?.role}
            </span>
          </div>
        </div>
      </div>

      {currentUser?.role === 'customer' && (
        <div className="bg-white rounded-3xl px-6 py-5 shadow-sm border border-[#1A1A1A]/5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-4 flex items-center gap-2">
            <MapPin size={12} /> Delivery Location
          </h3>
          <div className="space-y-2">
            {LOCATIONS.map(loc => (
              <button key={loc} onClick={() => handleLocationChange(loc)}
                className={`w-full flex justify-between items-center px-4 py-3 rounded-2xl border transition-all text-sm font-medium ${selLoc === loc ? 'bg-[#5A5A40]/5 border-[#5A5A40] text-[#5A5A40] font-bold' : 'bg-[#F5F5F0] border-transparent text-[#1A1A1A]/60 hover:border-[#5A5A40]/20'}`}>
                {loc}
                {selLoc === loc && <div className="w-2 h-2 rounded-full bg-[#5A5A40]" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl px-6 py-4 shadow-sm border border-[#1A1A1A]/5 divide-y divide-[#1A1A1A]/5">
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-[#1A1A1A]/60">Version</span>
          <span className="text-xs font-bold text-[#5A5A40]">HyperMart v2</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-[#1A1A1A]/60">User ID</span>
          <span className="text-xs font-mono text-[#1A1A1A]/40">{currentUser?.uid?.slice(0, 12)}&hellip;</span>
        </div>
      </div>

      <button onClick={handleSignOut}
        className="w-full flex items-center justify-between px-6 py-4 bg-red-50 border border-red-100 rounded-3xl text-red-600 font-bold hover:bg-red-100 active:scale-[0.98] transition-all">
        <span className="flex items-center gap-3 text-sm"><LogOut size={16} /> Sign Out</span>
        <ChevronRight size={16} className="opacity-40" />
      </button>
    </motion.div>
  );
}

// ── Top Nav ────────────────────────────────────────────────────────
function TopNav() {
  const { currentUser, signOut, search, setSearch, activeLocation, setActiveLocation } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const isAuth = location.pathname === '/' || location.pathname === '/role-selection';
  if (isAuth) return null;

  const isMarketplace = location.pathname === '/marketplace';
  const handleSignOut = () => { signOut(); navigate('/'); };

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

          {currentUser ? (
            <div className="flex items-center gap-1">
              <div className="hidden md:flex flex-col items-end mr-1">
                <span className="text-[9px] font-bold text-[#5A5A40] uppercase tracking-widest leading-none">{currentUser.role}</span>
                <span className="text-xs font-bold truncate max-w-[90px] leading-tight">{currentUser.display_name}</span>
              </div>
              <button onClick={handleSignOut} title="Sign out"
                className="w-8 h-8 flex items-center justify-center hover:bg-[#F5F5F0] rounded-xl transition-colors text-[#5A5A40]">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => navigate('/')}
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

  if (!currentUser) return null;

  const CUSTOMER_TABS = [
    { path: '/marketplace', icon: ShoppingBag,  label: 'Shop'    },
    { path: '/cart',        icon: ShoppingCart,  label: 'Cart',   badge: cartItemCount },
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

  const tabs = currentUser.role === 'admin' ? ADMIN_TABS : currentUser.role === 'owner' ? OWNER_TABS : CUSTOMER_TABS;

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
  const { cart, cartTotal, updateQuantity, clearCart } = useApp();
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced]   = useState(false);

  const handlePlace = async () => {
    if (cart.items.length === 0) return;
    setPlacing(true);
    try {
      await placeOrder({
        shop_id:          cart.shopId,
        items:            cart.items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
        delivery_address: 'Default Address',
      });
      clearCart();
      setPlaced(true);
      setTimeout(() => navigate('/marketplace'), 2000);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to place order.');
    } finally {
      setPlacing(false);
    }
  };

  if (placed) return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      className="min-h-[60vh] flex flex-col items-center justify-center px-8 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <CheckCircle2 size={40} className="text-green-600" />
      </div>
      <h2 className="font-serif text-2xl font-bold mb-2">Order Placed!</h2>
      <p className="text-[#1A1A1A]/40 text-sm">Taking you back to marketplace&hellip;</p>
    </motion.div>
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

// ── App Shell ──────────────────────────────────────────────────────
function AppShell() {
  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans overflow-x-hidden">
      <TopNav />
      <main>
        <Routes>
          <Route path="/"               element={<SignIn />} />
          <Route path="/role-selection" element={<RoleSelection />} />
          <Route path="/marketplace"    element={<Marketplace />} />
          <Route path="/owner" element={<RequireAuth roles={['owner','admin']}><OwnerDashboard /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminPanel /></RequireAuth>} />
          <Route path="/cart"  element={<RequireAuth roles={['customer']}><CartPage /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
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
