// src/App.jsx — Root component with HashRouter, all routes, auth screens, nav

import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Store, ShoppingCart, User, LayoutDashboard, Settings,
  LogOut, MapPin, ChevronDown, ShoppingBag, Loader2, ArrowRight,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { login } from './api/client';
import Marketplace    from './pages/Marketplace';
import OwnerDashboard from './pages/OwnerDashboard';
import AdminPanel     from './pages/AdminPanel';

// ── Demo Accounts ─────────────────────────────────────────────────
const DEMO = [
  { label: 'Customer',  email: 'customer1@example.com', uid: 'cust-001',  role: 'customer' },
  { label: 'Shop Owner',email: 'anand@example.com',     uid: 'owner-001', role: 'owner'    },
  { label: 'Admin',     email: 'senamallas@gmail.com',  uid: 'admin-001', role: 'admin'    },
];

// ── Require Auth Guard ────────────────────────────────────────────
function RequireAuth({ children, roles }) {
  const { currentUser, authLoading } = useApp();
  if (authLoading) return (
    <div className="h-screen flex items-center justify-center bg-[#F5F5F0]">
      <Loader2 size={32} className="animate-spin text-[#5A5A40]" />
    </div>
  );
  if (!currentUser) return <Navigate to="/" replace />;
  if (roles && !roles.includes(currentUser.role)) return <Navigate to={roleHome(currentUser.role)} replace />;
  return children;
}

function roleHome(role) {
  if (role === 'admin')  return '/admin';
  if (role === 'owner')  return '/owner';
  return '/marketplace';
}

