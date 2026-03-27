import React, { useState, useEffect, useMemo } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc,
  deleteDoc,
  getDocs,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Shop, Product, Order, Category, UserRole } from './types';
import { 
  Store, 
  ShoppingBag, 
  User as UserIcon, 
  LogOut, 
  Plus, 
  Package, 
  ClipboardList, 
  BarChart3, 
  Search, 
  MapPin, 
  Clock, 
  Phone, 
  MessageCircle,
  CheckCircle2,
  XCircle,
  Truck,
  ShoppingCart,
  ChevronRight,
  ArrowLeft,
  Settings,
  AlertCircle,
  X,
  Camera,
  Sparkles,
  ChevronDown,
  Receipt,
  RefreshCw,
  Percent,
  CreditCard,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const LOCATIONS = [
  'Green Valley',
  'Central Market',
  'Food Plaza',
  'Milk Lane',
  'Old Town'
];

// --- Components ---

const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F0]">
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
      className="w-12 h-12 border-4 border-[#5A5A40] border-t-transparent rounded-full mb-4"
    />
    <p className="font-serif italic text-[#5A5A40]">Loading HyperMart...</p>
  </div>
);

const ErrorBoundary = ({ error }: { error: string }) => (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg m-4">
    <div className="flex items-center gap-2 text-red-700 mb-2">
      <AlertCircle size={20} />
      <h3 className="font-bold">Something went wrong</h3>
    </div>
    <p className="text-sm text-red-600 font-mono break-all">{error}</p>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'marketplace' | 'owner' | 'admin' | 'role-selection' | 'profile' | 'cart'>('marketplace');
  const [cart, setCart] = useState<{product: Product, quantity: number, shopId: string}[]>([]);
  const [selectedLocation, setSelectedLocation] = useState(LOCATIONS[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const addToCart = (product: Product, shopId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1, shopId }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const clearCart = () => setCart([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            // Force admin role for default admins if they don't have it
            if (firebaseUser.email === 'senamallas@gmail.com' && data.role !== 'admin') {
              const updatedProfile = { ...data, role: 'admin' as UserRole };
              await updateDoc(docRef, { role: 'admin' });
              setProfile(updatedProfile);
              setView('admin');
            } else if (firebaseUser.email === 'srujan77991@gmail.com' && data.role === 'admin') {
              // Demote srujan77991@gmail.com if they were previously an admin
              const updatedProfile = { ...data, role: 'customer' as UserRole };
              await updateDoc(docRef, { role: 'customer' });
              setProfile(updatedProfile);
              setView('marketplace');
            } else {
              setProfile(data);
              // Set initial view based on role
              if (data.role === 'owner') setView('owner');
              else if (data.role === 'admin') setView('admin');
              else setView('marketplace');
            }
          } else {
            // Check if this is the default admin
            if (firebaseUser.email === 'senamallas@gmail.com' || firebaseUser.email === 'srujan77991@gmail.com') {
              const adminProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                role: 'admin',
                displayName: firebaseUser.displayName || 'Admin',
                photoURL: firebaseUser.photoURL || undefined,
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), adminProfile);
              setProfile(adminProfile);
              setView('admin');
            } else {
              setView('role-selection');
            }
          }
        } catch (err: any) {
          setError(err.message);
        }
      } else {
        setProfile(null);
        setView('marketplace');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRoleSelect = async (role: UserRole) => {
    if (!user) return;
    try {
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email!,
        role,
        displayName: user.displayName || 'User',
        photoURL: user.photoURL || undefined,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
      if (role === 'owner') setView('owner');
      else setView('marketplace');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#1A1A1A]/5 h-16 flex items-center">
        <div className="max-w-7xl mx-auto w-full px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => setView(profile?.role === 'owner' ? 'owner' : 'marketplace')}>
            <div className="w-8 h-8 bg-[#5A5A40] rounded-full flex items-center justify-center text-white">
              <Store size={18} />
            </div>
            <h1 className="font-serif text-xl font-bold tracking-tight hidden sm:block">HyperMart</h1>
          </div>

          {/* Search Bar in Header */}
          {view === 'marketplace' && (
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" size={16} />
              <input 
                type="text" 
                placeholder="Search for shops or categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2 bg-[#F5F5F0] rounded-xl focus:outline-none focus:ring-2 ring-[#5A5A40]/10 transition-all text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <div className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-[#F5F5F0] rounded-full text-[#5A5A40] border border-[#1A1A1A]/5 hover:bg-[#E5E5E0] transition-all group">
              <MapPin size={16} className="group-hover:scale-110 transition-transform" />
              <div className="relative flex items-center">
                <select 
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="appearance-none bg-transparent pr-6 text-[10px] md:text-xs font-bold uppercase tracking-widest focus:outline-none cursor-pointer max-w-[100px] md:max-w-none truncate z-10"
                >
                  {LOCATIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                  <option value="Unknown">Unknown</option>
                </select>
                <ChevronDown size={14} className="absolute right-0 pointer-events-none" />
              </div>
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden lg:block text-right">
                  <p className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-widest">{profile?.role}</p>
                  <p className="text-xs font-bold truncate max-w-[100px]">{user.displayName}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-[#F5F5F0] rounded-full transition-colors text-[#5A5A40]"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="bg-[#5A5A40] text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-[#4A4A30] transition-colors shadow-sm"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="pb-20">
        {error && <ErrorBoundary error={error} />}

        <AnimatePresence mode="wait">
          {view === 'role-selection' && (
            <RoleSelection onSelect={handleRoleSelect} />
          )}
          {view === 'marketplace' && (
            <MarketplaceView 
              user={user} 
              profile={profile} 
              cart={cart}
              onAddToCart={addToCart}
              onUpdateQuantity={updateCartQuantity}
              onRemove={removeFromCart}
              onClear={clearCart}
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          )}
          {view === 'owner' && profile?.role === 'owner' && (
            <OwnerDashboard user={user} profile={profile} />
          )}
          {view === 'admin' && profile?.role === 'admin' && (
            <AdminPanel user={user} profile={profile} />
          )}
          {view === 'profile' && user && profile && (
            <ProfileView user={user} profile={profile} onLogout={handleLogout} />
          )}
          {view === 'cart' && user && profile && (
            <GlobalCartView 
              userId={user.uid} 
              cart={cart} 
              onUpdateQuantity={updateCartQuantity} 
              onRemove={removeFromCart} 
              onClear={clearCart}
              onBack={() => setView('marketplace')} 
            />
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Navigation */}
      {user && profile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#1A1A1A]/10 px-6 py-3 flex justify-around items-center sm:hidden z-50">
          {profile.role === 'owner' ? (
            <>
              <NavButton active={view === 'owner'} onClick={() => setView('owner')} icon={<BarChart3 size={20} />} label="Stats" />
              <NavButton active={false} onClick={() => {}} icon={<Package size={20} />} label="Stock" />
              <NavButton active={false} onClick={() => {}} icon={<ClipboardList size={20} />} label="Orders" />
            </>
          ) : (
            <>
              <NavButton active={view === 'marketplace'} onClick={() => setView('marketplace')} icon={<ShoppingBag size={20} />} label="Shop" />
              <NavButton active={view === 'cart'} onClick={() => setView('cart')} icon={<ShoppingCart size={20} />} label="Cart" />
              <NavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<UserIcon size={20} />} label="Profile" />
            </>
          )}
        </nav>
      )}
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${active ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/40'}`}
    >
      {icon}
      <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
    </button>
  );
}

// --- Views ---

function RoleSelection({ onSelect }: { onSelect: (role: UserRole) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-[70vh] px-4"
    >
      <h2 className="font-serif text-3xl font-bold mb-2 text-center">Welcome to HyperMart</h2>
      <p className="text-[#5A5A40] mb-12 text-center max-w-md">Choose how you want to use the platform to get started.</p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
        <RoleCard 
          title="I'm a Shop Owner" 
          description="Manage your inventory, billing, and reach customers nearby."
          icon={<Store size={40} />}
          onClick={() => onSelect('owner')}
        />
        <RoleCard 
          title="I'm a Customer" 
          description="Discover local shops and order essentials from your trusted stores."
          icon={<ShoppingBag size={40} />}
          onClick={() => onSelect('customer')}
        />
      </div>
    </motion.div>
  );
}

function RoleCard({ title, description, icon, onClick }: { title: string, description: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="p-8 bg-white border border-[#1A1A1A]/10 rounded-3xl text-left hover:border-[#5A5A40] hover:shadow-xl transition-all group"
    >
      <div className="text-[#5A5A40] mb-6 group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="font-serif text-xl font-bold mb-2">{title}</h3>
      <p className="text-sm text-[#1A1A1A]/60 leading-relaxed">{description}</p>
    </button>
  );
}

// --- Marketplace View ---

function MarketplaceView({ 
  user, 
  profile, 
  cart, 
  onAddToCart, 
  onUpdateQuantity, 
  onRemove, 
  onClear,
  selectedLocation,
  onLocationChange,
  searchTerm,
  setSearchTerm
}: { 
  user: FirebaseUser | null, 
  profile: UserProfile | null,
  cart: {product: Product, quantity: number, shopId: string}[],
  onAddToCart: (p: Product, shopId: string) => void,
  onUpdateQuantity: (id: string, d: number) => void,
  onRemove: (id: string) => void,
  onClear: () => void,
  selectedLocation: string,
  onLocationChange: (loc: string) => void,
  searchTerm: string,
  setSearchTerm: (s: string) => void
}) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [showMyOrders, setShowMyOrders] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'shops'), where('status', '==', 'approved'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shopList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
      setShops(shopList);
      setLoading(false);
    }, (err: any) => {
      console.error("Marketplace shops error:", err);
      setError(err.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (error) return <ErrorBoundary error={error} />;

  if (showMyOrders && user) {
    return <CustomerOrdersView userId={user.uid} onBack={() => setShowMyOrders(false)} />;
  }

  if (selectedShop) {
    return (
      <ShopProductsView 
        shop={selectedShop} 
        onBack={() => setSelectedShop(null)} 
        user={user} 
        cart={cart}
        onAddToCart={onAddToCart}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={onRemove}
        onClear={onClear}
      />
    );
  }

  const filteredShops = shops.filter(shop => {
    const matchesSearch = shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         shop.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    // If shop has no locationName, show it in all locations (fallback for older data or missing selection)
    if (!shop.locationName) return matchesSearch;

    // If shop has a location, it must match exactly OR be "Unknown" debug view
    if (selectedLocation === 'Unknown') return matchesSearch;

    return matchesSearch && shop.locationName === selectedLocation;
  });

  const ALL_CATEGORIES = ['Grocery', 'Dairy', 'Vegetables & Fruits', 'Meat', 'Bakery & Snacks', 'Beverages', 'Household', 'Personal Care'];

  const shopsByCategory = filteredShops.reduce((acc, shop) => {
    if (!acc[shop.category]) acc[shop.category] = [];
    acc[shop.category].push(shop);
    return acc;
  }, {} as Record<string, Shop[]>);

  if (selectedShop) {
    return (
      <ShopProductsView 
        shop={selectedShop} 
        onBack={() => setSelectedShop(null)} 
        user={user}
        cart={cart}
        onAddToCart={onAddToCart}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={onRemove}
        onClear={onClear}
      />
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-20"
    >
      {/* Sticky Category Menu */}
      <div className="sticky top-16 z-40 bg-white border-b border-[#1A1A1A]/5">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setSearchTerm('')}
              className={`px-5 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border uppercase tracking-widest ${searchTerm === '' ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#1A1A1A]/60 border-[#1A1A1A]/10 hover:border-[#5A5A40]'}`}
            >
              All
            </button>
            {ALL_CATEGORIES.map(cat => (
              <button 
                key={cat}
                onClick={() => setSearchTerm(cat)}
                className={`px-5 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border uppercase tracking-widest ${searchTerm === cat ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#1A1A1A]/60 border-[#1A1A1A]/10 hover:border-[#5A5A40]'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Shop Sections */}
      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-12">
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin w-10 h-10 border-4 border-[#5A5A40] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-[#1A1A1A]/40 font-serif italic">Finding shops near you...</p>
          </div>
        ) : (
          ALL_CATEGORIES.map(category => {
            const categoryShops = shopsByCategory[category] || [];
            
            // If searching for a specific category, only show that one
            if (searchTerm && searchTerm !== category && ALL_CATEGORIES.includes(searchTerm)) {
              return null;
            }

            return (
              <div key={category} className="space-y-6">
                <div className="flex justify-between items-end px-2">
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">{category}</h3>
                    <p className="text-xs text-[#1A1A1A]/40 font-bold uppercase tracking-widest mt-1">Fresh from {selectedLocation}</p>
                  </div>
                  {categoryShops.length > 0 && (
                    <button 
                      onClick={() => setSearchTerm(category)}
                      className="text-[#5A5A40] text-sm font-bold uppercase tracking-widest flex items-center gap-1 hover:underline"
                    >
                      See All <ChevronRight size={16} />
                    </button>
                  )}
                </div>
                
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
                  {categoryShops.length > 0 ? (
                    categoryShops.map(shop => (
                      <ShopCard key={shop.id} shop={shop} onClick={() => setSelectedShop(shop)} />
                    ))
                  ) : (
                    <div className="flex-shrink-0 w-full sm:w-auto h-32 flex items-center justify-center bg-[#F5F5F0]/50 rounded-3xl border border-dashed border-[#1A1A1A]/10 px-12">
                      <p className="text-[#1A1A1A]/30 italic text-sm">No shops registered in this category yet.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Fallback if no shops at all and not searching */}
        {!loading && filteredShops.length === 0 && !searchTerm && (
          <div className="py-20 text-center">
            <p className="text-[#5A5A40] italic font-serif text-xl">No shops found in your area yet.</p>
            {shops.length > 0 && (
              <div className="mt-8">
                <p className="text-sm text-[#1A1A1A]/60 mb-4">We found {shops.length} approved shops in other locations:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {Array.from(new Set(shops.map((s: any) => s.locationName || 'Unknown'))).map((loc: any) => (
                    <button 
                      key={loc}
                      onClick={() => onLocationChange(loc as string)}
                      className="px-4 py-2 bg-white border border-[#1A1A1A]/10 rounded-full text-xs font-bold uppercase tracking-widest hover:border-[#5A5A40] transition-all"
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showMyOrders && (
          <div className="fixed inset-0 z-[100] bg-[#F5F5F0] overflow-y-auto">
            <CustomerOrdersView userId={user!.uid} onBack={() => setShowMyOrders(false)} />
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CustomerOrdersView({ userId, onBack }: { userId: string, onBack: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'orders'), where('customerId', '==', userId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-7xl mx-auto p-4 sm:p-8"
    >
      <button onClick={onBack} className="flex items-center gap-2 text-[#5A5A40] font-bold uppercase tracking-widest mb-8 hover:gap-4 transition-all">
        <ArrowLeft size={18} /> Back to Marketplace
      </button>

      <h2 className="font-serif text-3xl font-bold mb-8">My Orders</h2>

      <div className="space-y-4">
        {loading ? (
          <p>Loading orders...</p>
        ) : orders.length > 0 ? (
          orders.map((order) => (
            <div key={order.id} className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 flex flex-col sm:flex-row justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-widest">Order #{order.id.slice(-6)}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
                    order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    order.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {order.status}
                  </span>
                </div>
                <div className="space-y-1">
                  {order.items.map((item, i) => (
                    <p key={i} className="text-sm">{item.name} x {item.quantity}</p>
                  ))}
                </div>
              </div>
              <div className="text-right flex flex-col justify-between">
                <p className="text-2xl font-serif font-bold">₹{order.total}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mt-2">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center bg-white border border-[#1A1A1A]/10 rounded-3xl">
            <p className="text-[#1A1A1A]/30 italic">You haven't placed any orders yet.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ShopCard({ shop, onClick }: { shop: Shop, onClick: () => void, key?: React.Key }) {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex-shrink-0 w-40 sm:w-48 bg-white border border-[#1A1A1A]/5 rounded-2xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all"
    >
      <div className="aspect-[4/3] bg-[#F5F5F0] relative overflow-hidden">
        {shop.logo ? (
          <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#5A5A40]/20">
            <Store size={32} />
          </div>
        )}
        {/* Status Top Left */}
        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest border border-[#1A1A1A]/5 text-[#5A5A40]">
          OPEN
        </div>
        {/* Category Top Right */}
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest border border-[#1A1A1A]/5">
          {shop.category}
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h4 className="font-serif text-sm font-bold truncate leading-tight flex-1">{shop.name}</h4>
          <div className="flex items-center gap-0.5 bg-green-50 px-1.5 py-0.5 rounded text-[9px] font-bold text-green-700 border border-green-100 shrink-0">
            <Star size={8} fill="currentColor" />
            {shop.rating || '4.5'}
          </div>
        </div>
        <p className="text-[9px] text-[#1A1A1A]/40 truncate mb-2 flex items-center gap-1">
          <MapPin size={8} /> {shop.address}
        </p>
        <div className="flex items-center justify-between pt-2 border-t border-[#1A1A1A]/5">
          <div className="flex gap-2.5">
            <Phone size={12} className="text-[#5A5A40] hover:scale-110 transition-transform" />
            <MessageCircle size={12} className="text-[#5A5A40] hover:scale-110 transition-transform" />
          </div>
          <button className="text-[9px] font-bold text-white bg-[#5A5A40] px-3 py-1 rounded-lg hover:bg-[#4A4A30] transition-colors">
            Shop
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ShopProductsView({ shop, onBack, user, cart, onAddToCart, onUpdateQuantity, onRemove, onClear }: { 
  shop: Shop, 
  onBack: () => void, 
  user: FirebaseUser | null,
  cart: {product: Product, quantity: number, shopId: string}[],
  onAddToCart: (p: Product, shopId: string) => void,
  onUpdateQuantity: (id: string, d: number) => void,
  onRemove: (id: string) => void,
  onClear: () => void
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'products'), where('shopId', '==', shop.id), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [shop.id]);

  const shopCart = cart.filter(item => item.shopId === shop.id);
  const total = shopCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handlePlaceOrder = async () => {
    if (!user) {
      alert("Please login to place an order.");
      return;
    }
    try {
      const orderData: Omit<Order, 'id'> = {
        shopId: shop.id,
        customerId: user.uid,
        items: shopCart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity
        })),
        total,
        status: 'pending',
        paymentStatus: 'pending',
        deliveryAddress: 'Default Address', // In real app, get from user
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'orders'), orderData);
      alert("Order placed successfully!");
      onClear();
      setShowCart(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-7xl mx-auto p-4 sm:p-8"
    >
      <button onClick={onBack} className="flex items-center gap-2 text-[#5A5A40] font-bold uppercase tracking-widest mb-8 hover:gap-4 transition-all">
        <ArrowLeft size={18} /> Back to Shops
      </button>

      <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start mb-8">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white border border-[#1A1A1A]/5 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm">
          {shop.logo ? <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" /> : <Store size={32} className="text-[#5A5A40]/20" />}
        </div>
        <div className="text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-2 mb-1">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold">{shop.name}</h2>
            <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-lg text-xs font-bold text-green-700 border border-green-100 mb-1">
              <Star size={12} fill="currentColor" />
              {shop.rating || '4.5'}
              <span className="text-[#1A1A1A]/30 font-normal ml-1">({shop.reviewCount || '100+'})</span>
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-[#1A1A1A]/40 flex items-center justify-center sm:justify-start gap-1 mb-3">
            <MapPin size={12} /> {shop.address}
          </p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2">
            <span className="bg-[#5A5A40]/5 text-[#5A5A40] px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border border-[#5A5A40]/10">{shop.category}</span>
            <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 border border-green-100">
              <Clock size={10} /> {shop.timings}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {loading ? (
          Array(12).fill(0).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-white/50 animate-pulse rounded-2xl border border-[#1A1A1A]/5" />
          ))
        ) : products.length > 0 ? (
          products.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={() => onAddToCart(product, shop.id)} />
          ))
        ) : (
          <div className="col-span-full py-20 text-center">
            <p className="text-[#1A1A1A]/30 italic">No products listed in this shop yet.</p>
          </div>
        )}
      </div>

      {/* Cart Button */}
      {shopCart.length > 0 && (
        <button 
          onClick={() => setShowCart(true)}
          className="fixed bottom-24 right-8 bg-[#5A5A40] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 hover:scale-105 transition-all z-[60]"
        >
          <div className="relative">
            <ShoppingCart size={24} />
            <span className="absolute -top-2 -right-2 bg-white text-[#5A5A40] w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center">
              {shopCart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">View Cart</p>
            <p className="font-bold">₹{total}</p>
          </div>
        </button>
      )}

      {/* Cart Modal */}
      <AnimatePresence>
        {showCart && (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-serif text-2xl font-bold">Your Cart</h3>
                <button onClick={() => setShowCart(false)} className="p-2 hover:bg-[#F5F5F0] rounded-full"><XCircle size={24} /></button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                {shopCart.map((item) => (
                  <div key={item.product.id} className="flex gap-4">
                    <div className="w-16 h-16 bg-[#F5F5F0] rounded-2xl overflow-hidden flex-shrink-0">
                      {item.product.image ? <img src={item.product.image} className="w-full h-full object-cover" /> : <Package size={24} className="m-auto text-[#5A5A40]/20 mt-4" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold">{item.product.name}</h4>
                      <p className="text-sm text-[#1A1A1A]/40">₹{item.product.price} / {item.product.unit}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center border border-[#1A1A1A]/10 rounded-full px-2 py-1">
                          <button onClick={() => onUpdateQuantity(item.product.id, -1)} className="p-1 hover:bg-[#F5F5F0] rounded-full"><Plus size={14} className="rotate-45" /></button>
                          <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                          <button onClick={() => onUpdateQuantity(item.product.id, 1)} className="p-1 hover:bg-[#F5F5F0] rounded-full"><Plus size={14} /></button>
                        </div>
                        <button onClick={() => onRemove(item.product.id)} className="text-xs font-bold text-red-500 uppercase tracking-widest">Remove</button>
                      </div>
                    </div>
                    <div className="text-right font-bold">
                      ₹{item.product.price * item.quantity}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-8 border-t border-[#1A1A1A]/10">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[#1A1A1A]/40 font-bold uppercase tracking-widest">Total Amount</span>
                  <span className="text-3xl font-serif font-bold">₹{total}</span>
                </div>
                <button 
                  onClick={handlePlaceOrder}
                  className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold text-lg hover:bg-[#4A4A30] transition-all shadow-lg flex items-center justify-center gap-3"
                >
                  Place Order <ChevronRight size={20} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProductCard({ product, onAdd }: { product: Product, onAdd: () => void, key?: React.Key }) {
  return (
    <div className="bg-white border border-[#1A1A1A]/5 rounded-2xl p-2.5 flex flex-col hover:shadow-md transition-shadow group">
      <div className="aspect-square bg-[#F5F5F0] rounded-xl mb-2 overflow-hidden relative border border-[#1A1A1A]/5">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#5A5A40]/10">
            <Package size={32} />
          </div>
        )}
        <div className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest border border-[#1A1A1A]/5">
          {product.unit}
        </div>
        
        {/* ADD Button positioned like reference */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="absolute bottom-2 right-2 bg-white text-[#FF3269] border border-[#FF3269]/20 px-3 py-1 rounded-lg text-[10px] font-bold shadow-sm hover:bg-[#FF3269] hover:text-white transition-all uppercase tracking-wider"
        >
          ADD
        </button>
      </div>
      
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold">₹{product.price}</span>
          {product.mrp > product.price && (
            <span className="text-[9px] text-[#1A1A1A]/30 line-through font-medium">₹{product.mrp}</span>
          )}
        </div>
        <h4 className="text-[11px] font-medium text-[#1A1A1A]/80 line-clamp-2 leading-tight h-7">{product.name}</h4>
        <p className="text-[9px] text-[#1A1A1A]/40 font-medium">{product.category}</p>
      </div>
    </div>
  );
}

// --- Owner Dashboard ---

function OwnerDashboard({ user, profile }: { user: FirebaseUser, profile: UserProfile }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopIndex, setSelectedShopIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showRegForm, setShowRegForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'inventory' | 'orders' | 'billing'>('stats');

  useEffect(() => {
    const q = query(collection(db, 'shops'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
      setShops(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user.uid]);

  if (loading) return (
    <div className="p-20 text-center">
      <div className="animate-spin w-8 h-8 border-2 border-[#5A5A40] border-t-transparent rounded-full mx-auto mb-4"></div>
      <p className="text-[#1A1A1A]/40 font-medium">Loading your dashboard...</p>
    </div>
  );

  if (shops.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <div className="w-20 h-20 bg-[#5A5A40]/10 rounded-full flex items-center justify-center text-[#5A5A40] mx-auto mb-6">
          <Store size={40} />
        </div>
        <h2 className="font-serif text-3xl font-bold mb-4">Register Your Shop</h2>
        <p className="text-[#1A1A1A]/60 mb-8">You haven't registered a shop yet. Start your digital journey today.</p>
        <button 
          onClick={() => setShowRegForm(true)}
          className="bg-[#5A5A40] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#4A4A30] transition-all shadow-lg"
        >
          Register Now
        </button>

        {showRegForm && <ShopRegistrationForm userId={user.uid} onClose={() => setShowRegForm(false)} />}
      </div>
    );
  }

  const currentShop = shops[selectedShopIndex];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8">
      {/* Shop Identity Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-white border border-[#1A1A1A]/10 rounded-3xl flex items-center justify-center text-[#5A5A40] shadow-sm overflow-hidden">
            {currentShop.logo ? (
              <img src={currentShop.logo} alt={currentShop.name} className="w-full h-full object-cover" />
            ) : (
              <Store size={32} />
            )}
          </div>
          <div>
            <p className="text-[#5A5A40] font-bold uppercase tracking-[0.2em] text-[10px] mb-2">Welcome back, {user.displayName?.split(' ')[0]}</p>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="font-serif text-3xl font-bold">{currentShop.name}</h2>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
                currentShop.status === 'approved' ? 'bg-green-100 text-green-700' : 
                currentShop.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                'bg-red-100 text-red-700'
              }`}>
                {currentShop.status}
              </span>
            </div>
            <p className="text-[#1A1A1A]/60 flex items-center gap-2">
              <MapPin size={14} /> {currentShop.address}
            </p>
            <div className="flex gap-2 mt-2">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-[#F5F5F0] px-2 py-1 rounded text-[#5A5A40]">{currentShop.category}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-[#F5F5F0] px-2 py-1 rounded text-[#1A1A1A]/40">{currentShop.timings}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          {shops.length > 1 && (
            <div className="flex flex-col items-end">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Switch Shop</label>
              <select 
                value={selectedShopIndex}
                onChange={(e) => setSelectedShopIndex(parseInt(e.target.value))}
                className="bg-white border border-[#1A1A1A]/10 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 ring-[#5A5A40]/20"
              >
                {shops.map((s, idx) => (
                  <option key={s.id} value={idx}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <button 
            onClick={() => setShowRegForm(true)}
            className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest flex items-center gap-2 hover:opacity-70 transition-all"
          >
            <Plus size={14} /> Add Another Location
          </button>
        </div>
      </div>

      {showRegForm && <ShopRegistrationForm userId={user.uid} onClose={() => setShowRegForm(false)} />}

      {currentShop.status === 'pending' && (
        <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-3xl flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
            <Clock size={24} />
          </div>
          <div>
            <h4 className="font-bold text-amber-900 text-lg">Registration Pending</h4>
            <p className="text-amber-700">Our team is reviewing <span className="font-bold">{currentShop.name}</span>. It will be live on the marketplace soon.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-8 mb-8 border-b border-[#1A1A1A]/5 overflow-x-auto no-scrollbar">
        <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} label="Overview" />
        <TabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} label="Inventory" />
        <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} label="Orders" />
        <TabButton active={activeTab === 'billing'} onClick={() => setActiveTab('billing')} label="Billing" />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'stats' && (
          <motion.div 
            key="stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <StatCard label="Today's Sales" value="₹0" icon={<BarChart3 size={24} />} />
              <StatCard label="Orders" value="0" icon={<ClipboardList size={24} />} />
              <StatCard label="Products" value="0" icon={<Package size={24} />} />
            </div>

            <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-8 shadow-sm">
              <h3 className="font-serif text-xl font-bold mb-6">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                <ActionButton icon={<Plus size={20} />} label="Add Product" color="bg-[#5A5A40]" onClick={() => setActiveTab('inventory')} />
                <ActionButton icon={<ClipboardList size={20} />} label="New Bill" color="bg-[#1A1A1A]" onClick={() => setActiveTab('billing')} />
                <ActionButton icon={<Settings size={20} />} label="Settings" color="bg-[#F5F5F0]" textColor="text-[#1A1A1A]" onClick={() => {}} />
                <ActionButton icon={<Phone size={20} />} label="Support" color="bg-[#F5F5F0]" textColor="text-[#1A1A1A]" onClick={() => {}} />
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'inventory' && (
          <InventoryManager shopId={currentShop.id} />
        )}

        {activeTab === 'orders' && (
          <OrderManager shopId={currentShop.id} />
        )}

        {activeTab === 'billing' && (
          <BillingSystem shopId={currentShop.id} />
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative whitespace-nowrap ${active ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/30'}`}
    >
      {label}
      {active && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
    </button>
  );
}

function BillingSystem({ shopId }: { shopId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [billItems, setBillItems] = useState<{product: Product, quantity: number}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'products'), where('shopId', '==', shopId), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(list);
    });
    return () => unsubscribe();
  }, [shopId]);

  const addToBill = (product: Product) => {
    setBillItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setBillItems(prev => prev.map(item => {
      if (item.product.id === productId) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setBillItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const total = billItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-8"
    >
      {/* Product Selection */}
      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" size={16} />
          <input 
            type="text" 
            placeholder="Search products to add..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-2 bg-white border border-[#1A1A1A]/10 rounded-2xl focus:outline-none text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
          {filteredProducts.map((p) => (
            <button 
              key={p.id}
              onClick={() => addToBill(p)}
              className="p-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-left hover:border-[#5A5A40] transition-all flex items-center gap-4 group"
            >
              <div className="w-12 h-12 bg-[#F5F5F0] rounded-xl flex items-center justify-center text-[#5A5A40]/20 group-hover:bg-[#5A5A40]/10 transition-all">
                <Package size={24} />
              </div>
              <div>
                <p className="font-bold text-sm">{p.name}</p>
                <p className="text-xs text-[#1A1A1A]/40">₹{p.price} / {p.unit}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bill Summary */}
      <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-8 flex flex-col shadow-sm">
        <h3 className="font-serif text-2xl font-bold mb-8">New Bill</h3>
        
        <div className="flex-1 space-y-6 overflow-y-auto pr-2 mb-8">
          {billItems.length > 0 ? (
            billItems.map((item) => (
              <div key={item.product.id} className="flex justify-between items-center">
                <div className="flex-1">
                  <p className="font-bold">{item.product.name}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center border border-[#1A1A1A]/10 rounded-full px-2 py-0.5">
                      <button onClick={() => updateQty(item.product.id, -1)} className="p-1 hover:bg-[#F5F5F0] rounded-full"><Plus size={12} className="rotate-45" /></button>
                      <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product.id, 1)} className="p-1 hover:bg-[#F5F5F0] rounded-full"><Plus size={12} /></button>
                    </div>
                    <button onClick={() => removeItem(item.product.id)} className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Remove</button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">₹{item.product.price * item.quantity}</p>
                  <p className="text-[10px] text-[#1A1A1A]/40">₹{item.product.price} x {item.quantity}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center border-2 border-dashed border-[#1A1A1A]/5 rounded-2xl">
              <p className="text-[#1A1A1A]/30 italic">Add products to start billing.</p>
            </div>
          )}
        </div>

        <div className="pt-8 border-t border-[#1A1A1A]/10">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[#1A1A1A]/40 font-bold uppercase tracking-widest">Total Bill</span>
            <span className="text-4xl font-serif font-bold">₹{total}</span>
          </div>
          <button 
            disabled={billItems.length === 0}
            className="w-full bg-[#1A1A1A] text-white py-4 rounded-2xl font-bold text-lg hover:bg-black transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-30"
          >
            Generate Bill <ClipboardList size={20} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function InventoryManager({ shopId }: { shopId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('catalog');

  useEffect(() => {
    const q = query(collection(db, 'products'), where('shopId', '==', shopId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(list);
    });
    return () => unsubscribe();
  }, [shopId]);

  const menuItems = [
    { id: 'catalog', label: 'Catalog', icon: <Package size={18} /> },
    { 
      id: 'purchase', 
      label: 'Purchase', 
      icon: <ShoppingCart size={18} />,
      subItems: ['Supplier', 'Goods Received Note', 'GReturn']
    },
    { 
      id: 'sale', 
      label: 'Sale', 
      icon: <Receipt size={18} />,
      subItems: ['Direct', 'Sale Return Against Bill']
    },
    { 
      id: 'stock', 
      label: 'Stock Adjustment', 
      icon: <RefreshCw size={18} />,
      subItems: ['Increase', 'Decrease', 'Purchase Price', 'MRP', 'Stock Quantity', 'Expiry date']
    },
    { id: 'bulk', label: 'Bulk Discount', icon: <Percent size={18} /> },
    { 
      id: 'credit', 
      label: 'Credit', 
      icon: <CreditCard size={18} />,
      subItems: ['Supplier', 'Customer']
    },
    { id: 'cancel', label: 'Cancel Order', icon: <XCircle size={18} /> },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Horizontal Floating Menu */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-[#1A1A1A]/10 rounded-[2rem] p-2 shadow-sm relative z-50 overflow-visible">
        {menuItems.map((item) => (
          <div key={item.id} className="relative group">
            <button
              onClick={() => setActiveSubTab(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${
                activeSubTab === item.id 
                  ? 'bg-[#5A5A40] text-white shadow-md' 
                  : 'text-[#1A1A1A]/60 hover:bg-[#F5F5F0] hover:text-[#5A5A40]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.subItems && <ChevronDown size={14} className="opacity-40 group-hover:rotate-180 transition-transform" />}
            </button>
            
            {item.subItems && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-[#1A1A1A]/10 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] py-2 translate-y-2 group-hover:translate-y-0">
                <div className="px-4 py-2 mb-1 border-b border-[#1A1A1A]/5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/30">{item.label} Options</span>
                </div>
                {item.subItems.map(sub => (
                  <button
                    key={sub}
                    onClick={() => setActiveSubTab(item.id)}
                    className="w-full text-left px-4 py-2.5 text-xs font-medium text-[#1A1A1A]/60 hover:text-[#5A5A40] hover:bg-[#F5F5F0] transition-colors flex items-center justify-between group/sub"
                  >
                    {sub}
                    <ChevronRight size={12} className="opacity-0 group-hover/sub:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="min-h-[400px]">
        {activeSubTab === 'catalog' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-3xl font-bold text-[#1A1A1A]">Product Catalog</h3>
              <button 
                onClick={() => setShowAddForm(true)}
                className="bg-[#5A5A40] text-white px-8 py-3.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#4A4A30] transition-all shadow-lg hover:shadow-xl active:scale-95"
              >
                <Plus size={20} /> Add Product
              </button>
            </div>

            <div className="bg-white border border-[#1A1A1A]/10 rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F5F5F0]/50 border-b border-[#1A1A1A]/5">
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Product</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Category</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center">Price</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center">Stock</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center">Status</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]/5">
                    {products.length > 0 ? (
                      products.map((p) => (
                        <tr key={p.id} className="hover:bg-[#F5F5F0]/30 transition-colors group/row">
                          <td className="p-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-[#F5F5F0] rounded-xl overflow-hidden flex-shrink-0 shadow-inner border border-[#1A1A1A]/5">
                                {p.image ? (
                                  <img src={p.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <Package size={24} className="m-auto text-[#5A5A40]/20 mt-3" />
                                )}
                              </div>
                              <span className="font-bold text-[#1A1A1A]">{p.name}</span>
                            </div>
                          </td>
                          <td className="p-6">
                            <span className="px-3 py-1 bg-[#F5F5F0] rounded-full text-[11px] font-bold text-[#1A1A1A]/60 uppercase tracking-wider">
                              {p.category}
                            </span>
                          </td>
                          <td className="p-6 text-center">
                            <div className="font-serif font-bold text-lg text-[#1A1A1A]">
                              ₹{p.price}
                              <span className="text-[10px] font-sans text-[#1A1A1A]/30 ml-1">/ {p.unit}</span>
                            </div>
                          </td>
                          <td className="p-6 text-center">
                            <span className={`font-bold ${p.stock < 10 ? 'text-red-500' : 'text-[#1A1A1A]'}`}>
                              {p.stock}
                            </span>
                          </td>
                          <td className="p-6 text-center">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${
                              p.status === 'active' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {p.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-6 text-right">
                            <button className="p-2.5 hover:bg-[#5A5A40] hover:text-white rounded-xl text-[#5A5A40] transition-all shadow-sm hover:shadow-md">
                              <Settings size={18} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-24 text-center">
                          <div className="flex flex-col items-center gap-4 opacity-30">
                            <Package size={48} />
                            <p className="italic font-medium">No products added yet.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-[#1A1A1A]/10 rounded-[3rem] p-24 text-center shadow-sm"
          >
            <div className="w-24 h-24 bg-[#F5F5F0] rounded-full flex items-center justify-center mx-auto mb-8 text-[#5A5A40] shadow-inner">
              {menuItems.find(i => i.id === activeSubTab)?.icon}
            </div>
            <h3 className="font-serif text-3xl font-bold mb-4 text-[#1A1A1A]">
              {menuItems.find(i => i.id === activeSubTab)?.label}
            </h3>
            <p className="text-[#1A1A1A]/40 max-w-md mx-auto text-lg leading-relaxed">
              The {menuItems.find(i => i.id === activeSubTab)?.label} module is being initialized. 
              This will allow you to manage {menuItems.find(i => i.id === activeSubTab)?.label.toLowerCase()} operations directly from your dashboard.
            </p>
            <button 
              onClick={() => setActiveSubTab('catalog')}
              className="mt-10 text-[#5A5A40] font-bold flex items-center gap-2 mx-auto hover:underline"
            >
              <ArrowLeft size={18} /> Back to Catalog
            </button>
          </motion.div>
        )}
      </div>

      {showAddForm && <AddProductForm shopId={shopId} onClose={() => setShowAddForm(false)} />}
    </motion.div>
  );
}

const QUICK_ADD_ITEMS: Record<string, { name: string, price: number, unit: string, image: string }[]> = {
  'Grocery': [
    { name: 'Basmati Rice', price: 90, unit: 'kg', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400' },
    { name: 'Toor Dal', price: 160, unit: 'kg', image: 'https://images.unsplash.com/photo-1585996853881-dad6643844b6?auto=format&fit=crop&q=80&w=400' },
    { name: 'Sugar', price: 45, unit: 'kg', image: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&q=80&w=400' },
    { name: 'Wheat Flour (Atta)', price: 55, unit: 'kg', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400' },
  ],
  'Dairy': [
    { name: 'Fresh Milk', price: 30, unit: '500ml', image: 'https://images.unsplash.com/photo-1563636619-e9107da5a163?auto=format&fit=crop&q=80&w=400' },
    { name: 'Paneer', price: 100, unit: '200g', image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&q=80&w=400' },
    { name: 'Curd', price: 40, unit: '500g', image: 'https://images.unsplash.com/photo-1485962391905-dc37bc33e58b?auto=format&fit=crop&q=80&w=400' },
    { name: 'Butter', price: 55, unit: '100g', image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&q=80&w=400' },
  ],
  'Fruits/Vegetable': [
    { name: 'Tomato', price: 40, unit: 'kg', image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=400' },
    { name: 'Onion', price: 35, unit: 'kg', image: 'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&q=80&w=400' },
    { name: 'Potato', price: 30, unit: 'kg', image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=400' },
    { name: 'Banana', price: 60, unit: 'doz', image: 'https://images.unsplash.com/photo-1571771894821-ad990241274d?auto=format&fit=crop&q=80&w=400' },
  ],
  'Meat/Fish': [
    { name: 'Chicken', price: 240, unit: 'kg', image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&q=80&w=400' },
    { name: 'Mutton', price: 750, unit: 'kg', image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?auto=format&fit=crop&q=80&w=400' },
    { name: 'Fish (Rohu)', price: 280, unit: 'kg', image: 'https://images.unsplash.com/photo-1534043464124-3be32fe000c9?auto=format&fit=crop&q=80&w=400' },
    { name: 'Eggs', price: 72, unit: 'doz', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&q=80&w=400' },
  ]
};

function AddProductForm({ shopId, onClose }: { shopId: string, onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    mrp: '',
    unit: 'kg',
    category: 'Grocery',
    stock: '100',
    description: '',
    image: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleQuickAdd = (item: { name: string, price: number, unit: string, image: string }) => {
    setFormData({
      ...formData,
      name: item.name,
      price: item.price.toString(),
      mrp: (item.price * 1.1).toFixed(0),
      unit: item.unit,
      image: item.image
    });
  };

  const handleGenerateDescription = async () => {
    if (!formData.name) return;
    setGenerating(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Write a short, appetizing 2-sentence description for a product named "${formData.name}" in a local kirana store.`,
      });
      setFormData({ ...formData, description: response.text || '' });
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const productData: Omit<Product, 'id'> = {
        shopId,
        name: formData.name,
        price: Number(formData.price),
        mrp: Number(formData.mrp || formData.price),
        unit: formData.unit,
        category: formData.category,
        stock: Number(formData.stock),
        status: 'active',
        image: formData.image || undefined,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'products'), productData);
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-8 w-full max-w-4xl shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-serif text-2xl font-bold">Add New Product</h3>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-full"><X size={24} /></button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Add Section */}
          <div className="lg:col-span-1 border-r border-[#1A1A1A]/5 pr-8">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-4">Quick Select</h4>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.keys(QUICK_ADD_ITEMS).map(cat => (
                  <button 
                    key={cat}
                    type="button"
                    onClick={() => setFormData({...formData, category: cat})}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${formData.category === cat ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] text-[#1A1A1A]/40'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {QUICK_ADD_ITEMS[formData.category]?.map((item, idx) => (
                  <button 
                    key={idx}
                    type="button"
                    onClick={() => handleQuickAdd(item)}
                    className="group flex flex-col items-center p-2 border border-[#1A1A1A]/5 rounded-2xl hover:border-[#5A5A40] hover:shadow-md transition-all text-center"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden mb-2 bg-[#F5F5F0]">
                      <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    </div>
                    <span className="text-[10px] font-bold leading-tight">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Product Name</label>
                  <input 
                    required
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
                    placeholder="e.g. Basmati Rice"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Price (₹)</label>
                    <input 
                      required
                      type="number" 
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
                      placeholder="90"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">MRP (₹)</label>
                    <input 
                      type="number" 
                      value={formData.mrp}
                      onChange={(e) => setFormData({...formData, mrp: e.target.value})}
                      className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
                      placeholder="100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Unit</label>
                    <select 
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
                    >
                      <option>kg</option>
                      <option>gram</option>
                      <option>500g</option>
                      <option>200g</option>
                      <option>100g</option>
                      <option>L</option>
                      <option>500ml</option>
                      <option>pkt</option>
                      <option>pc</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Stock</label>
                    <input 
                      type="number" 
                      value={formData.stock}
                      onChange={(e) => setFormData({...formData, stock: e.target.value})}
                      className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Product Image URL</label>
                  <div className="flex gap-4 items-start">
                    <div className="w-20 h-20 bg-[#F5F5F0] rounded-2xl overflow-hidden flex-shrink-0 border border-[#1A1A1A]/5">
                      {formData.image ? <img src={formData.image} className="w-full h-full object-cover" /> : <Camera className="m-auto mt-6 text-[#1A1A1A]/20" />}
                    </div>
                    <input 
                      type="url" 
                      value={formData.image}
                      onChange={(e) => setFormData({...formData, image: e.target.value})}
                      className="flex-1 p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none text-sm"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40">Description</label>
                    <button 
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={generating || !formData.name}
                      className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] flex items-center gap-1 hover:underline disabled:opacity-50"
                    >
                      <Sparkles size={12} /> {generating ? 'Generating...' : 'AI Generate'}
                    </button>
                  </div>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none h-32 resize-none"
                    placeholder="Describe your product..."
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 py-4 border border-[#1A1A1A]/10 rounded-2xl font-bold hover:bg-[#F5F5F0] transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={submitting}
                className="flex-[2] py-4 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/20 disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add Product'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

function OrderManager({ shopId }: { shopId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'orders'), where('shopId', '==', shopId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(list);
    });
    return () => unsubscribe();
  }, [shopId]);

  const updateStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h3 className="font-serif text-2xl font-bold">Manage Orders</h3>

      <div className="grid grid-cols-1 gap-4">
        {orders.length > 0 ? (
          orders.map((order) => (
            <div key={order.id} className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-widest">Order #{order.id.slice(-6)}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
                    order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    order.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {order.status}
                  </span>
                </div>
                <div className="space-y-2 mb-4">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.name} x {item.quantity}</span>
                      <span className="font-bold">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-[#1A1A1A]/5 flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40">Total</span>
                  <span className="text-xl font-serif font-bold">₹{order.total}</span>
                </div>
              </div>

              <div className="md:w-64 flex flex-col gap-2 justify-center">
                {order.status === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(order.id, 'accepted')} className="w-full bg-[#5A5A40] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#4A4A30] transition-all">Accept Order</button>
                    <button onClick={() => updateStatus(order.id, 'rejected')} className="w-full border border-red-200 text-red-600 py-3 rounded-xl font-bold text-sm hover:bg-red-50 transition-all">Reject</button>
                  </>
                )}
                {order.status === 'accepted' && (
                  <button onClick={() => updateStatus(order.id, 'ready')} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all">Mark as Ready</button>
                )}
                {order.status === 'ready' && (
                  <button onClick={() => updateStatus(order.id, 'out_for_delivery')} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all">Out for Delivery</button>
                )}
                {order.status === 'out_for_delivery' && (
                  <button onClick={() => updateStatus(order.id, 'delivered')} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-all">Mark Delivered</button>
                )}
                {order.status === 'delivered' && (
                  <div className="text-center py-3 bg-green-50 text-green-700 rounded-xl flex items-center justify-center gap-2">
                    <CheckCircle2 size={16} /> <span className="text-sm font-bold uppercase tracking-widest">Completed</span>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center bg-white border border-[#1A1A1A]/10 rounded-3xl">
            <p className="text-[#1A1A1A]/30 italic">No orders received yet.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6">
      <div className="text-[#5A5A40] mb-4">{icon}</div>
      <p className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">{label}</p>
      <p className="text-3xl font-serif font-bold">{value}</p>
    </div>
  );
}

function ActionButton({ icon, label, color, textColor = "text-white", onClick }: { icon: React.ReactNode, label: string, color: string, textColor?: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`${color} ${textColor} p-4 rounded-2xl flex flex-col items-center gap-2 hover:opacity-90 transition-all shadow-sm`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

function ShopRegistrationForm({ userId, onClose }: { userId: string, onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    category: 'Grocery',
    timings: '9 AM - 9 PM',
    locationName: LOCATIONS[0]
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (!formData.locationName) {
      alert("Please select a location for your shop.");
      setSubmitting(false);
      return;
    }
    try {
      const shopData: Omit<Shop, 'id'> = {
        ownerId: userId,
        name: formData.name,
        address: formData.address,
        category: formData.category,
        status: 'pending',
        timings: formData.timings,
        locationName: formData.locationName,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'shops'), shopData);
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
      >
        <h3 className="font-serif text-2xl font-bold mb-6">Shop Details</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Shop Name</label>
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/20"
              placeholder="e.g. Sharma Kirana Store"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Address</label>
            <textarea 
              required
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/20 min-h-[100px]"
              placeholder="Full shop address..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Location</label>
              <select 
                value={formData.locationName}
                onChange={(e) => setFormData({...formData, locationName: e.target.value})}
                className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
              >
                {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Category</label>
              <select 
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
              >
                <option>Grocery</option>
                <option>Dairy</option>
                <option>General Store</option>
                <option>Snacks</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Timings</label>
            <input 
              type="text" 
              value={formData.timings}
              onChange={(e) => setFormData({...formData, timings: e.target.value})}
              className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
              placeholder="9 AM - 9 PM"
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 p-4 rounded-2xl font-bold text-[#1A1A1A]/40 hover:bg-[#F5F5F0] transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[#5A5A40] text-white p-4 rounded-2xl font-bold hover:bg-[#4A4A30] transition-all disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Submit'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// --- Admin Panel ---

function AdminPanel({ user, profile }: { user: FirebaseUser, profile: UserProfile }) {
  const [pendingShops, setPendingShops] = useState<Shop[]>([]);
  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'users'>('pending');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const qPending = query(collection(db, 'shops'), where('status', '==', 'pending'));
    const qAll = query(collection(db, 'shops'));
    
    const unsubPending = onSnapshot(qPending, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
      setPendingShops(list);
      setLoading(false);
    }, (error: any) => {
      console.error("Pending shops error:", error.code, error.message);
      setLoading(false);
      if (error.code === 'permission-denied' || error.message.toLowerCase().includes('permission')) {
        alert(`DATABASE ERROR: Your account (${user.email}) is being blocked by Firestore Security Rules.\n\nCode: ${error.code}\nMessage: ${error.message}`);
      }
    });

    const unsubAll = onSnapshot(qAll, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
      setAllShops(list);
    }, (error: any) => {
      console.error("All shops error:", error.code, error.message);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(list);
    }, (error: any) => {
      console.error("Users error:", error.code, error.message);
    });

    return () => {
      unsubPending();
      unsubAll();
      unsubUsers();
    };
  }, []);

  const handleApprove = async (shopId: string) => {
    try {
      await updateDoc(doc(db, 'shops', shopId), { status: 'approved' });
      setStatusMessage({ type: 'success', text: "Shop approved successfully." });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleReject = async (shopId: string) => {
    try {
      await updateDoc(doc(db, 'shops', shopId), { status: 'suspended' });
      setStatusMessage({ type: 'success', text: "Shop suspended." });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleUpdateLocation = async (shopId: string, locationName: string) => {
    try {
      await updateDoc(doc(db, 'shops', shopId), { locationName });
      setStatusMessage({ type: 'success', text: "Shop location updated." });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      setDeletingUser(null);
      setStatusMessage({ type: 'success', text: "User profile deleted successfully." });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role });
      setStatusMessage({ type: 'success', text: `User role updated to ${role}.` });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleApproveAll = async () => {
    try {
      const batchPromises = pendingShops.map(shop => 
        updateDoc(doc(db, 'shops', shop.id), { status: 'approved' })
      );
      await Promise.all(batchPromises);
      setStatusMessage({ type: 'success', text: "All pending shops approved!" });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="font-serif text-3xl font-bold">Admin Dashboard</h2>
        </div>
        <div className="flex gap-3">
          {statusMessage && (
            <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
              statusMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {statusMessage.text}
            </div>
          )}
          <button 
            onClick={handleApproveAll}
            className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all flex items-center gap-2"
          >
            <CheckCircle2 size={16} /> Approve All Pending
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="p-3 bg-[#F5F5F0] text-[#1A1A1A]/60 rounded-2xl hover:bg-[#E5E5E0] transition-all"
            title="Refresh Dashboard"
          >
            <Clock size={20} />
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-[#1A1A1A]/10">
        <button 
          onClick={() => setActiveTab('pending')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'pending' ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/40'}`}
        >
          Pending Approvals ({pendingShops.length})
          {activeTab === 'pending' && <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
        </button>
        <button 
          onClick={() => setActiveTab('all')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'all' ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/40'}`}
        >
          All Shops ({allShops.length})
          {activeTab === 'all' && <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'users' ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/40'}`}
        >
          Users ({users.length})
          {activeTab === 'users' && <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
        </button>
      </div>
      
      <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl overflow-hidden shadow-sm">
        <div className="divide-y divide-[#1A1A1A]/5">
          {loading ? (
            <div className="p-20 text-center text-[#1A1A1A]/40">
              <div className="animate-spin w-8 h-8 border-2 border-[#5A5A40] border-t-transparent rounded-full mx-auto mb-4"></div>
              Loading data...
            </div>
          ) : activeTab === 'users' ? (
            <div className="p-6">
              <div className="mb-6 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" size={16} />
                <input 
                  type="text" 
                  placeholder="Search users by email or name..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-2 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/10 transition-all text-sm"
                />
              </div>
              <div className="space-y-4">
                {users.filter(u => 
                  u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
                  u.displayName?.toLowerCase().includes(userSearch.toLowerCase())
                ).map(u => (
                  <div key={u.uid} className="flex items-center justify-between p-4 bg-[#F5F5F0]/30 rounded-2xl border border-[#1A1A1A]/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {u.displayName?.[0] || 'U'}
                      </div>
                      <div>
                        <h5 className="font-bold text-sm">{u.displayName}</h5>
                        <p className="text-xs text-[#1A1A1A]/40">{u.email}</p>
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
                    <div className="flex gap-2">
                      <select 
                        value={u.role}
                        onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as UserRole)}
                        className="text-[10px] font-bold uppercase tracking-widest bg-white border border-[#1A1A1A]/10 px-2 py-1 rounded focus:outline-none"
                      >
                        <option value="customer">Customer</option>
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                      </select>
                      {deletingUser === u.uid ? (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleDeleteUser(u.uid)}
                            className="px-3 py-1 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button 
                            onClick={() => setDeletingUser(null)}
                            className="px-3 py-1 bg-[#F5F5F0] text-[#1A1A1A]/60 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-[#E5E5E0]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeletingUser(u.uid)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete User Profile"
                        >
                          <XCircle size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'pending' ? (
            pendingShops.length > 0 ? (
              pendingShops.map((shop) => (
                <div key={shop.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F5F5F0]/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#F5F5F0] rounded-2xl flex items-center justify-center text-[#5A5A40]">
                      {shop.logo ? <img src={shop.logo} className="w-full h-full object-cover rounded-2xl" /> : <Store size={24} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{shop.name}</h4>
                      <p className="text-sm text-[#1A1A1A]/60">{shop.address}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-[#F5F5F0] px-2 py-1 rounded text-[#5A5A40]">{shop.category}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-[#F5F5F0] px-2 py-1 rounded text-[#1A1A1A]/40">{shop.timings}</span>
                        <select 
                          value={shop.locationName || ''}
                          onChange={(e) => handleUpdateLocation(shop.id, e.target.value)}
                          className="text-[10px] font-bold uppercase tracking-widest bg-[#5A5A40]/10 px-2 py-1 rounded text-[#5A5A40] focus:outline-none border-none cursor-pointer"
                        >
                          <option value="">Select Location</option>
                          {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleReject(shop.id)}
                      className="flex-1 sm:flex-none px-6 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                    <button 
                      onClick={() => handleApprove(shop.id)}
                      className="flex-1 sm:flex-none px-6 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-green-600/20"
                    >
                      <CheckCircle2 size={16} /> Approve
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-20 text-center">
                <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <p className="text-[#1A1A1A]/60 font-medium">All caught up!</p>
                <p className="text-[#1A1A1A]/30 text-sm italic mt-1">No pending shop registrations.</p>
                {allShops.length === 0 && (
                  <p className="text-red-500 text-xs mt-4 font-bold">
                    Warning: No shops found in the database. This might be a permission issue.
                  </p>
                )}
              </div>
            )
          ) : (
            allShops.length > 0 ? (
              allShops.map((shop) => (
                <div key={shop.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F5F5F0]/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#F5F5F0] rounded-2xl flex items-center justify-center text-[#5A5A40]">
                      {shop.logo ? <img src={shop.logo} className="w-full h-full object-cover rounded-2xl" /> : <Store size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-lg">{shop.name}</h4>
                        <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                          shop.status === 'approved' ? 'bg-green-100 text-green-700' : 
                          shop.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                          'bg-red-100 text-red-700'
                        }`}>
                          {shop.status}
                        </span>
                      </div>
                      <p className="text-sm text-[#1A1A1A]/60">{shop.address}</p>
                      <div className="mt-2">
                        <select 
                          value={shop.locationName || ''}
                          onChange={(e) => handleUpdateLocation(shop.id, e.target.value)}
                          className="text-[10px] font-bold uppercase tracking-widest bg-[#5A5A40]/10 px-2 py-1 rounded text-[#5A5A40] focus:outline-none border-none cursor-pointer"
                        >
                          <option value="">Set Location</option>
                          {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {shop.status !== 'approved' && (
                      <button 
                        onClick={() => handleApprove(shop.id)}
                        className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition-all"
                        title="Approve"
                      >
                        <CheckCircle2 size={20} />
                      </button>
                    )}
                    {shop.status !== 'suspended' && (
                      <button 
                        onClick={() => handleReject(shop.id)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all"
                        title="Suspend"
                      >
                        <XCircle size={20} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-20 text-center text-[#1A1A1A]/30 italic">
                No shops registered on the platform.
                <p className="text-red-500 text-xs mt-4 font-bold not-italic">
                  Warning: No shops found. This might be a permission issue if you know shops exist.
                </p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Diagnostics */}
      {profile?.role === 'admin' && (
        <div className="mt-12 p-6 bg-amber-50 rounded-3xl border border-amber-200">
          <h3 className="font-bold text-amber-800 mb-4 flex items-center gap-2">
            <AlertCircle size={20} /> System Diagnostics (Admin Only)
          </h3>
          <div className="space-y-2 text-xs font-mono text-amber-700">
            <p>Total Shops in DB: {allShops.length}</p>
            <p>Approved Shops: {allShops.filter(s => s.status === 'approved').length}</p>
            <p>Pending Shops: {allShops.filter(s => s.status === 'pending').length}</p>
            <div className="mt-4 max-h-40 overflow-auto bg-white/50 p-2 rounded">
              {allShops.map(s => (
                <div key={s.id} className="border-b border-amber-200/50 py-1">
                  {s.name} | Status: {s.status} | Loc: {s.locationName || 'NONE'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileView({ user, profile, onLogout }: { user: FirebaseUser, profile: UserProfile, onLogout: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-8 max-w-2xl mx-auto"
    >
      <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-8 shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-[#5A5A40] rounded-full flex items-center justify-center text-white text-4xl font-serif mb-4 overflow-hidden">
            {user.photoURL ? <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" /> : user.displayName?.[0]}
          </div>
          <h2 className="font-serif text-3xl font-bold">{user.displayName}</h2>
          <p className="text-[#5A5A40] font-bold uppercase tracking-widest text-xs mt-1">{profile.role}</p>
        </div>

        <div className="space-y-6">
          {profile.role === 'admin' && (
            <button 
              onClick={() => window.location.reload()} // Simple way to reset view to dashboard
              className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/20"
            >
              <BarChart3 size={20} /> Admin Dashboard
            </button>
          )}
          <div className="flex justify-between items-center py-4 border-b border-[#1A1A1A]/5">
            <span className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A]/40">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between items-center py-4 border-b border-[#1A1A1A]/5">
            <span className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A]/40">Joined</span>
            <span className="font-medium">{new Date(profile.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between items-center py-4 border-b border-[#1A1A1A]/5">
            <span className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A]/40">Account ID</span>
            <span className="font-mono text-xs text-[#1A1A1A]/60">{user.uid}</span>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="w-full mt-12 bg-red-50 text-red-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all"
        >
          <LogOut size={20} /> Sign Out
        </button>
      </div>
    </motion.div>
  );
}

function GlobalCartView({ userId, cart, onUpdateQuantity, onRemove, onClear, onBack }: { 
  userId: string, 
  cart: {product: Product, quantity: number, shopId: string}[],
  onUpdateQuantity: (id: string, d: number) => void,
  onRemove: (id: string) => void,
  onClear: () => void,
  onBack: () => void
}) {
  const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleCheckout = async () => {
    alert("Checkout functionality for multiple shops is coming soon! Please order from individual shop pages for now.");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-4 sm:p-8 max-w-2xl mx-auto"
    >
      <div className="flex justify-between items-center mb-8">
        <h2 className="font-serif text-3xl font-bold">Your Cart</h2>
        {cart.length > 0 && (
          <button onClick={onClear} className="text-xs font-bold text-red-500 uppercase tracking-widest">Clear All</button>
        )}
      </div>

      <div className="space-y-6 mb-12">
        {cart.length > 0 ? (
          cart.map((item) => (
            <div key={item.product.id} className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 flex gap-4">
              <div className="w-16 h-16 bg-[#F5F5F0] rounded-2xl overflow-hidden flex-shrink-0">
                {item.product.image ? <img src={item.product.image} className="w-full h-full object-cover" /> : <Package size={24} className="m-auto text-[#5A5A40]/20 mt-4" />}
              </div>
              <div className="flex-1">
                <h4 className="font-bold">{item.product.name}</h4>
                <p className="text-xs text-[#1A1A1A]/40 mb-2">₹{item.product.price} / {item.product.unit}</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-[#1A1A1A]/10 rounded-full px-2 py-1">
                    <button onClick={() => onUpdateQuantity(item.product.id, -1)} className="p-1 hover:bg-[#F5F5F0] rounded-full"><Plus size={14} className="rotate-45" /></button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => onUpdateQuantity(item.product.id, 1)} className="p-1 hover:bg-[#F5F5F0] rounded-full"><Plus size={14} /></button>
                  </div>
                  <button onClick={() => onRemove(item.product.id)} className="text-xs font-bold text-red-500 uppercase tracking-widest">Remove</button>
                </div>
              </div>
              <div className="text-right font-bold">
                ₹{item.product.price * item.quantity}
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center bg-white border border-[#1A1A1A]/10 rounded-3xl">
            <p className="text-[#1A1A1A]/30 italic mb-6">Your cart is empty.</p>
            <button 
              onClick={onBack}
              className="bg-[#5A5A40] text-white px-6 py-3 rounded-xl font-bold text-sm"
            >
              Start Shopping
            </button>
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-8 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[#1A1A1A]/40 font-bold uppercase tracking-widest">Total Amount</span>
            <span className="text-3xl font-serif font-bold">₹{total}</span>
          </div>
          <button 
            onClick={handleCheckout}
            className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold text-lg hover:bg-[#4A4A30] transition-all shadow-lg flex items-center justify-center gap-3"
          >
            Proceed to Checkout <ChevronRight size={20} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