// ── Sign In Screen ────────────────────────────────────────────────
function SignIn() {
  const { signIn, currentUser, authLoading } = useApp();
  const navigate = useNavigate();
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  if (!authLoading && currentUser) {
    return <Navigate to={roleHome(currentUser.role)} replace />;
  }

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
        // New user — go to role selection with email pre-filled
        navigate(`/role-selection?email=${encodeURIComponent(target)}`, { replace: true });
      } else {
        setError(err.response?.data?.detail || 'Login failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-8 sm:p-12 w-full max-w-md shadow-xl">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-[#5A5A40] rounded-2xl flex items-center justify-center text-white font-serif font-bold text-xl">H</div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight">HyperMart</h1>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#5A5A40]/60">Your neighbourhood store</p>
          </div>
        </div>

        <h2 className="font-serif text-2xl font-bold mb-2">Welcome back</h2>
        <p className="text-sm text-[#1A1A1A]/40 mb-8">Sign in with your email to continue.</p>

        <div className="space-y-4">
          <div className="relative">
            <input
              className="w-full bg-[#F5F5F0] border border-[#1A1A1A]/5 rounded-2xl px-4 py-4 text-sm font-medium outline-none focus:border-[#5A5A40] transition-colors"
              placeholder="Enter your email address"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSignIn()}
            />
          </div>
          {error && <p className="text-xs font-bold text-red-600">{error}</p>}
          <button
            onClick={() => handleSignIn()}
            disabled={loading}
            className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 size={18} className="animate-spin" /> Checking...</> : <>Continue <ArrowRight size={18} /></>}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-[#1A1A1A]/10" />
          <span className="text-[10px] font-bold text-[#1A1A1A]/30 uppercase tracking-widest">Or try a demo</span>
          <div className="flex-1 h-px bg-[#1A1A1A]/10" />
        </div>

        {/* Demo buttons */}
        <div className="space-y-2">
          {DEMO.map(d => (
            <button
              key={d.uid}
              onClick={() => handleSignIn(d.email)}
              disabled={loading}
              className="w-full flex items-center justify-between gap-3 bg-[#F5F5F0] hover:bg-[#5A5A40]/5 border border-[#1A1A1A]/5 hover:border-[#5A5A40]/20 rounded-2xl px-4 py-3 transition-all disabled:opacity-50 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#5A5A40]/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-[#5A5A40]">{d.label[0]}</span>
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold">{d.label}</p>
                  <p className="text-[9px] text-[#1A1A1A]/40">{d.email}</p>
                </div>
              </div>
              <ArrowRight size={14} className="text-[#5A5A40]/30 group-hover:text-[#5A5A40] transition-colors" />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ── Role Selection Screen ─────────────────────────────────────────
function RoleSelection() {
  const { signIn } = useApp();
  const navigate   = useNavigate();
  const location   = useLocation();
  const email      = new URLSearchParams(location.search).get('email') || '';
  const [name, setName]     = useState('');
  const [role, setRole]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!role)        { setError('Please choose a role.'); return; }
    setLoading(true); setError('');
    try {
      const res = await login({ email, display_name: name.trim(), role });
      signIn(res.data);
      navigate(roleHome(res.data.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const ROLES = [
    { key: 'customer', icon: ShoppingBag, title: 'Shop as Customer', desc: 'Browse shops, order groceries and daily essentials.' },
    { key: 'owner',    icon: Store,        title: 'Register my Shop', desc: 'List your shop and manage inventory & orders.' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-8 sm:p-12 w-full max-w-md shadow-xl">
        <h2 className="font-serif text-2xl font-bold mb-2">Create your account</h2>
        <p className="text-sm text-[#1A1A1A]/40 mb-8">
          Hello! <span className="text-[#5A5A40] font-semibold">{email}</span> — choose how you'll use HyperMart.
        </p>

        <div className="space-y-4 mb-8">
          <input
            className="w-full bg-[#F5F5F0] border border-[#1A1A1A]/5 rounded-2xl px-4 py-4 text-sm font-medium outline-none focus:border-[#5A5A40] transition-colors"
            placeholder="Your full name *"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 mb-8">
          {ROLES.map(r => (
            <button
              key={r.key}
              onClick={() => { setRole(r.key); setError(''); }}
              className={`flex items-start gap-4 p-5 rounded-2xl border-2 transition-all text-left ${role === r.key ? 'border-[#5A5A40] bg-[#5A5A40]/5' : 'border-[#1A1A1A]/10 hover:border-[#5A5A40]/30'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${role === r.key ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] text-[#5A5A40]'}`}>
                <r.icon size={20} />
              </div>
              <div>
                <p className="font-bold text-sm mb-0.5">{r.title}</p>
                <p className="text-[11px] text-[#1A1A1A]/50">{r.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {error && <p className="text-xs font-bold text-red-600 mb-4">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={18} className="animate-spin" /> Creating account...</> : <>Get Started <ArrowRight size={18} /></>}
        </button>

        <button onClick={() => navigate('/')} className="mt-4 w-full text-center text-xs text-[#1A1A1A]/30 hover:text-[#1A1A1A]/60 transition-colors">
          ← Back to Sign In
        </button>
      </motion.div>
    </div>
  );
}

// ── Profile Screen ────────────────────────────────────────────────
function Profile() {
  const { currentUser, signOut } = useApp();
  const navigate = useNavigate();
  const LOCATIONS = ['Green Valley', 'Central Market', 'Food Plaza', 'Milk Lane', 'Old Town'];
  const [location, setLocation] = useState(localStorage.getItem('hm_location') || LOCATIONS[0]);

  const handleLocationChange = (loc) => {
    setLocation(loc);
    localStorage.setItem('hm_location', loc);
  };

  const handleSignOut = () => {
    signOut();
    navigate('/', { replace: true });
  };

  const ROLE_BADGE = {
    admin:    'bg-purple-50 text-purple-700 border-purple-100',
    owner:    'bg-blue-50 text-blue-700 border-blue-100',
    customer: 'bg-green-50 text-green-700 border-green-100',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto p-4 sm:p-8 pb-24">
      {/* Avatar & Name */}
      <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-8 mb-4 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-[#5A5A40] rounded-3xl flex items-center justify-center text-white font-serif text-3xl font-bold mb-4">
          {currentUser?.display_name?.[0]?.toUpperCase() || '?'}
        </div>
        <h2 className="font-serif text-2xl font-bold mb-1">{currentUser?.display_name || 'Guest'}</h2>
        <p className="text-sm text-[#1A1A1A]/40 mb-3">{currentUser?.email}</p>
        <span className={`text-[9px] font-bold uppercase tracking-widest border px-2 py-0.5 rounded ${ROLE_BADGE[currentUser?.role] || 'bg-gray-50 text-gray-700'}`}>
          {currentUser?.role}
        </span>
      </div>

      {/* Location Selector (customer only) */}
      {currentUser?.role === 'customer' && (
        <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-6 mb-4">
          <h3 className="font-serif text-sm font-bold uppercase tracking-widest mb-4 text-[#1A1A1A]/60 flex items-center gap-2">
            <MapPin size={14} /> Delivery Location
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {LOCATIONS.map(loc => (
              <button key={loc} onClick={() => handleLocationChange(loc)}
                className={`flex justify-between items-center px-4 py-3 rounded-2xl border transition-all text-sm font-medium ${location === loc ? 'bg-[#5A5A40]/5 border-[#5A5A40] text-[#5A5A40] font-bold' : 'bg-[#F5F5F0] border-transparent text-[#1A1A1A]/60 hover:border-[#5A5A40]/20'}`}>
                {loc}
                {location === loc && <span className="w-2 h-2 rounded-full bg-[#5A5A40]" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-between px-6 py-4 bg-white border border-[#1A1A1A]/5 rounded-3xl text-red-600 font-bold hover:bg-red-50 transition-all"
      >
        <span className="flex items-center gap-3"><LogOut size={18} /> Sign Out</span>
        <span className="text-xs font-bold opacity-50">UID: {currentUser?.uid?.slice(0, 8)}…</span>
      </button>
    </motion.div>
  );
}

// ── Bottom Nav Bar ────────────────────────────────────────────────
function BottomNav() {
  const { currentUser, cartItemCount } = useApp();
  const location = useLocation();
  const navigate  = useNavigate();

  if (!currentUser) return null;

  const CUSTOMER_TABS = [
    { path: '/marketplace', icon: Store,       label: 'Market' },
    { path: '/cart',        icon: ShoppingCart, label: 'Cart',   badge: cartItemCount },
    { path: '/profile',     icon: User,         label: 'Profile' },
  ];
  const OWNER_TABS = [
    { path: '/owner',   icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/profile', icon: User,             label: 'Profile' },
  ];
  const ADMIN_TABS = [
    { path: '/admin',   icon: Settings, label: 'Admin' },
    { path: '/profile', icon: User,     label: 'Profile' },
  ];

  const tabs =
    currentUser.role === 'admin'  ? ADMIN_TABS   :
    currentUser.role === 'owner'  ? OWNER_TABS   :
    CUSTOMER_TABS;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#1A1A1A]/5 safe-bottom">
      <div className={`grid h-16 px-4 ${tabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {tabs.map(tab => {
          const active = location.pathname === tab.path || (tab.path !== '/' && location.pathname.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center justify-center gap-1 relative"
            >
              <div className="relative">
                <tab.icon size={22} className={active ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/30'} strokeWidth={active ? 2.5 : 1.5} />
                {tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 bg-[#FF3269] text-white text-[7px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{tab.badge}</span>
                )}
              </div>
              <span className={`text-[8px] font-bold uppercase tracking-[0.12em] ${active ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/30'}`}>{tab.label}</span>
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#5A5A40] rounded-full" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Navbar (Top) ──────────────────────────────────────────────────
function TopNav() {
  const { currentUser } = useApp();
  const location = useLocation();
  const isAuth = location.pathname === '/' || location.pathname === '/role-selection';
  if (isAuth || !currentUser) return null;

  const LOCATIONS = ['Green Valley', 'Central Market', 'Food Plaza', 'Milk Lane', 'Old Town'];
  const [loc, setLoc] = useState(localStorage.getItem('hm_location') || LOCATIONS[0]);
  const [open, setOpen] = useState(false);

  const handleLoc = (l) => { setLoc(l); localStorage.setItem('hm_location', l); setOpen(false); };

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-[#1A1A1A]/5">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white font-serif font-bold text-sm">H</div>
          <span className="font-serif font-bold text-lg hidden sm:block">HyperMart</span>
        </div>
        {currentUser.role === 'customer' && (
          <div className="relative">
            <button onClick={() => setOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-2 bg-[#F5F5F0] rounded-xl text-xs font-bold border border-[#1A1A1A]/5 hover:bg-[#5A5A40]/5 transition-all">
              <MapPin size={12} className="text-[#5A5A40]" />
              {loc}
              <ChevronDown size={12} className="text-[#1A1A1A]/40" />
            </button>
            <AnimatePresence>
              {open && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 mt-2 bg-white border border-[#1A1A1A]/10 rounded-2xl shadow-xl z-50 overflow-hidden min-w-[160px]">
                  {LOCATIONS.map(l => (
                    <button key={l} onClick={() => handleLoc(l)}
                      className={`w-full text-left px-4 py-3 text-xs font-medium hover:bg-[#F5F5F0] transition-colors ${l === loc ? 'font-bold text-[#5A5A40]' : 'text-[#1A1A1A]/70'}`}>{l}</button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {currentUser.role !== 'customer' && (
          <span className="text-sm text-[#1A1A1A]/40 font-medium hidden sm:block">{currentUser.display_name}</span>
        )}
      </div>
    </div>
  );
}

// ── Cart Page (inline) ────────────────────────────────────────────
function CartPage() {
  const { cart, cartTotal, updateQuantity, clearCart, currentUser } = useApp();
  const navigate = useNavigate();
  const { placeOrder } = require('./api/client');
  const [placing, setPlacing] = useState(false);

  const handlePlace = async () => {
    if (cart.items.length === 0) return;
    setPlacing(true);
    try {
      await placeOrder({
        shop_id: cart.shopId,
        items: cart.items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
        delivery_address: 'Default Address',
      });
      clearCart();
      navigate('/marketplace');
      alert('Order placed! 🎉');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to place order.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto p-4 sm:p-8 pb-24">
      <h2 className="font-serif text-3xl font-bold mb-8">Your Cart</h2>
      {cart.items.length === 0 ? (
        <div className="py-20 text-center bg-white border border-[#1A1A1A]/5 rounded-3xl">
          <ShoppingCart size={48} className="mx-auto text-[#5A5A40]/20 mb-4" />
          <p className="text-[#1A1A1A]/30 italic mb-6">Your cart is empty.</p>
          <button onClick={() => navigate('/marketplace')}
            className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all text-sm">
            Browse Shops
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-4 mb-4 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">From</p>
              <p className="font-bold">{cart.shopName}</p>
            </div>
            <button onClick={clearCart} className="text-xs font-bold text-red-500 hover:underline">Clear</button>
          </div>
          {cart.items.map(item => (
            <div key={item.productId} className="bg-white border border-[#1A1A1A]/5 rounded-2xl p-4 flex gap-4">
              <div className="w-14 h-14 bg-[#F5F5F0] rounded-xl overflow-hidden flex-shrink-0">
                {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <ShoppingCart size={16} className="m-4 text-[#5A5A40]/20" />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm mb-1">{item.name}</p>
                <p className="text-xs text-[#1A1A1A]/40">₹{item.price} / {item.unit}</p>
              </div>
              <div className="flex flex-col items-end justify-between">
                <p className="font-bold">₹{item.price * item.quantity}</p>
                <div className="flex items-center border border-[#1A1A1A]/10 rounded-xl">
                  <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="px-2 py-1 text-lg font-bold leading-none hover:bg-[#F5F5F0] rounded-l-xl">−</button>
                  <span className="px-3 text-sm font-bold">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="px-2 py-1 text-lg font-bold leading-none hover:bg-[#F5F5F0] rounded-r-xl">+</button>
                </div>
              </div>
            </div>
          ))}
          <div className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-6">
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-xs">Total</span>
              <span className="font-serif text-3xl font-bold">₹{cartTotal}</span>
            </div>
            <button onClick={handlePlace} disabled={placing}
              className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {placing ? <><Loader2 size={18} className="animate-spin" /> Placing...</> : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────
function AppShell() {
  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <TopNav />
      <Routes>
        <Route path="/"               element={<SignIn />} />
        <Route path="/role-selection" element={<RoleSelection />} />
        <Route path="/marketplace" element={
          <RequireAuth roles={['customer','admin']}>
            <Marketplace />
          </RequireAuth>
        } />
        <Route path="/owner" element={
          <RequireAuth roles={['owner','admin']}>
            <OwnerDashboard />
          </RequireAuth>
        } />
        <Route path="/admin" element={
          <RequireAuth roles={['admin']}>
            <AdminPanel />
          </RequireAuth>
        } />
        <Route path="/cart" element={
          <RequireAuth roles={['customer']}>
            <CartPage />
          </RequireAuth>
        } />
        <Route path="/profile" element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
