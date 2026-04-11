import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  updateProfile,
  sendPasswordResetEmail,
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
  getDocFromServer,
  Timestamp,
  orderBy,
  increment
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Shop, Product, Order, Category, UserRole, Review, Supplier, PurchaseOrder, ProductDiscount, OrderDiscount } from './types';
import { 
  Store, 
  Image,
  ShoppingBag, 
  User as UserIcon, 
  LogOut, 
  Plus, 
  Package, 
  ClipboardList, 
  BarChart3, 
  Search, 
  Filter,
  MapPin, 
  Clock, 
  Phone, 
  MessageCircle,
  CheckCircle2,
  XCircle,
  Truck,
  ShoppingCart,
  ArrowLeft,
  Settings,
  AlertCircle,
  X,
  Camera,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Receipt,
  RefreshCw,
  Percent,
  CreditCard,
  Calendar,
  Star,
  Save,
  Trash2,
  AlertTriangle,
  Lock,
  PieChart,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ALL_CATEGORIES = [
  'Grocery', 
  'Dairy', 
  'Vegetables & Fruits', 
  'Meat', 
  'Bakery & Snacks', 
  'Beverages', 
  'Household', 
  'Personal Care',
  'General Store',
  'Snacks'
];

// --- Helpers ---

const isOfferValid = (validTill?: string | null) => {
  if (!validTill) return true;
  return new Date(validTill) > new Date();
};

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();

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

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || 'NOT_LOGGED_IN',
      email: currentUser?.email || 'NO_EMAIL',
      emailVerified: currentUser?.emailVerified || false,
      isAnonymous: currentUser?.isAnonymous || false,
      tenantId: currentUser?.tenantId || null,
      providerInfo: currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Details:', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}

const ErrorBoundary = ({ error, onClose }: { error: string, onClose: () => void }) => {
  let displayError = error;
  try {
    const parsed = JSON.parse(error);
    if (parsed.error && parsed.operationType) {
      displayError = `[${parsed.operationType.toUpperCase()}] ${parsed.path || ''}: ${parsed.error}`;
    }
  } catch (e) {
    // Not JSON, use as is
  }
  
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg m-4 relative group">
      <button 
        onClick={onClose}
        className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 transition-colors"
        title="Dismiss error"
      >
        <X size={16} />
      </button>
      <div className="flex items-center gap-2 text-red-700 mb-2">
        <AlertCircle size={20} />
        <h3 className="font-bold">Something went wrong</h3>
      </div>
      <p className="text-sm text-red-600 font-mono break-all">{displayError}</p>
    </div>
  );
};

const DropdownItem = ({ 
  icon, 
  label, 
  sublabel, 
  onClick, 
  variant = 'default' 
}: { 
  icon: React.ReactNode, 
  label: string, 
  sublabel?: string, 
  onClick: () => void, 
  variant?: 'default' | 'danger' 
}) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#F5F5F0] ${
      variant === 'danger' ? 'text-red-600' : 'text-[#1A1A1A]'
    }`}
  >
    <div className={`${variant === 'danger' ? 'text-red-500' : 'text-[#5A5A40]'} shrink-0`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold truncate">{label}</p>
      {sublabel && <p className="text-[10px] text-[#1A1A1A]/40 truncate">{sublabel}</p>}
    </div>
    <ChevronRight size={14} className="text-[#1A1A1A]/20" />
  </button>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'marketplace' | 'owner' | 'admin' | 'role-selection' | 'profile' | 'cart' | 'orders'>('marketplace');
  const [ownerInitialTab, setOwnerInitialTab] = useState<'stats' | 'inventory' | 'orders' | 'billing' | 'reports' | 'settings'>('stats');
  const [resetKey, setResetKey] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [cart, setCart] = useState<{product: Product, quantity: number, shopId: string}[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const detectUserLocation = () => {
    setIsDetecting(true);
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setIsDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setSelectedLocation('Near Me');
        setIsDetecting(false);
      },
      (error) => {
        alert("Unable to retrieve your location: " + error.message);
        setIsDetecting(false);
      }
    );
  };

  useEffect(() => {
    const q = query(collection(db, 'shops'), where('status', '==', 'approved'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const locs = new Set<string>();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.locationName) locs.add(data.locationName);
      });
      setAvailableLocations(Array.from(locs).sort());
    });
    return () => unsubscribe();
  }, []);
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

  const updateCartQuantity = (productId: string, delta: number, absoluteValue?: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        let newQty;
        if (absoluteValue !== undefined) {
          newQty = Math.max(0.01, absoluteValue);
        } else {
          // If it's weight based, we might want smaller increments, 
          // but for now let's stick to 1 for simplicity unless it's already a decimal
          const isWeightBased = ['kg', 'gram', 'L', 'ml'].includes(item.product.unit.toLowerCase());
          const step = isWeightBased && (item.quantity % 1 !== 0 || delta % 1 !== 0) ? delta : Math.round(delta);
          newQty = Math.max(isWeightBased ? 0.01 : 1, item.quantity + step);
        }
        // Round to 2 decimal places to avoid floating point issues
        return { ...item, quantity: Math.round(newQty * 100) / 100 };
      }
      return item;
    }));
  };

  const clearCart = () => setCart([]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setError(null); // Clear any previous auth errors on success
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
            } else {
              setProfile(data);
              // Set initial view based on role
              if (data.role === 'owner') setView('owner');
              else if (data.role === 'admin') setView('admin');
              else setView('marketplace');
            }
          } else {
            // Check if this is the default admin
            if (firebaseUser.email === 'senamallas@gmail.com') {
              const adminProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                role: 'admin',
                displayName: firebaseUser.displayName || 'Admin',
                photoURL: firebaseUser.photoURL || null,
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
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    setError(null);
    try {
      await signOut(auth);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRoleSelect = async (role: UserRole) => {
    if (!user) return;
    setError(null);
    try {
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email!,
        role,
        displayName: user.displayName || 'User',
        photoURL: user.photoURL || null,
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
      <header className="sticky top-0 z-[100] bg-white/80 backdrop-blur-md border-b border-[#1A1A1A]/5 px-4 sm:px-8 pt-2 pb-1 md:py-3">
        <div className="max-w-7xl mx-auto flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          {/* Top Row: Logo & Actions (Mobile) / Logo (Desktop) */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <div 
              className="flex items-center gap-2 cursor-pointer group relative z-[120]"
              onClick={() => {
                setResetKey(prev => prev + 1);
                setSearchTerm('');
                setOwnerInitialTab('stats');
                setIsDropdownOpen(false);
                window.scrollTo(0, 0);
                setError(null);
                if (profile?.role === 'admin') setView('admin');
                else if (profile?.role === 'owner') setView('owner');
                else setView('marketplace');
              }}
            >
              <div className="w-8 h-8 bg-[#5A5A40] rounded-lg flex items-center justify-center text-white shadow-lg shadow-[#5A5A40]/20 group-hover:scale-105 transition-transform">
                <Store size={18} />
              </div>
              <h1 className="font-serif text-lg sm:text-xl font-bold tracking-tight text-[#1A1A1A]">HyperMart</h1>
            </div>

            {/* Mobile Actions (Hidden on Desktop) */}
            <div className="md:hidden flex items-center gap-2">
              {/* Location Selector (Mobile) */}
              <div className="flex items-center gap-1 px-2 py-1.5 bg-[#F5F5F0] rounded-full text-[#5A5A40] border border-[#1A1A1A]/5">
                <MapPin size={14} />
                <select 
                  value={selectedLocation}
                  onChange={(e) => {
                    if (e.target.value === 'Near Me') detectUserLocation();
                    else setSelectedLocation(e.target.value);
                  }}
                  className="appearance-none bg-transparent text-[10px] font-bold uppercase tracking-widest focus:outline-none cursor-pointer max-w-[70px] truncate"
                >
                  <option value="All Locations">All Locations</option>
                  <option value="Near Me">{isDetecting ? 'Detecting...' : 'Near Me (GPS)'}</option>
                  {availableLocations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {user ? (
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-8 h-8 rounded-full border-2 border-white shadow-sm overflow-hidden"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-[#FF6321] flex items-center justify-center text-white font-bold text-xs">
                      {(user.displayName || 'U')[0].toUpperCase()}
                    </div>
                  )}
                </button>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="bg-[#5A5A40] text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
                >
                  Login
                </button>
              )}
            </div>
          </div>

          {/* Search Bar (Center on Desktop, Full Width on Mobile) */}
          {view === 'marketplace' && (
            <div className="flex-1 max-w-xl relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" size={16} />
              <input 
                type="text" 
                placeholder="Search for shops or categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2 bg-[#F5F5F0] rounded-xl focus:outline-none focus:ring-2 ring-[#5A5A40]/10 transition-all text-sm border border-transparent focus:border-[#5A5A40]/20"
              />
            </div>
          )}

          {/* Desktop Actions (Hidden on Mobile) */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#F5F5F0] rounded-full text-[#5A5A40] border border-[#1A1A1A]/5 hover:bg-[#E5E5E0] transition-all group cursor-pointer relative">
              <MapPin size={16} className="group-hover:scale-110 transition-transform" />
              <div className="relative flex items-center">
                <select 
                  value={selectedLocation}
                  onChange={(e) => {
                    if (e.target.value === 'Near Me') detectUserLocation();
                    else setSelectedLocation(e.target.value);
                  }}
                  className="appearance-none bg-transparent pr-6 text-xs font-bold uppercase tracking-widest focus:outline-none cursor-pointer z-10"
                >
                  <option value="All Locations">All Locations</option>
                  <option value="Near Me">{isDetecting ? 'Detecting...' : 'Near Me (GPS)'}</option>
                  {availableLocations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                  <option value="Unknown">Unknown</option>
                </select>
                <ChevronDown size={14} className="absolute right-0 pointer-events-none" />
              </div>
            </div>

            {user ? (
              <div className="relative">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none"
                >
                  <div className="text-right mr-1">
                    <p className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-widest leading-none mb-1">{profile?.role}</p>
                    <p className="text-xs font-bold truncate max-w-[100px] leading-none">{user.displayName || 'User'}</p>
                  </div>
                  <div className="w-10 h-10 bg-[#FF6321] rounded-full flex items-center justify-center text-white font-bold text-lg border-2 border-white shadow-sm overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span>{(user.displayName || 'U')[0].toUpperCase()}</span>
                    )}
                  </div>
                  <ChevronDown size={16} className={`text-[#1A1A1A]/40 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="bg-[#5A5A40] text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-[#4A4A30] transition-colors shadow-lg shadow-[#5A5A40]/20"
              >
                Login
              </button>
            )}
          </div>

          {/* Dropdown Menu (Universal for Mobile & Desktop) */}
          <AnimatePresence>
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-[110]" onClick={() => setIsDropdownOpen(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-4 md:right-8 top-full mt-2 w-64 bg-white border border-[#1A1A1A]/10 rounded-2xl shadow-2xl z-[120] overflow-hidden"
                >
                  <div className="p-4 border-b border-[#1A1A1A]/5 bg-[#F5F5F0]/30">
                    <p className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-widest mb-1">Signed in as</p>
                    <p className="text-sm font-bold text-[#1A1A1A] truncate">{user?.email}</p>
                  </div>
                  
                  <div className="py-2">
                    <DropdownItem 
                      icon={<Store size={16} />} 
                      label="Home" 
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setResetKey(prev => prev + 1);
                        setOwnerInitialTab('stats');
                        if (profile?.role === 'admin') setView('admin');
                        else if (profile?.role === 'owner') setView('owner');
                        else setView('marketplace');
                      }} 
                    />
                    <DropdownItem 
                      icon={<UserIcon size={16} />} 
                      label="My Profile" 
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setView('profile');
                      }} 
                    />

                    {profile?.role === 'customer' && (
                      <DropdownItem 
                        icon={<Truck size={16} />} 
                        label="My Orders" 
                        onClick={() => {
                          setIsDropdownOpen(false);
                          setView('orders');
                        }} 
                      />
                    )}
                    
                    {profile?.role === 'owner' && (
                      <DropdownItem 
                        icon={<Settings size={16} />} 
                        label="Shop Settings" 
                        onClick={() => {
                          setIsDropdownOpen(false);
                          setOwnerInitialTab('settings');
                          setView('owner');
                        }} 
                      />
                    )}
                    
                    <div className="border-t border-[#1A1A1A]/5 my-1" />
                    <DropdownItem 
                      icon={<LogOut size={16} />} 
                      label="Sign out" 
                      variant="danger"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleLogout();
                      }} 
                    />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="pb-20">
        {error && <ErrorBoundary error={error} onClose={() => setError(null)} />}

        <AnimatePresence mode="wait">
          {view === 'role-selection' && (
            <RoleSelection onSelect={handleRoleSelect} />
          )}
          {view === 'marketplace' && (
            <div key={`marketplace-${resetKey}`}>
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
                userCoords={userCoords}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
              />
            </div>
          )}
          {view === 'owner' && profile?.role === 'owner' && (
            <div key={`owner-${resetKey}`}>
              <OwnerDashboard 
                user={user} 
                profile={profile} 
                initialTab={ownerInitialTab} 
                onTabChange={(tab) => setOwnerInitialTab(tab)}
              />
            </div>
          )}
          {view === 'admin' && profile?.role === 'admin' && (
            <div key={`admin-${resetKey}`}>
              <AdminPanel user={user} profile={profile} />
            </div>
          )}
          {view === 'profile' && user && profile && (
            <ProfileView user={user} profile={profile} onLogout={handleLogout} onUpdateProfile={setProfile} />
          )}
          {view === 'orders' && user && (
            <CustomerOrdersView userId={user.uid} onBack={() => setView('marketplace')} />
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
              <NavButton 
                active={view === 'owner' && ownerInitialTab === 'stats'} 
                onClick={() => {
                  setView('owner');
                  setOwnerInitialTab('stats');
                }} 
                icon={<BarChart3 size={20} />} 
                label="Stats" 
              />
              <NavButton 
                active={view === 'owner' && ownerInitialTab === 'inventory'} 
                onClick={() => {
                  setView('owner');
                  setOwnerInitialTab('inventory');
                }} 
                icon={<Package size={20} />} 
                label="Stock" 
              />
              <NavButton 
                active={view === 'owner' && ownerInitialTab === 'orders'} 
                onClick={() => {
                  setView('owner');
                  setOwnerInitialTab('orders');
                }} 
                icon={<ClipboardList size={20} />} 
                label="Orders" 
              />
              <NavButton 
                active={view === 'owner' && ownerInitialTab === 'billing'} 
                onClick={() => {
                  setView('owner');
                  setOwnerInitialTab('billing');
                }} 
                icon={<Receipt size={20} />} 
                label="Billing" 
              />
            </>
          ) : (
            <>
              <NavButton active={view === 'marketplace'} onClick={() => setView('marketplace')} icon={<ShoppingBag size={20} />} label="Shop" />
              <NavButton active={view === 'orders'} onClick={() => setView('orders')} icon={<Truck size={20} />} label="Orders" />
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

// --- Reviews ---

function ReviewSection({ shopId, user, currentRating, reviewCount }: { shopId: string, user: FirebaseUser | null, currentRating: number, reviewCount: number }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'reviews'), where('shopId', '==', shopId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setReviews(list);
      setLoading(false);
    }, (error: any) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'reviews');
      }
    });
    return () => unsubscribe();
  }, [shopId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const reviewData: Omit<Review, 'id'> = {
        shopId,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userPhoto: user.photoURL || undefined,
        rating,
        comment,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'reviews'), reviewData);
      
      // Update shop rating
      const newReviewCount = reviewCount + 1;
      const newRating = ((currentRating * reviewCount) + rating) / newReviewCount;
      
      await updateDoc(doc(db, 'shops', shopId), {
        rating: newRating,
        reviewCount: newReviewCount
      });

      setComment('');
      setRating(5);
      setShowForm(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-12 border-t border-[#1A1A1A]/5 pt-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="font-serif text-2xl font-bold mb-1">Customer Reviews</h3>
          <p className="text-xs text-[#1A1A1A]/40 font-bold uppercase tracking-widest">What people are saying about this shop</p>
        </div>
        {user && !showForm && (
          <button 
            onClick={() => setShowForm(true)}
            className="bg-[#5A5A40] text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/10 w-full sm:w-auto"
          >
            Write a Review
          </button>
        )}
      </div>

      {showForm && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 mb-12 shadow-sm"
        >
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-[10px] font-bold text-[#1A1A1A]/40 uppercase tracking-widest mb-3">Your Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`p-2 rounded-xl transition-all ${rating >= star ? 'text-amber-400 bg-amber-50' : 'text-gray-300 bg-gray-50'}`}
                  >
                    <Star size={24} fill={rating >= star ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-[10px] font-bold text-[#1A1A1A]/40 uppercase tracking-widest mb-3">Your Comment</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
                placeholder="Share your experience..."
                className="w-full bg-[#F5F5F0] border-none rounded-2xl p-4 text-sm focus:ring-2 ring-[#5A5A40]/10 outline-none min-h-[120px] resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-[#5A5A40] text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Post Review'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-100 text-gray-600 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="space-y-6">
        {loading ? (
          <p className="text-center py-12 text-[#1A1A1A]/30 italic">Loading reviews...</p>
        ) : reviews.length > 0 ? (
          reviews.map((review) => (
            <motion.div 
              key={review.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white border border-[#1A1A1A]/5 rounded-3xl p-6 shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FF6321] rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow-sm overflow-hidden">
                    {review.userPhoto ? (
                      <img src={review.userPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span>{review.userName[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{review.userName}</h4>
                    <p className="text-[10px] text-[#1A1A1A]/40 font-bold uppercase tracking-widest">{new Date(review.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={12} fill={i < review.rating ? "currentColor" : "none"} />
                  ))}
                </div>
              </div>
              <p className="text-sm text-[#1A1A1A]/70 leading-relaxed italic">"{review.comment}"</p>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-20 bg-white border border-dashed border-[#1A1A1A]/10 rounded-[3rem]">
            <div className="w-16 h-16 bg-[#F5F5F0] rounded-full flex items-center justify-center mx-auto mb-4 text-[#5A5A40]/20">
              <MessageCircle size={32} />
            </div>
            <p className="text-[#1A1A1A]/30 italic">No reviews yet. Be the first to share your experience!</p>
          </div>
        )}
      </div>
    </div>
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
  userCoords,
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
  userCoords: {lat: number, lng: number} | null,
  searchTerm: string,
  setSearchTerm: (s: string) => void
}) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'shops'), where('status', '==', 'approved'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shopList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
      setShops(shopList);
      setLoading(false);
    }, (error: any) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'shops (marketplace)');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (error) return <ErrorBoundary error={error} onClose={() => setError(null)} />;

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

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  const filteredShops = shops.filter(shop => {
    const matchesSearch = shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         shop.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    // If 'Near Me' is selected and we have user coordinates
    if (selectedLocation === 'Near Me' && userCoords) {
      if (!shop.location?.lat || !shop.location?.lng) return false;
      const distance = calculateDistance(userCoords.lat, userCoords.lng, shop.location.lat, shop.location.lng);
      return matchesSearch && distance <= (shop.deliveryRadius || 3);
    }

    // If 'All Locations' is selected, show everything that matches search
    if (selectedLocation === 'All Locations' || selectedLocation === 'Unknown') return matchesSearch;

    return matchesSearch && shop.locationName === selectedLocation;
  });

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
      <div className="sticky top-[88px] md:top-[64px] z-40 bg-white border-b border-[#1A1A1A]/5">
        <div className="max-w-7xl mx-auto px-4 pt-1 pb-3">
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
      <div className="max-w-7xl mx-auto p-4 sm:px-8 sm:py-4 space-y-6">
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

            // Hide empty categories unless searching
            if (categoryShops.length === 0 && !searchTerm) {
              return null;
            }

            return (
              <div key={category} className="space-y-3">
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
                
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
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
                  {Array.from(new Set(shops.filter(s => s.locationName).map((s: any) => s.locationName))).map((loc: any) => (
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

    </motion.div>
  );
}

function OrderTracker({ status }: { status: Order['status'] }) {
  const steps = [
    { id: 'pending', label: 'Ordered', icon: <ClipboardList size={16} /> },
    { id: 'accepted', label: 'Accepted', icon: <CheckCircle2 size={16} /> },
    { id: 'ready', label: 'Ready', icon: <Package size={16} /> },
    { id: 'out_for_delivery', label: 'On the Way', icon: <Truck size={16} /> },
    { id: 'delivered', label: 'Delivered', icon: <Sparkles size={16} /> },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === status);
  const isRejected = status === 'rejected';

  if (isRejected) {
    return (
      <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-xl border border-red-100">
        <XCircle size={18} />
        <span className="text-sm font-bold uppercase tracking-widest">Order Rejected</span>
      </div>
    );
  }

  return (
    <div className="w-full py-6">
      <div className="relative flex justify-between">
        {/* Progress Line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#1A1A1A]/5 -translate-y-1/2 z-0" />
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
          className="absolute top-1/2 left-0 h-0.5 bg-[#5A5A40] -translate-y-1/2 z-0"
        />

        {steps.map((step, index) => {
          const isActive = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isActive ? 'bg-[#5A5A40] text-white shadow-lg shadow-[#5A5A40]/20' : 'bg-white text-[#1A1A1A]/20 border border-[#1A1A1A]/10'
              } ${isCurrent ? 'ring-4 ring-[#5A5A40]/10 scale-110' : ''}`}>
                {step.icon}
              </div>
              <span className={`text-[8px] font-bold uppercase tracking-widest transition-colors ${
                isActive ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/20'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomerOrdersView({ userId, onBack }: { userId: string, onBack: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopDetails, setShopDetails] = useState<Record<string, {name: string, address: string}>>({});
  const [trackingOrders, setTrackingOrders] = useState<Set<string>>(new Set());

  const toggleTracking = (orderId: string) => {
    setTrackingOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  useEffect(() => {
    const q = query(collection(db, 'orders'), where('customerId', '==', userId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(list);
      setLoading(false);

      // Fetch shop details for orders that don't have them
      const missingShopIds = Array.from(new Set(list.filter(o => !o.shopName).map(o => o.shopId)));
      if (missingShopIds.length > 0) {
        const details: Record<string, {name: string, address: string}> = {};
        for (const id of missingShopIds) {
          if (!shopDetails[id]) {
            try {
              const shopDoc = await getDoc(doc(db, 'shops', id));
              if (shopDoc.exists()) {
                const data = shopDoc.data();
                details[id] = { name: data.name, address: data.address };
              }
            } catch (e) {
              console.error("Error fetching shop details", e);
            }
          }
        }
        if (Object.keys(details).length > 0) {
          setShopDetails(prev => ({ ...prev, ...details }));
        }
      }
    }, (error: any) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'orders (customer)');
      }
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

      <div className="space-y-6">
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin w-10 h-10 border-4 border-[#5A5A40] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-[#1A1A1A]/40 font-serif italic">Fetching your orders...</p>
          </div>
        ) : orders.length > 0 ? (
          orders.map((order) => {
            const isTracking = trackingOrders.has(order.id);
            const displayShopName = order.shopName || shopDetails[order.shopId]?.name;
            const displayShopAddress = order.shopAddress || shopDetails[order.shopId]?.address;
            
            return (
              <div key={order.id} className="bg-white border border-[#1A1A1A]/10 rounded-[2.5rem] p-6 sm:p-8 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col gap-6">
                  {/* Header: Shop Info & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      {displayShopName ? (
                        <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">{displayShopName}</h3>
                      ) : (
                        <div className="h-8 w-48 bg-[#F5F5F0] animate-pulse rounded-lg mb-2" />
                      )}
                      {displayShopAddress ? (
                        <p className="text-sm text-[#1A1A1A]/60 flex items-center gap-1.5 mt-1">
                          <MapPin size={14} className="shrink-0" /> {displayShopAddress}
                        </p>
                      ) : (
                        <div className="h-4 w-64 bg-[#F5F5F0] animate-pulse rounded-md mt-2" />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="bg-[#F5F5F0] px-3 py-1.5 rounded-xl border border-[#1A1A1A]/5">
                        <span className="text-[10px] font-bold text-[#1A1A1A]/40 uppercase tracking-widest">Order #{order.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <button 
                        onClick={() => toggleTracking(order.id)}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                          isTracking 
                            ? 'bg-[#1A1A1A] text-white' 
                            : 'bg-[#5A5A40] text-white hover:bg-[#4A4A30]'
                        }`}
                      >
                        <Truck size={12} />
                        {isTracking ? 'Hide Tracking' : 'Track Order'}
                      </button>
                    </div>
                  </div>

                  {/* Tracker */}
                  <AnimatePresence>
                    {isTracking && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="py-4 border-t border-[#1A1A1A]/5 mt-2">
                          <OrderTracker status={order.status} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Order Details - Simplified */}
                  <div className="bg-[#F5F5F0]/50 rounded-2xl border border-[#1A1A1A]/5 p-5">
                    <div className="flex flex-row items-start justify-between gap-6">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-3">Items</p>
                        <div className="space-y-2">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-sm font-medium text-[#1A1A1A]">
                                {i + 1}. {item.name} {item.quantity}{item.unit && /^\d/.test(item.unit) ? ' x ' : ''}{item.unit || (['mutton', 'chicken', 'atta', 'flour', 'rice', 'dal', 'wheat', 'sugar', 'salt'].some(k => item.name.toLowerCase().includes(k)) ? 'kg' : '')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Total Amount</p>
                        <p className="text-4xl font-serif font-bold text-[#1A1A1A]">₹{order.total.toFixed(0)}</p>
                        {order.totalDiscount > 0 && (
                          <p className="text-[10px] font-bold text-green-600 uppercase tracking-tight mt-1">Saved ₹{order.totalDiscount.toFixed(0)}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Delivery Address</p>
                      <p className="text-sm text-[#1A1A1A]/60 leading-relaxed">{order.deliveryAddress}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Placed On</p>
                      <p className="text-sm text-[#1A1A1A]/60">
                        {new Date(order.createdAt).toLocaleDateString(undefined, { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric'
                        })} at {new Date(order.createdAt).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-24 text-center bg-white border border-[#1A1A1A]/10 rounded-[3rem]">
            <div className="w-20 h-20 bg-[#F5F5F0] rounded-full flex items-center justify-center mx-auto mb-6 text-[#5A5A40]/20">
              <ShoppingBag size={40} />
            </div>
            <h3 className="font-serif text-2xl font-bold mb-2">No orders yet</h3>
            <p className="text-[#1A1A1A]/40 max-w-xs mx-auto">Start exploring the marketplace to find the best local products.</p>
            <button 
              onClick={onBack}
              className="mt-8 px-8 py-3 bg-[#5A5A40] text-white rounded-full font-bold hover:bg-[#4A4A30] transition-all"
            >
              Start Shopping
            </button>
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
        <div className={`absolute top-2 left-2 backdrop-blur px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest border border-[#1A1A1A]/5 ${
          shop.status === 'pending' ? 'bg-amber-100/90 text-amber-700' : 'bg-white/90 text-[#5A5A40]'
        }`}>
          {shop.status === 'pending' ? 'PENDING' : 'OPEN'}
        </div>
        {/* Category Top Right */}
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-widest border border-[#1A1A1A]/5">
          {shop.category}
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h4 className="font-serif text-sm font-bold truncate leading-tight flex-1">{shop.name}</h4>
          <div className="flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded text-[9px] font-bold text-green-700 border border-green-100 shrink-0">
            <Star size={8} fill="currentColor" />
            <span>{shop.rating ? shop.rating.toFixed(1) : '4.5'}</span>
            {shop.reviewCount !== undefined && (
              <span className="text-[#1A1A1A]/40 font-normal">({shop.reviewCount})</span>
            )}
          </div>
        </div>
        <p className="text-[9px] text-[#1A1A1A]/40 truncate mb-2 flex items-center gap-1">
          <MapPin size={8} /> {shop.address} {shop.pincode && `(${shop.pincode})`}
        </p>
        <div className="flex items-center justify-between pt-2 border-t border-[#1A1A1A]/5">
          <div className="flex flex-col">
            <div className="flex gap-2.5 mb-1">
              <Phone size={12} className="text-[#5A5A40] hover:scale-110 transition-transform" />
              <MessageCircle size={12} className="text-[#5A5A40] hover:scale-110 transition-transform" />
            </div>
            {shop.deliveryRadius && (
              <span className="text-[8px] font-bold text-blue-600 uppercase tracking-widest">
                {shop.deliveryRadius}km Delivery
              </span>
            )}
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
  onUpdateQuantity: (id: string, d: number, v?: number) => void,
  onRemove: (id: string) => void,
  onClear: () => void
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high'>('newest');
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscount[]>([]);
  const [orderDiscounts, setOrderDiscounts] = useState<OrderDiscount[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'products'), where('shopId', '==', shop.id), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(list);
      setLoading(false);
    }, (error: any) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'products (shop)');
      }
      setLoading(false);
    });

    const qProd = query(collection(db, 'product_discounts'), where('shopId', '==', shop.id), where('status', '==', 'active'));
    const qOrder = query(collection(db, 'order_discounts'), where('shopId', '==', shop.id), where('status', '==', 'active'));
    
    const unsubProd = onSnapshot(qProd, (snapshot) => {
      setProductDiscounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductDiscount)));
    });
    const unsubOrder = onSnapshot(qOrder, (snapshot) => {
      setOrderDiscounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderDiscount)));
    });

    return () => {
      unsubscribe();
      unsubProd();
      unsubOrder();
    };
  }, [shop.id]);

  const shopCart = useMemo(() => cart.filter(item => item.shopId === shop.id), [cart, shop.id]);
  
  const calculations = useMemo(() => {
    let subtotal = 0;
    let itemDiscounts = 0;
    
    shopCart.forEach(item => {
      const itemTotal = item.product.mrp * item.quantity;
      subtotal += itemTotal;
      
      const discount = productDiscounts.find(d => d.productId === item.product.id && isOfferValid(d.validTill));
      if (discount) {
        if (discount.type === 'bogo') {
          const freeQty = Math.floor(item.quantity / 2);
          itemDiscounts += freeQty * item.product.mrp;
        } else if (discount.type === 'buy_x_get_y') {
          const freeQty = Math.floor(item.quantity / (discount.buyQty + discount.getQty)) * discount.getQty;
          itemDiscounts += freeQty * item.product.mrp;
        } else if (discount.type === 'bulk_price') {
          if (item.quantity >= discount.buyQty) {
            const sets = Math.floor(item.quantity / discount.buyQty);
            const remainder = item.quantity % discount.buyQty;
            const discountedPrice = (sets * discount.bulkPrice!) + (remainder * item.product.mrp);
            itemDiscounts += (itemTotal - discountedPrice);
          }
        } else if (discount.type === 'individual') {
          if (discount.discountType === 'percentage') {
            itemDiscounts += (itemTotal * (discount.discountValue || 0)) / 100;
          } else {
            itemDiscounts += (discount.discountValue || 0) * item.quantity;
          }
        }
      }
    });
    
    const intermediateTotal = subtotal - itemDiscounts;
    let billDiscount = 0;
    const applicableOrderDiscount = orderDiscounts
      .filter(d => intermediateTotal >= d.minBillValue && isOfferValid(d.validTill))
      .sort((a, b) => b.minBillValue - a.minBillValue)[0];
      
    if (applicableOrderDiscount) {
      if (applicableOrderDiscount.discountType === 'percentage') {
        billDiscount = (intermediateTotal * applicableOrderDiscount.discountValue) / 100;
      } else {
        billDiscount = applicableOrderDiscount.discountValue;
      }
    }

    // Find next available discount
    const nextDiscount = orderDiscounts
      .filter(d => intermediateTotal < d.minBillValue && isOfferValid(d.validTill))
      .sort((a, b) => a.minBillValue - b.minBillValue)[0];
    
    const finalTotal = Math.max(0, intermediateTotal - billDiscount);
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      itemDiscounts: Math.round(itemDiscounts * 100) / 100,
      billDiscount: Math.round(billDiscount * 100) / 100,
      total: Math.round(finalTotal * 100) / 100,
      appliedOrderDiscount: applicableOrderDiscount,
      nextDiscount: nextDiscount,
      remainingForNext: nextDiscount ? Math.round((nextDiscount.minBillValue - intermediateTotal) * 100) / 100 : 0,
      totalDiscount: Math.round((itemDiscounts + billDiscount) * 100) / 100
    };
  }, [shopCart, productDiscounts, orderDiscounts]);

  const total = calculations.total;

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['All', ...Array.from(cats)].sort();
  }, [products]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Filter by search
    if (searchTerm) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'price_low') return a.mrp - b.mrp;
      if (sortBy === 'price_high') return b.mrp - a.mrp;
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });

    return result;
  }, [products, searchTerm, selectedCategory, sortBy]);

  const handlePlaceOrder = async () => {
    if (!user) {
      alert("Please login to place an order.");
      return;
    }
    try {
      const orderData: Omit<Order, 'id'> = {
        shopId: shop.id,
        shopName: shop.name,
        shopAddress: shop.address,
        customerId: user.uid,
        items: shopCart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          price: item.product.price,
          mrp: item.product.mrp,
          quantity: item.quantity,
          unit: item.product.unit
        })),
        subtotal: calculations.subtotal,
        itemDiscounts: calculations.itemDiscounts,
        billDiscount: calculations.billDiscount,
        totalDiscount: calculations.totalDiscount,
        total,
        status: 'pending',
        paymentStatus: 'pending',
        deliveryAddress: 'Default Address', // In real app, get from user
        type: 'online',
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
      <button onClick={onBack} className="flex items-center gap-2 text-[#5A5A40] font-bold uppercase tracking-widest mb-2 hover:gap-4 transition-all text-[10px] sm:text-xs">
        <ArrowLeft size={14} /> Back to Shops
      </button>

      <div className="flex gap-4 items-start mb-8">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border border-[#1A1A1A]/5 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm shrink-0">
          {shop.logo ? (
            <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <Store size={32} className="text-[#5A5A40]/20" />
          )}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="font-serif text-xl sm:text-3xl font-bold truncate">{shop.name}</h2>
            <div className="flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-lg text-[10px] font-bold text-green-700 border border-green-100">
              <Star size={10} fill="currentColor" />
              {shop.rating || '4.5'}
              <span className="text-[#1A1A1A]/30 font-normal ml-1">({shop.reviewCount || '100+'})</span>
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-[#1A1A1A]/40 flex items-center gap-1 mb-2">
            <MapPin size={10} /> {shop.address}
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="bg-[#5A5A40]/5 text-[#5A5A40] px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest border border-[#5A5A40]/10">{shop.category}</span>
            <span className="bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest flex items-center gap-1 border border-green-100">
              <Clock size={8} /> {shop.timings}
            </span>
          </div>
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="space-y-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" size={16} />
            <input 
              type="text" 
              placeholder="Search products in this shop..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-[#1A1A1A]/10 rounded-2xl focus:outline-none text-sm shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-[#1A1A1A]/10 rounded-2xl px-4 py-3 shadow-sm">
              <Filter size={14} className="text-[#1A1A1A]/30" />
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold uppercase tracking-widest focus:outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border uppercase tracking-widest ${selectedCategory === cat ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#1A1A1A]/60 border-[#1A1A1A]/10 hover:border-[#5A5A40]'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mb-12">
        {loading ? (
          Array(12).fill(0).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-white/50 animate-pulse rounded-2xl border border-[#1A1A1A]/5" />
          ))
        ) : filteredAndSortedProducts.length > 0 ? (
          filteredAndSortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={() => onAddToCart(product, shop.id)} />
          ))
        ) : (
          <div className="col-span-full py-20 text-center">
            <p className="text-[#1A1A1A]/30 italic">No products found matching your criteria.</p>
          </div>
        )}
      </div>

      <ReviewSection shopId={shop.id} user={user} currentRating={shop.rating || 0} reviewCount={shop.reviewCount || 0} />

      {/* Cart Button */}
      {shopCart.length > 0 && (
        <button 
          onClick={() => setShowCart(true)}
          className="fixed bottom-24 right-4 sm:right-8 bg-[#5A5A40] text-white px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-2xl flex items-center gap-3 sm:gap-4 hover:scale-105 transition-all z-[60]"
        >
          <div className="relative">
            <ShoppingCart size={20} className="sm:w-6 sm:h-6" />
            <span className="absolute -top-2 -right-2 bg-white text-[#5A5A40] w-4 h-4 sm:w-5 sm:h-5 rounded-full text-[8px] sm:text-[10px] font-bold flex items-center justify-center">
              {shopCart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          </div>
          <div className="text-left">
            <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest opacity-70">View Cart</p>
            <p className="text-sm sm:text-base font-bold">₹{total}</p>
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
                      <p className="text-sm text-[#1A1A1A]/40">₹{item.product.mrp} / {item.product.unit}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center border border-[#1A1A1A]/10 rounded-full px-2 py-1">
                          <button 
                            onClick={() => onUpdateQuantity(item.product.id, ['kg', 'gram', 'L', 'ml'].includes(item.product.unit.toLowerCase()) ? -0.1 : -1)} 
                            className="p-1 hover:bg-[#F5F5F0] rounded-full"
                          >
                            <Plus size={14} className="rotate-45" />
                          </button>
                          <input 
                            type="number"
                            value={item.quantity}
                            onChange={(e) => onUpdateQuantity(item.product.id, 0, parseFloat(e.target.value))}
                            className="w-12 text-center text-sm font-bold bg-transparent focus:outline-none"
                            step={['kg', 'gram', 'L', 'ml'].includes(item.product.unit.toLowerCase()) ? "0.01" : "1"}
                          />
                          <button 
                            onClick={() => onUpdateQuantity(item.product.id, ['kg', 'gram', 'L', 'ml'].includes(item.product.unit.toLowerCase()) ? 0.1 : 1)} 
                            className="p-1 hover:bg-[#F5F5F0] rounded-full"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button onClick={() => onRemove(item.product.id)} className="text-xs font-bold text-red-500 uppercase tracking-widest">Remove</button>
                      </div>
                    </div>
                    <div className="text-right font-bold">
                      ₹{(item.product.mrp * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-8 border-t border-[#1A1A1A]/10 space-y-4">
                <div className="space-y-2">
                  {calculations.remainingForNext > 0 && (
                    <div className="bg-[#5A5A40]/5 border border-[#5A5A40]/10 rounded-xl p-3 mb-4">
                      <p className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-widest text-center">
                        Shop for ₹{calculations.remainingForNext} more to unlock {calculations.nextDiscount?.discountType === 'percentage' ? `${calculations.nextDiscount.discountValue}%` : `₹${calculations.nextDiscount?.discountValue}`} OFF!
                      </p>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm text-[#1A1A1A]/40 font-bold uppercase tracking-widest">
                    <span>Subtotal</span>
                    <span>₹{calculations.subtotal.toFixed(2)}</span>
                  </div>
                  {calculations.itemDiscounts > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-600 font-bold uppercase tracking-widest">
                      <div className="flex items-center gap-2">
                        <Tag size={12} />
                        <span>Item Offers</span>
                      </div>
                      <span>- ₹{calculations.itemDiscounts.toFixed(2)}</span>
                    </div>
                  )}
                  {calculations.billDiscount > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-600 font-bold uppercase tracking-widest">
                      <div className="flex items-center gap-2">
                        <Percent size={12} />
                        <span>Bill Offer ({calculations.appliedOrderDiscount?.minBillValue}+)</span>
                      </div>
                      <span>- ₹{calculations.billDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {(calculations.itemDiscounts + calculations.billDiscount) > 0 && (
                    <div className="flex justify-between items-center text-sm text-red-500 font-bold uppercase tracking-widest pt-2 border-t border-dashed border-[#1A1A1A]/10">
                      <span>Total Discount</span>
                      <span>₹{calculations.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-[#1A1A1A]/5">
                  <span className="text-[#1A1A1A]/40 font-bold uppercase tracking-widest">Total Amount</span>
                  <span className="text-3xl font-serif font-bold">₹{total.toFixed(2)}</span>
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
          <span className="text-sm font-bold">₹{product.mrp}</span>
        </div>
        <h4 className="text-[11px] font-medium text-[#1A1A1A]/80 line-clamp-2 leading-tight h-7">{product.name}</h4>
        <p className="text-[9px] text-[#1A1A1A]/40 font-medium">{product.category}</p>
      </div>
    </div>
  );
}

// --- Owner Dashboard ---

function OwnerDashboard({ user, profile, initialTab = 'stats', onTabChange }: { 
  user: FirebaseUser, 
  profile: UserProfile, 
  initialTab?: 'stats' | 'inventory' | 'orders' | 'billing' | 'reports' | 'settings',
  onTabChange?: (tab: 'stats' | 'inventory' | 'orders' | 'billing' | 'reports' | 'settings') => void
}) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopIndex, setSelectedShopIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showRegForm, setShowRegForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'inventory' | 'orders' | 'billing' | 'reports' | 'settings'>(initialTab);
  const [stats, setStats] = useState({ sales: 0, orders: 0, products: 0, lowStock: 0 });
  const [inventoryAction, setInventoryAction] = useState<string | null>(null);
  const [returnToStats, setReturnToStats] = useState(false);
  const [billItems, setBillItems] = useState<{product: Product, quantity: number}[]>([]);

  const handleTabChange = (tab: 'stats' | 'inventory' | 'orders' | 'billing' | 'reports' | 'settings') => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  useEffect(() => {
    setActiveTab(initialTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [initialTab]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  useEffect(() => {
    const q = query(collection(db, 'shops'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
      setShops(list);
      setLoading(false);
    }, (error: any) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'shops (owner)');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    if (shops.length > 0) {
      const currentShop = shops[selectedShopIndex];
      
      // Fetch Orders for Stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ordersQ = query(
        collection(db, 'orders'), 
        where('shopId', '==', currentShop.id),
        where('createdAt', '>=', today.toISOString())
      );
      
      const unsubscribeOrders = onSnapshot(ordersQ, (snapshot) => {
        const ordersList = snapshot.docs.map(doc => doc.data() as Order);
        const totalSales = ordersList
          .filter(o => o.status !== 'rejected')
          .reduce((sum, o) => sum + o.total, 0);
        
        setStats(prev => ({ ...prev, sales: totalSales, orders: ordersList.length }));
      }, (error: any) => {
        if (auth.currentUser) {
          handleFirestoreError(error, OperationType.LIST, 'orders (stats)');
        }
      });

      // Fetch Product Count & Low Stock
      const productsQ = query(collection(db, 'products'), where('shopId', '==', currentShop.id));
      const unsubscribeProducts = onSnapshot(productsQ, (snapshot) => {
        const list = snapshot.docs.map(doc => doc.data() as Product);
        const lowStockCount = list.filter(p => {
          const threshold = p.lowStockThreshold ?? 0;
          return p.stock <= threshold && threshold > 0;
        }).length;
        setStats(prev => ({ ...prev, products: snapshot.size, lowStock: lowStockCount }));
      }, (error: any) => {
        if (auth.currentUser) {
          handleFirestoreError(error, OperationType.LIST, 'products (stats)');
        }
      });

      return () => {
        unsubscribeOrders();
        unsubscribeProducts();
      };
    }
  }, [shops, selectedShopIndex]);

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
            <p className="text-[#5A5A40] font-bold uppercase tracking-[0.2em] text-[10px] mb-2">Welcome back, {(user.displayName || 'User').split(' ')[0]}</p>
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
        <TabButton active={activeTab === 'stats'} onClick={() => handleTabChange('stats')} label="Overview" />
        <TabButton active={activeTab === 'inventory'} onClick={() => handleTabChange('inventory')} label="Inventory" />
        <TabButton active={activeTab === 'orders'} onClick={() => handleTabChange('orders')} label="Orders" />
        <TabButton active={activeTab === 'billing'} onClick={() => handleTabChange('billing')} label="Billing" />
        <TabButton active={activeTab === 'reports'} onClick={() => handleTabChange('reports')} label="Reports" />
        <TabButton active={activeTab === 'settings'} onClick={() => handleTabChange('settings')} label="Settings" />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'stats' && (
          <motion.div 
            key="stats"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-12"
          >
            {/* My Shops Cards */}
            <div className="space-y-6">
              <div className="flex items-end justify-between px-2">
                <div>
                  <h3 className="font-serif text-2xl font-bold">Your Shops</h3>
                  <p className="text-xs text-[#1A1A1A]/40 font-bold uppercase tracking-widest mt-1">Manage all your business locations</p>
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
                {shops.map((s, idx) => (
                  <div key={s.id} className="relative group">
                    <ShopCard 
                      shop={s} 
                      onClick={() => setSelectedShopIndex(idx)} 
                    />
                    {selectedShopIndex === idx && (
                      <div className="absolute -top-2 -right-2 bg-[#5A5A40] text-white p-1 rounded-full shadow-lg z-10 border-2 border-white">
                        <CheckCircle2 size={16} />
                      </div>
                    )}
                  </div>
                ))}
                
                {shops.length >= 1 && !profile.multiLocationEnabled ? (
                  <div 
                    onClick={async () => {
                      if (profile.multiLocationRequestStatus === 'pending') return;
                      try {
                        await updateDoc(doc(db, 'users', user.uid), { multiLocationRequestStatus: 'pending' });
                      } catch (err) {
                        console.error("Error requesting access:", err);
                      }
                    }}
                    className="flex-shrink-0 w-40 sm:w-48 bg-[#F5F5F0]/30 border-2 border-dashed border-[#1A1A1A]/5 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center transition-all group-hover:bg-white/40">
                      <motion.div 
                        whileHover={{ scale: 1.1 }}
                        className="p-6 bg-white rounded-full shadow-md text-[#5A5A40]"
                      >
                        <Lock size={32} />
                      </motion.div>
                      {profile.multiLocationRequestStatus === 'pending' && (
                        <div className="mt-3">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-[#5A5A40] bg-amber-100 px-2 py-0.5 rounded-full">
                            Add Location
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-white rounded-full shadow-sm opacity-10">
                      <Plus size={24} />
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowRegForm(true)}
                    className="flex-shrink-0 w-40 sm:w-48 bg-[#F5F5F0]/50 border-2 border-dashed border-[#1A1A1A]/10 rounded-2xl flex flex-col items-center justify-center gap-3 text-[#1A1A1A]/40 hover:bg-[#F5F5F0] hover:border-[#5A5A40]/30 transition-all group shadow-sm"
                  >
                    <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                      <Plus size={24} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Add New Shop</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
              <StatCard 
                label="Today's Sales" 
                value={`₹${stats.sales}`} 
                icon={<BarChart3 size={24} />} 
                onClick={() => handleTabChange('reports')}
              />
              <StatCard 
                label="Orders" 
                value={stats.orders.toString()} 
                icon={<ClipboardList size={24} />} 
                onClick={() => handleTabChange('reports')}
              />
              <StatCard 
                label="Products" 
                value={stats.products.toString()} 
                icon={<Package size={24} />} 
                onClick={() => handleTabChange('inventory')}
              />
              <StatCard 
                label="Low Stock" 
                value={stats.lowStock.toString()} 
                icon={<AlertTriangle size={24} className={stats.lowStock > 0 ? "text-red-500" : ""} />} 
                onClick={() => {
                  setInventoryAction('view_low_stock_adj');
                  handleTabChange('inventory');
                }}
              />
            </div>

            <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 sm:p-8 shadow-sm">
              <h3 className="font-serif text-xl font-bold mb-6">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <ActionButton 
                  icon={<Plus size={20} />} 
                  label="Add Product" 
                  color="bg-[#5A5A40]" 
                  onClick={() => {
                    setInventoryAction('add_product');
                    setReturnToStats(true);
                    handleTabChange('inventory');
                  }} 
                />
                <ActionButton icon={<ClipboardList size={20} />} label="New Bill" color="bg-[#1A1A1A]" onClick={() => handleTabChange('billing')} />
                <ActionButton icon={<Settings size={20} />} label="Settings" color="bg-[#F5F5F0]" textColor="text-[#1A1A1A]" onClick={() => handleTabChange('settings')} />
                <ActionButton icon={<Phone size={20} />} label="Support" color="bg-[#F5F5F0]" textColor="text-[#1A1A1A]" onClick={() => {}} />
              </div>
            </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'inventory' && (
          <InventoryManager 
            shopId={currentShop.id} 
            initialAction={inventoryAction}
            onActionComplete={() => setInventoryAction(null)}
            onCloseAddForm={() => {
              if (returnToStats) {
                setActiveTab('stats');
                setReturnToStats(false);
              }
            }}
          />
        )}

        {activeTab === 'orders' && (
          <OrderManager shopId={currentShop.id} />
        )}

        {activeTab === 'billing' && (
          <BillingSystem 
            shopId={currentShop.id} 
            shopName={currentShop.name}
            shopAddress={currentShop.address}
            billItems={billItems}
            setBillItems={setBillItems}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView shopId={currentShop.id} />
        )}

        {activeTab === 'settings' && (
          <ShopSettings shop={currentShop} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ShopSettings({ shop }: { shop: Shop }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [formData, setFormData] = useState({
    name: shop.name,
    address: shop.address,
    category: shop.category || ALL_CATEGORIES[0],
    timings: shop.timings || '9 AM - 9 PM',
    pincode: shop.pincode || '',
    city: shop.city || '',
    state: shop.state || '',
    deliveryRadius: shop.deliveryRadius || 3,
    locationName: shop.locationName || '',
    lat: shop.location?.lat || null as number | null,
    lng: shop.location?.lng || null as number | null
  });

  // Update form data if shop prop changes externally
  useEffect(() => {
    setFormData({
      name: shop.name,
      address: shop.address,
      category: shop.category || ALL_CATEGORIES[0],
      timings: shop.timings || '9 AM - 9 PM',
      pincode: shop.pincode || '',
      city: shop.city || '',
      state: shop.state || '',
      deliveryRadius: shop.deliveryRadius || 3,
      locationName: shop.locationName || '',
      lat: shop.location?.lat || null,
      lng: shop.location?.lng || null
    });
  }, [shop.id, shop.name, shop.address, shop.category, shop.timings, shop.pincode, shop.city, shop.state, shop.deliveryRadius, shop.locationName, shop.location?.lat, shop.location?.lng]);

  const detectLocation = () => {
    setDetecting(true);
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }));
        setDetecting(false);
      },
      (error) => {
        alert("Unable to retrieve your location: " + error.message);
        setDetecting(false);
      }
    );
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert("File is too large. Please upload an image smaller than 1MB.");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          await updateDoc(doc(db, 'shops', shop.id), { logo: base64String });
          alert("Shop logo updated successfully!");
        } catch (err: any) {
          console.error("Error updating logo:", err);
          alert("Error updating logo: " + err.message);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("Error reading file:", err);
      alert("Error reading file: " + err.message);
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'shops', shop.id), {
        name: formData.name,
        address: formData.address,
        category: formData.category,
        timings: formData.timings,
        pincode: formData.pincode,
        city: formData.city,
        state: formData.state,
        deliveryRadius: formData.deliveryRadius,
        locationName: formData.locationName,
        location: formData.lat && formData.lng ? {
          lat: formData.lat,
          lng: formData.lng
        } : null
      });
      alert("Shop settings saved!");
    } catch (err: any) {
      console.error("Error saving settings:", err);
      alert("Error saving settings: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-[#1A1A1A]/10 rounded-[2.5rem] p-6 sm:p-8 shadow-sm max-w-2xl"
    >
      <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 mb-8 sm:mb-12">
        <div 
          className="w-24 h-24 sm:w-32 sm:h-32 bg-[#F5F5F0] rounded-3xl flex items-center justify-center text-[#5A5A40] border border-[#1A1A1A]/5 relative group cursor-pointer overflow-hidden shrink-0"
          onClick={() => !isUploading && document.getElementById('shop-logo-upload')?.click()}
        >
          {shop.logo ? (
            <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <Store size={48} />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="text-white" size={24} />
          </div>
          {isUploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <RefreshCw className="text-white animate-spin" size={24} />
            </div>
          )}
        </div>
        <input 
          id="shop-logo-upload" 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleLogoUpload}
          disabled={isUploading}
        />
        <div>
          <h3 className="font-serif text-2xl font-bold mb-2">Shop Logo</h3>
          <p className="text-sm text-[#1A1A1A]/40">Click the icon to upload a new logo for your shop. Recommended size: 512x512px.</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Shop Name</label>
          <input 
            type="text" 
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/20 font-bold"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Category</label>
            <select 
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/20"
            >
              {ALL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Timings</label>
            <input 
              type="text" 
              value={formData.timings}
              onChange={(e) => setFormData({...formData, timings: e.target.value})}
              className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/20"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Address</label>
          <textarea 
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
            className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/20 min-h-[100px]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Pincode</label>
                <input 
                  type="text" 
                  value={formData.pincode}
                  onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                  className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">City</label>
                <input 
                  type="text" 
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Market Area (Custom Location)</label>
              <input 
                type="text" 
                value={formData.locationName}
                onChange={(e) => setFormData({...formData, locationName: e.target.value})}
                className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/20"
                placeholder="e.g. Green Valley, Central Market"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Delivery Radius (km)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="1" 
                  max="20" 
                  step="1"
                  value={formData.deliveryRadius}
                  onChange={(e) => setFormData({...formData, deliveryRadius: Number(e.target.value)})}
                  className="flex-1 accent-[#5A5A40]"
                />
                <span className="w-12 text-center font-bold text-[#5A5A40] bg-[#F5F5F0] py-2 rounded-xl">
                  {formData.deliveryRadius}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">GPS Coordinates</label>
              <div className="flex gap-2">
                <div className="flex-1 p-3 bg-[#F5F5F0] rounded-2xl text-[10px] font-mono text-[#1A1A1A]/60 flex items-center justify-center border border-dashed border-[#1A1A1A]/10">
                  {formData.lat ? `${formData.lat.toFixed(4)}, ${formData.lng?.toFixed(4)}` : "Not detected"}
                </div>
                <button 
                  type="button"
                  onClick={detectLocation}
                  disabled={detecting}
                  className="px-4 py-2 bg-[#5A5A40] text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <MapPin size={14} />
                  {detecting ? "Detecting..." : "Update GPS"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving || isUploading}
          className={`w-full py-4 rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
            isSaving || isUploading 
              ? 'bg-[#1A1A1A]/10 text-[#1A1A1A]/40 cursor-not-allowed' 
              : 'bg-[#5A5A40] text-white hover:bg-[#4A4A30]'
          }`}
        >
          {isSaving ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Shop Settings
            </>
          )}
        </button>
      </div>
    </motion.div>
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

function ReportsView({ shopId }: { shopId: string }) {
  const [activeSubTab, setActiveSubTab] = useState('today_sales');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const q = query(
      collection(db, 'orders'), 
      where('shopId', '==', shopId),
      where('createdAt', '>=', startOfDay.toISOString()),
      where('createdAt', '<=', endOfDay.toISOString()),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(list);
      setLoading(false);
    }, (error: any) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'orders (reports)');
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [shopId, selectedDate]);

  const menuItems = [
    { id: 'today_sales', label: 'Today Sales', icon: <BarChart3 size={18} /> },
    { id: 'online_vs_walkin', label: 'Online vs Walkin', icon: <PieChart size={18} /> },
  ];

  const onlineOrders = orders.filter(o => o.type !== 'walk-in');
  const walkinOrders = orders.filter(o => o.type === 'walk-in');
  
  const onlineSales = onlineOrders.reduce((sum, o) => sum + o.total, 0);
  const walkinSales = walkinOrders.reduce((sum, o) => sum + o.total, 0);
  const totalSales = onlineSales + walkinSales;
  
  const totalProductsSold = orders.reduce((sum, o) => {
    return sum + o.items.reduce((itemSum, item) => {
      const unit = item.unit?.toLowerCase() || (['mutton', 'chicken', 'atta', 'flour', 'rice', 'dal', 'wheat', 'sugar', 'salt'].some(k => item.name.toLowerCase().includes(k)) ? 'kg' : '');
      const isWeightBased = ['kg', 'gram', 'gms', 'l', 'ml', 'kilogram', 'kilograms', 'litre', 'litres', 'liter', 'liters'].includes(unit);
      return itemSum + (isWeightBased ? 1 : item.quantity);
    }, 0);
  }, 0);

  return (
    <div className="flex flex-col md:flex-row gap-8 min-h-[600px]">
      {/* Sidebar */}
      <div className="w-full md:w-64 shrink-0">
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl overflow-hidden shadow-sm sticky top-24">
          <div className="p-4 border-b border-[#1A1A1A]/5 bg-[#F5F5F0]/50">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]">Reports Menu</h4>
          </div>
          <div className="p-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                  activeSubTab === item.id 
                    ? 'bg-[#5A5A40] text-white shadow-md' 
                    : 'text-[#1A1A1A]/60 hover:bg-[#F5F5F0]'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {loading ? (
          <div className="p-20 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[#5A5A40] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-[#1A1A1A]/40 font-medium">Loading reports...</p>
          </div>
        ) : (
          <motion.div
            key={activeSubTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            {activeSubTab === 'today_sales' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <h3 className="font-serif text-2xl font-bold">
                      {selectedDate === new Date().toISOString().split('T')[0] ? "Today's Sales Report" : `Sales Report for ${new Date(selectedDate).toLocaleDateString()}`}
                    </h3>
                    <div className="relative">
                      <button className="p-2 hover:bg-[#F5F5F0] rounded-full text-[#5A5A40] transition-all shadow-sm border border-[#1A1A1A]/5">
                        <Calendar size={20} />
                      </button>
                      <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        title="Select Date"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Today's Sales</p>
                    <h4 className="text-3xl font-serif font-bold text-green-600">₹{totalSales}</h4>
                  </div>
                  <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Total Orders</p>
                    <h4 className="text-3xl font-serif font-bold">{orders.length}</h4>
                  </div>
                  <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Products Sold</p>
                    <h4 className="text-3xl font-serif font-bold">{totalProductsSold}</h4>
                  </div>
                </div>

                <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-[#1A1A1A]/5 bg-[#F5F5F0]/30">
                    <h4 className="text-xs font-bold uppercase tracking-widest">Recent Transactions</h4>
                  </div>
                  <div className="divide-y divide-[#1A1A1A]/5">
                    {orders.length > 0 ? (
                      orders.map((order) => (
                        <div key={order.id} className="p-4 flex items-center justify-between hover:bg-[#F5F5F0]/20 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${order.type === 'walk-in' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                              {order.type === 'walk-in' ? <UserIcon size={20} /> : <ShoppingBag size={20} />}
                            </div>
                            <div>
                              <p className="font-bold text-sm">Order #{order.id.slice(-6).toUpperCase()}</p>
                              <p className="text-[10px] text-[#1A1A1A]/40 font-medium">
                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {order.type === 'walk-in' ? 'Walk-in' : 'Online'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">₹{order.total}</p>
                            <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest">{order.status}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-20 text-center text-[#1A1A1A]/30 italic">
                        No transactions recorded today.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'online_vs_walkin' && (
              <div className="space-y-8">
                <h3 className="font-serif text-2xl font-bold">Online vs Walk-in Analysis</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Visual Comparison */}
                  <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center">
                    <div className="relative w-48 h-48">
                      {/* Simple CSS-based donut chart representation */}
                      <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                        <circle cx="18" cy="18" r="16" fill="none" className="stroke-[#F5F5F0]" strokeWidth="4" />
                        {totalSales > 0 && (
                          <>
                            <circle 
                              cx="18" cy="18" r="16" fill="none" 
                              className="stroke-blue-500" 
                              strokeWidth="4" 
                              strokeDasharray={`${(walkinSales / totalSales) * 100} 100`} 
                            />
                            <circle 
                              cx="18" cy="18" r="16" fill="none" 
                              className="stroke-purple-500" 
                              strokeWidth="4" 
                              strokeDasharray={`${(onlineSales / totalSales) * 100} 100`}
                              strokeDashoffset={`-${(walkinSales / totalSales) * 100}`}
                            />
                          </>
                        )}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Total</p>
                        <p className="text-xl font-serif font-bold">₹{totalSales}</p>
                      </div>
                    </div>
                    
                    <div className="mt-8 grid grid-cols-2 gap-8 w-full">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <div className="w-3 h-3 bg-blue-500 rounded-full" />
                          <span className="text-xs font-bold">Walk-in</span>
                        </div>
                        <p className="text-lg font-serif font-bold">₹{walkinSales}</p>
                        <p className="text-[10px] text-[#1A1A1A]/40 font-bold">{totalSales > 0 ? Math.round((walkinSales / totalSales) * 100) : 0}%</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <div className="w-3 h-3 bg-purple-500 rounded-full" />
                          <span className="text-xs font-bold">Online</span>
                        </div>
                        <p className="text-lg font-serif font-bold">₹{onlineSales}</p>
                        <p className="text-[10px] text-[#1A1A1A]/40 font-bold">{totalSales > 0 ? Math.round((onlineSales / totalSales) * 100) : 0}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Breakdown */}
                  <div className="space-y-4">
                    <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <UserIcon size={20} />
                          </div>
                          <h4 className="font-bold">Walk-in Sales</h4>
                        </div>
                        <span className="text-sm font-bold">₹{walkinSales}</span>
                      </div>
                      <div className="w-full bg-[#F5F5F0] h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full" style={{ width: `${totalSales > 0 ? (walkinSales / totalSales) * 100 : 0}%` }} />
                      </div>
                      <p className="text-[10px] text-[#1A1A1A]/40 mt-2 font-medium">{walkinOrders.length} orders processed today via billing system.</p>
                    </div>

                    <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                            <ShoppingBag size={20} />
                          </div>
                          <h4 className="font-bold">Online Sales</h4>
                        </div>
                        <span className="text-sm font-bold">₹{onlineSales}</span>
                      </div>
                      <div className="w-full bg-[#F5F5F0] h-2 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full" style={{ width: `${totalSales > 0 ? (onlineSales / totalSales) * 100 : 0}%` }} />
                      </div>
                      <p className="text-[10px] text-[#1A1A1A]/40 mt-2 font-medium">{onlineOrders.length} orders received via marketplace.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function BillingSystem({ 
  shopId, 
  shopName,
  shopAddress,
  billItems, 
  setBillItems 
}: { 
  shopId: string, 
  shopName: string,
  shopAddress: string,
  billItems: {product: Product, quantity: number}[],
  setBillItems: React.Dispatch<React.SetStateAction<{product: Product, quantity: number}[]>>
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [recentBills, setRecentBills] = useState<Order[]>([]);
  const [billSearchTerm, setBillSearchTerm] = useState('');
  const [billTypeFilter, setBillTypeFilter] = useState<'all' | 'online' | 'walk-in'>('all');
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscount[]>([]);
  const [orderDiscounts, setOrderDiscounts] = useState<OrderDiscount[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const frequentItems = useMemo(() => {
    const counts: Record<string, number> = {};
    recentBills.forEach(bill => {
      bill.items.forEach(item => {
        counts[item.productId] = (counts[item.productId] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => products.find(p => p.id === id))
      .filter((p): p is Product => !!p);
  }, [recentBills, products]);

  const recentItems = useMemo(() => {
    const seen = new Set<string>();
    const items: Product[] = [];
    for (const bill of recentBills) {
      for (const item of bill.items) {
        if (!seen.has(item.productId)) {
          const p = products.find(prod => prod.id === item.productId);
          if (p) {
            items.push(p);
            seen.add(item.productId);
          }
        }
        if (items.length >= 10) break;
      }
      if (items.length >= 10) break;
    }
    return items;
  }, [recentBills, products]);

  useEffect(() => {
    const qProd = query(collection(db, 'product_discounts'), where('shopId', '==', shopId), where('status', '==', 'active'));
    const qOrder = query(collection(db, 'order_discounts'), where('shopId', '==', shopId), where('status', '==', 'active'));
    
    const unsubProd = onSnapshot(qProd, (snapshot) => {
      setProductDiscounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductDiscount)));
    });
    const unsubOrder = onSnapshot(qOrder, (snapshot) => {
      setOrderDiscounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderDiscount)));
    });
    return () => { unsubProd(); unsubOrder(); };
  }, [shopId]);

  useEffect(() => {
    const q = query(collection(db, 'products'), where('shopId', '==', shopId), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(list);
    });
    return () => unsubscribe();
  }, [shopId]);

  useEffect(() => {
    const q = query(
      collection(db, 'orders'), 
      where('shopId', '==', shopId), 
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setRecentBills(list);
    });
    return () => unsubscribe();
  }, [shopId]);

  const addToBill = (product: Product) => {
    const existing = billItems.find(item => item.product.id === product.id);
    if (existing) {
      alert(`Duplicate Item Warning: "${product.name}" is already in the bill. If you want to change the quantity, please use the controls in the bill summary.`);
      return;
    }
    setBillItems(prev => [...prev, { product, quantity: 1 }]);
  };

  const updateQty = (productId: string, delta: number, absoluteValue?: number) => {
    setBillItems(prev => prev.map(item => {
      if (item.product.id === productId) {
        let newQty;
        if (absoluteValue !== undefined) {
          newQty = Math.max(0.01, absoluteValue);
        } else {
          const isWeightBased = ['kg', 'gram', 'L', 'ml'].includes(item.product.unit.toLowerCase());
          const step = isWeightBased && (item.quantity % 1 !== 0 || delta % 1 !== 0) ? delta : Math.round(delta);
          newQty = Math.max(isWeightBased ? 0.01 : 1, item.quantity + step);
        }
        return { ...item, quantity: Math.round(newQty * 100) / 100 };
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setBillItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const calculations = useMemo(() => {
    let subtotal = 0;
    let itemDiscounts = 0;
    
    billItems.forEach(item => {
      const itemTotal = item.product.mrp * item.quantity;
      subtotal += itemTotal;
      
      const discount = productDiscounts.find(d => d.productId === item.product.id && isOfferValid(d.validTill));
      if (discount) {
        if (discount.type === 'bogo') {
          const freeQty = Math.floor(item.quantity / 2);
          itemDiscounts += freeQty * item.product.mrp;
        } else if (discount.type === 'buy_x_get_y') {
          const freeQty = Math.floor(item.quantity / (discount.buyQty + discount.getQty)) * discount.getQty;
          itemDiscounts += freeQty * item.product.mrp;
        } else if (discount.type === 'bulk_price') {
          if (item.quantity >= discount.buyQty) {
            const sets = Math.floor(item.quantity / discount.buyQty);
            const remainder = item.quantity % discount.buyQty;
            const discountedPrice = (sets * discount.bulkPrice!) + (remainder * item.product.mrp);
            itemDiscounts += (itemTotal - discountedPrice);
          }
        } else if (discount.type === 'individual') {
          if (discount.discountType === 'percentage') {
            itemDiscounts += (itemTotal * (discount.discountValue || 0)) / 100;
          } else {
            itemDiscounts += (discount.discountValue || 0) * item.quantity;
          }
        }
      }
    });
    
    const intermediateTotal = subtotal - itemDiscounts;
    let billDiscount = 0;
    const applicableOrderDiscount = orderDiscounts
      .filter(d => intermediateTotal >= d.minBillValue && isOfferValid(d.validTill))
      .sort((a, b) => b.minBillValue - a.minBillValue)[0];
      
    if (applicableOrderDiscount) {
      if (applicableOrderDiscount.discountType === 'percentage') {
        billDiscount = (intermediateTotal * applicableOrderDiscount.discountValue) / 100;
      } else {
        billDiscount = applicableOrderDiscount.discountValue;
      }
    }

    // Find next available discount
    const nextDiscount = orderDiscounts
      .filter(d => intermediateTotal < d.minBillValue && isOfferValid(d.validTill))
      .sort((a, b) => a.minBillValue - b.minBillValue)[0];
    
    const finalTotal = Math.max(0, intermediateTotal - billDiscount);
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      itemDiscounts: Math.round(itemDiscounts * 100) / 100,
      billDiscount: Math.round(billDiscount * 100) / 100,
      total: Math.round(finalTotal * 100) / 100,
      appliedOrderDiscount: applicableOrderDiscount,
      nextDiscount: nextDiscount,
      remainingForNext: nextDiscount ? Math.round((nextDiscount.minBillValue - intermediateTotal) * 100) / 100 : 0,
      totalDiscount: Math.round((itemDiscounts + billDiscount) * 100) / 100
    };
  }, [billItems, productDiscounts, orderDiscounts]);

  const total = calculations.total;
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateBill = async () => {
    if (billItems.length === 0) return;
    setIsGenerating(true);
    try {
      const billData: Omit<Order, 'id'> = {
        shopId,
        shopName,
        shopAddress,
        customerId: 'walk-in',
        items: billItems.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          price: item.product.price,
          mrp: item.product.mrp,
          quantity: item.quantity,
          unit: item.product.unit
        })),
        subtotal: calculations.subtotal,
        itemDiscounts: calculations.itemDiscounts,
        billDiscount: calculations.billDiscount,
        totalDiscount: calculations.totalDiscount,
        total,
        status: 'delivered',
        paymentStatus: 'paid',
        deliveryAddress: 'Walk-in Customer',
        type: 'walk-in',
        createdAt: new Date().toISOString()
      };

      // 1. Create the order record
      try {
        await addDoc(collection(db, 'orders'), billData);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, 'orders');
      }

      // 2. Update stock for each product
      for (const item of billItems) {
        try {
          const productRef = doc(db, 'products', item.product.id);
          await updateDoc(productRef, { 
            stock: increment(-item.quantity)
          });
        } catch (err: any) {
          handleFirestoreError(err, OperationType.UPDATE, `products/${item.product.id}`);
        }
      }

      alert("Bill generated successfully!");
      setBillItems([]);
    } catch (err: any) {
      // If it's a JSON string from handleFirestoreError, parse it for a cleaner message
      try {
        const errInfo = JSON.parse(err.message);
        alert(`Error: ${errInfo.error || 'Failed to generate bill'}`);
      } catch {
        alert(err.message);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const filteredBills = recentBills.filter(bill => {
    const matchesSearch = 
      bill.id.toLowerCase().includes(billSearchTerm.toLowerCase()) ||
      bill.items.some(item => item.name.toLowerCase().includes(billSearchTerm.toLowerCase()));
    
    const matchesType = billTypeFilter === 'all' || bill.type === billTypeFilter;
    
    return matchesSearch && matchesType;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Selection */}
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" size={18} />
            <input 
              type="text" 
              placeholder="Search products to add..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="w-full pl-12 pr-4 py-3 sm:py-3.5 bg-white border border-[#1A1A1A]/10 rounded-2xl focus:outline-none text-sm shadow-sm"
            />

            <AnimatePresence>
              {isSearchFocused && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 right-0 top-full mt-2 bg-white border border-[#1A1A1A]/10 rounded-3xl shadow-2xl z-50 overflow-hidden max-h-[400px] flex flex-col"
                >
                  <div className="overflow-y-auto no-scrollbar">
                    {searchTerm ? (
                      <div className="p-2">
                        <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Suggestions</p>
                        {filteredProducts.length > 0 ? (
                          filteredProducts.slice(0, 8).map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                addToBill(p);
                                setSearchTerm('');
                              }}
                              className="w-full flex items-center gap-4 p-4 hover:bg-[#F5F5F0] transition-all text-left group rounded-2xl"
                            >
                              <div className="w-10 h-10 bg-[#F5F5F0] rounded-xl flex items-center justify-center text-[#5A5A40]/40 group-hover:bg-[#5A5A40]/10 group-hover:text-[#5A5A40]">
                                <Package size={20} />
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-sm">{p.name}</p>
                                <p className="text-[10px] text-[#1A1A1A]/40">₹{p.mrp} • {p.unit}</p>
                              </div>
                              <Plus size={16} className="text-[#5A5A40]/20 group-hover:text-[#5A5A40]" />
                            </button>
                          ))
                        ) : (
                          <p className="p-8 text-center text-sm text-[#1A1A1A]/30 italic">No products found</p>
                        )}
                      </div>
                    ) : (
                      <div className="p-2">
                        {recentItems.length > 0 && (
                          <div className="mb-4">
                            <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Recently Billed</p>
                            <div className="grid grid-cols-1 gap-1">
                              {recentItems.slice(0, 5).map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => addToBill(p)}
                                  className="w-full flex items-center gap-4 p-4 hover:bg-[#F5F5F0] transition-all text-left group rounded-2xl"
                                >
                                  <div className="w-10 h-10 bg-[#F5F5F0] rounded-xl flex items-center justify-center text-[#5A5A40]/40 group-hover:bg-[#5A5A40]/10 group-hover:text-[#5A5A40]">
                                    <Clock size={20} />
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-bold text-sm">{p.name}</p>
                                    <p className="text-[10px] text-[#1A1A1A]/40">₹{p.mrp} • {p.unit}</p>
                                  </div>
                                  <Plus size={16} className="text-[#5A5A40]/20 group-hover:text-[#5A5A40]" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {frequentItems.length > 0 && (
                          <div>
                            <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Top 10 Frequent Items</p>
                            <div className="grid grid-cols-1 gap-1">
                              {frequentItems.map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => addToBill(p)}
                                  className="w-full flex items-center gap-4 p-4 hover:bg-[#F5F5F0] transition-all text-left group rounded-2xl"
                                >
                                  <div className="w-10 h-10 bg-[#F5F5F0] rounded-xl flex items-center justify-center text-[#5A5A40]/40 group-hover:bg-[#5A5A40]/10 group-hover:text-[#5A5A40]">
                                    <Star size={20} />
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-bold text-sm">{p.name}</p>
                                    <p className="text-[10px] text-[#1A1A1A]/40">₹{p.mrp} • {p.unit}</p>
                                  </div>
                                  <Plus size={16} className="text-[#5A5A40]/20 group-hover:text-[#5A5A40]" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={() => setShowAddProduct(true)}
            className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            <Plus size={20} /> Add Product
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
            {filteredProducts.map((p) => {
              const isInBill = billItems.some(item => item.product.id === p.id);
              return (
                <button 
                  key={p.id}
                  onClick={() => addToBill(p)}
                  className={`p-4 bg-white border rounded-2xl text-left transition-all flex items-center gap-4 group relative ${
                    isInBill 
                      ? 'border-[#5A5A40] bg-[#5A5A40]/5 opacity-80' 
                      : 'border-[#1A1A1A]/10 hover:border-[#5A5A40]'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    isInBill ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] text-[#5A5A40]/20 group-hover:bg-[#5A5A40]/10'
                  }`}>
                    <Package size={24} />
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${isInBill ? 'text-[#5A5A40]' : ''}`}>{p.name}</p>
                    <p className="text-xs text-[#1A1A1A]/40">₹{p.mrp} / {p.unit}</p>
                  </div>
                  {isInBill && (
                    <div className="absolute top-2 right-2 text-[#5A5A40]">
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bill Summary */}
        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-8 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-serif text-2xl font-bold">New Bill</h3>
            {billItems.length > 0 && (
              <button 
                onClick={() => setBillItems([])}
                className="px-4 py-2 bg-[#FF3269] text-white rounded-xl text-xs font-bold hover:bg-[#E62D5F] transition-all shadow-sm"
              >
                Remove All
              </button>
            )}
          </div>
          
          <div className="flex-1 space-y-6 overflow-y-auto pr-2 mb-8">
            {billItems.length > 0 ? (
              billItems.map((item, idx) => (
                <div key={item.product.id} className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{idx + 1}. {item.product.name} {item.quantity}{item.product.unit && /^\d/.test(item.product.unit) ? ' x ' : ''}{item.product.unit}</p>
                      {productDiscounts.find(d => d.productId === item.product.id && isOfferValid(d.validTill)) && (
                        <span className="bg-green-100 text-green-700 text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                          Offer
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex items-center border border-[#1A1A1A]/10 rounded-full px-2 py-0.5">
                        <button 
                          onClick={() => updateQty(item.product.id, ['kg', 'gram', 'L', 'ml'].includes(item.product.unit.toLowerCase()) ? -0.1 : -1)} 
                          className="p-1 hover:bg-[#F5F5F0] rounded-full"
                        >
                          <Plus size={12} className="rotate-45" />
                        </button>
                        <input 
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQty(item.product.id, 0, parseFloat(e.target.value))}
                          className="w-10 text-center text-xs font-bold bg-transparent focus:outline-none"
                          step={['kg', 'gram', 'L', 'ml'].includes(item.product.unit.toLowerCase()) ? "0.01" : "1"}
                        />
                        <button 
                          onClick={() => updateQty(item.product.id, ['kg', 'gram', 'L', 'ml'].includes(item.product.unit.toLowerCase()) ? 0.1 : 1)} 
                          className="p-1 hover:bg-[#F5F5F0] rounded-full"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button onClick={() => removeItem(item.product.id)} className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Remove</button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">₹{(item.product.mrp * item.quantity).toFixed(2)}</p>
                    <p className="text-[10px] text-[#1A1A1A]/40 font-bold">
                      ₹{item.product.mrp} per {item.product.unit}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center border-2 border-dashed border-[#1A1A1A]/5 rounded-2xl">
                <p className="text-[#1A1A1A]/30 italic">Add products to start billing.</p>
              </div>
            )}
          </div>

          <div className="pt-8 border-t border-[#1A1A1A]/10 space-y-4">
            <div className="space-y-2">
              {calculations.remainingForNext > 0 && (
                <div className="bg-[#5A5A40]/5 border border-[#5A5A40]/10 rounded-xl p-3 mb-4">
                  <p className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-widest text-center">
                    Shop for ₹{calculations.remainingForNext} more to unlock {calculations.nextDiscount?.discountType === 'percentage' ? `${calculations.nextDiscount.discountValue}%` : `₹${calculations.nextDiscount?.discountValue}`} OFF!
                  </p>
                </div>
              )}
              <div className="flex justify-between items-center text-sm text-[#1A1A1A]/40 font-bold uppercase tracking-widest">
                <span>Subtotal</span>
                <span>₹{calculations.subtotal.toFixed(2)}</span>
              </div>
              {calculations.itemDiscounts > 0 && (
                <div className="flex justify-between items-center text-sm text-green-600 font-bold uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <Tag size={12} />
                    <span>Item Offers</span>
                  </div>
                  <span>- ₹{calculations.itemDiscounts.toFixed(2)}</span>
                </div>
              )}
              {calculations.billDiscount > 0 && (
                <div className="flex justify-between items-center text-sm text-green-600 font-bold uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <Percent size={12} />
                    <span>Bill Offer ({calculations.appliedOrderDiscount?.minBillValue}+)</span>
                  </div>
                  <span>- ₹{calculations.billDiscount.toFixed(2)}</span>
                </div>
              )}
              {(calculations.itemDiscounts + calculations.billDiscount) > 0 && (
                <div className="flex justify-between items-center text-sm text-red-500 font-bold uppercase tracking-widest pt-2 border-t border-dashed border-[#1A1A1A]/10">
                  <span>Total Discount</span>
                  <span>₹{calculations.totalDiscount.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-[#1A1A1A]/5">
              <span className="text-[#1A1A1A]/40 font-bold uppercase tracking-widest">Total Bill</span>
              <span className="text-4xl font-serif font-bold">₹{total.toFixed(2)}</span>
            </div>
            <button 
              disabled={billItems.length === 0 || isGenerating}
              onClick={handleGenerateBill}
              className="w-full bg-[#1A1A1A] text-white py-4 rounded-2xl font-bold text-lg hover:bg-black transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-30"
            >
              {isGenerating ? 'Generating...' : 'Generate Bill'} <ClipboardList size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Bills List */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-serif text-2xl font-bold">Recent Bills</h3>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" size={16} />
              <input 
                type="text" 
                placeholder="Search Bill ID or product..."
                value={billSearchTerm}
                onChange={(e) => setBillSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-[#1A1A1A]/10 rounded-xl focus:outline-none text-sm w-full sm:w-64"
              />
            </div>
            
            <div className="flex items-center gap-2 bg-white border border-[#1A1A1A]/10 rounded-xl px-3 py-2">
              <Filter size={14} className="text-[#1A1A1A]/30" />
              <select 
                value={billTypeFilter}
                onChange={(e) => setBillTypeFilter(e.target.value as any)}
                className="bg-transparent text-sm focus:outline-none font-bold"
              >
                <option value="all">All Types</option>
                <option value="online">Online</option>
                <option value="walk-in">Walk-in</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl overflow-hidden shadow-sm">
          <div className="divide-y divide-[#1A1A1A]/5">
            {filteredBills.length > 0 ? (
              filteredBills.map((bill) => (
                <div key={bill.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F5F5F0]/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bill.type === 'walk-in' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                      {bill.type === 'walk-in' ? <UserIcon size={24} /> : <ShoppingBag size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold">Order #{bill.id.slice(-6).toUpperCase()}</p>
                        <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                          bill.type === 'walk-in' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {bill.type}
                        </span>
                      </div>
                      <p className="text-xs text-[#1A1A1A]/40 font-medium">
                        {new Date(bill.createdAt).toLocaleString()} • {bill.items.length} items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-8">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Items</p>
                      <p className="text-xs font-medium truncate max-w-[200px]">
                        {bill.items.map(i => i.name).join(', ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Amount</p>
                      <p className="text-xl font-serif font-bold">₹{bill.total}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-20 text-center text-[#1A1A1A]/30 italic">
                No bills found matching your criteria.
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddProduct && (
        <ProductForm 
          shopId={shopId} 
          existingProducts={products}
          onClose={() => setShowAddProduct(false)} 
        />
      )}
    </motion.div>
  );
}

function PurchaseOrderManager({ shopId, products }: { shopId: string, products: Product[] }) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const poQuery = query(collection(db, 'purchase_orders'), where('shopId', '==', shopId), orderBy('createdAt', 'desc'));
    const unsubscribePO = onSnapshot(poQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
      setPurchaseOrders(list);
      setLoading(false);
    });

    const supplierQuery = query(collection(db, 'suppliers'), where('shopId', '==', shopId));
    const unsubscribeSuppliers = onSnapshot(supplierQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(list);
    });

    return () => {
      unsubscribePO();
      unsubscribeSuppliers();
    };
  }, [shopId]);

  const getSupplierName = (id: string) => {
    return suppliers.find(s => s.id === id)?.name || 'Unknown Supplier';
  };

  const updateStatus = async (id: string, status: PurchaseOrder['status']) => {
    try {
      const po = purchaseOrders.find(p => p.id === id);
      if (po && status === 'received' && po.status !== 'received') {
        for (const item of po.items) {
          try {
            const productRef = doc(db, 'products', item.productId);
            await updateDoc(productRef, {
              stock: increment(item.quantity)
            });
          } catch (err: any) {
            handleFirestoreError(err, OperationType.UPDATE, `products/${item.productId}`);
          }
        }
      }
      await updateDoc(doc(db, 'purchase_orders', id), { status });
    } catch (err) {
      console.error("Error updating PO status:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-serif text-3xl font-bold text-[#1A1A1A]">Purchase Orders</h3>
        <button 
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all shadow-md"
        >
          <Plus size={18} /> Create PO
        </button>
      </div>

      <div className="bg-white border border-[#1A1A1A]/10 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F5F5F0]/50 border-b border-[#1A1A1A]/5">
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">PO ID</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Supplier</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Date</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center">Items</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center">Total</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center">Status</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {purchaseOrders.length > 0 ? (
                purchaseOrders.map(po => (
                  <tr key={po.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                    <td className="p-6 font-mono text-xs font-bold text-[#1A1A1A]">#{po.id.slice(-6).toUpperCase()}</td>
                    <td className="p-6">
                      <div className="font-bold text-[#1A1A1A]">{getSupplierName(po.supplierId)}</div>
                    </td>
                    <td className="p-6 text-sm text-[#1A1A1A]/60">{new Date(po.createdAt).toLocaleDateString()}</td>
                    <td className="p-6 text-center text-sm font-bold text-[#1A1A1A]/60">{po.items.length}</td>
                    <td className="p-6 text-center font-serif font-bold text-[#1A1A1A]">₹{po.totalAmount}</td>
                    <td className="p-6 text-center">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${
                        po.status === 'received' ? 'bg-green-100 text-green-700' :
                        po.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                        po.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setSelectedPO(po)}
                          className="p-2 hover:bg-[#5A5A40] hover:text-white rounded-xl text-[#5A5A40] transition-all"
                        >
                          <ClipboardList size={18} />
                        </button>
                        {po.status === 'draft' && (
                          <button 
                            onClick={() => updateStatus(po.id, 'sent')}
                            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600 transition-all"
                          >
                            Send
                          </button>
                        )}
                        {po.status === 'sent' && (
                          <button 
                            onClick={() => updateStatus(po.id, 'received')}
                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-green-600 transition-all"
                          >
                            Receive
                          </button>
                        )}
                        {po.status !== 'received' && po.status !== 'cancelled' && (
                          <button 
                            onClick={() => updateStatus(po.id, 'cancelled')}
                            className="p-2 hover:bg-red-500 hover:text-white rounded-xl text-red-500 transition-all"
                          >
                            <XCircle size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-[#1A1A1A]/40 italic">
                    {loading ? 'Loading purchase orders...' : 'No purchase orders found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <PurchaseOrderForm 
          shopId={shopId} 
          products={products}
          suppliers={suppliers}
          onClose={() => setShowForm(false)} 
        />
      )}

      {selectedPO && (
        <PODetailsModal 
          po={selectedPO} 
          supplierName={getSupplierName(selectedPO.supplierId)}
          onClose={() => setSelectedPO(null)} 
        />
      )}
    </div>
  );
}

function PODetailsModal({ po, supplierName, onClose }: { po: PurchaseOrder, supplierName: string, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#F5F5F0] w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl border border-white/20"
      >
        <div className="p-8 border-b border-[#1A1A1A]/5 flex justify-between items-center bg-white/50">
          <div>
            <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">PO Details</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">#{po.id.toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#1A1A1A]/5 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Supplier</p>
              <p className="font-bold text-[#1A1A1A]">{supplierName}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Date</p>
              <p className="font-bold text-[#1A1A1A]">{new Date(po.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1">Status</p>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full ${
                po.status === 'received' ? 'bg-green-100 text-green-700' :
                po.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                po.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {po.status}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Order Items</p>
            <div className="bg-white border border-[#1A1A1A]/10 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F5F5F0]/50 border-b border-[#1A1A1A]/5">
                    <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Product</th>
                    <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center">Qty</th>
                    <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-right">Price</th>
                    <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/5">
                  {po.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-4 text-xs font-bold text-[#1A1A1A]">{item.name}</td>
                      <td className="p-4 text-xs text-center text-[#1A1A1A]/60">{item.quantity}</td>
                      <td className="p-4 text-xs text-right text-[#1A1A1A]/60">₹{item.price}</td>
                      <td className="p-4 text-xs text-right font-bold text-[#1A1A1A]">₹{item.price * item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F5F5F0]/50 font-bold">
                    <td colSpan={3} className="p-4 text-xs text-right uppercase tracking-widest text-[#1A1A1A]/40">Grand Total</td>
                    <td className="p-4 text-sm text-right text-[#5A5A40]">₹{po.totalAmount}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl text-sm font-bold hover:bg-[#4A4A30] transition-all shadow-lg"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PurchaseOrderForm({ shopId, products, suppliers, onClose }: { shopId: string, products: Product[], suppliers: Supplier[], onClose: () => void }) {
  const [supplierId, setSupplierId] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ productId: string, name: string, price: number, quantity: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = (product: Product) => {
    if (selectedItems.find(i => i.productId === product.id)) return;
    setSelectedItems([...selectedItems, { productId: product.id, name: product.name, price: product.price, quantity: 1 }]);
  };

  const removeItem = (productId: string) => {
    setSelectedItems(selectedItems.filter(i => i.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setSelectedItems(selectedItems.map(i => i.productId === productId ? { ...i, quantity: Math.max(1, quantity) } : i));
  };

  const totalAmount = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || selectedItems.length === 0) return;
    
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'purchase_orders'), {
        shopId,
        supplierId,
        items: selectedItems,
        totalAmount,
        status: 'draft',
        createdAt: new Date().toISOString()
      });
      onClose();
    } catch (err) {
      console.error("Error creating PO:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#F5F5F0] w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-2xl border border-white/20"
      >
        <div className="p-8 border-b border-[#1A1A1A]/5 flex justify-between items-center bg-white/50">
          <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">Create Purchase Order</h3>
          <button onClick={onClose} className="p-2 hover:bg-[#1A1A1A]/5 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[80vh] overflow-y-auto">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">Select Supplier *</label>
            <select 
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
            >
              <option value="">Choose a supplier...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">Add Products</label>
              <div className="bg-white border border-[#1A1A1A]/10 rounded-2xl p-4 max-h-[400px] overflow-y-auto space-y-2">
                {products.filter(p => p.status !== 'deleted').map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addItem(p)}
                    className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F0] rounded-xl transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#F5F5F0] rounded-lg overflow-hidden">
                        {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Package size={16} className="m-auto mt-2 opacity-20" />}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-[#1A1A1A]">{p.name}</p>
                        <p className="text-[9px] text-[#1A1A1A]/40 uppercase tracking-widest">{p.category}</p>
                      </div>
                    </div>
                    <Plus size={16} className="text-[#5A5A40] opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">Order Items</label>
              <div className="bg-white border border-[#1A1A1A]/10 rounded-2xl p-4 max-h-[400px] overflow-y-auto space-y-4">
                {selectedItems.length > 0 ? (
                  selectedItems.map(item => (
                    <div key={item.productId} className="flex items-center justify-between gap-4 p-3 bg-[#F5F5F0]/30 rounded-xl border border-[#1A1A1A]/5">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-[#1A1A1A]">{item.name}</p>
                        <p className="text-[9px] text-[#1A1A1A]/40 uppercase tracking-widest">₹{item.price} / unit</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <input 
                          type="number" 
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value))}
                          className="w-16 px-2 py-1 bg-white border border-[#1A1A1A]/10 rounded-lg text-xs font-bold text-center outline-none"
                        />
                        <button 
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-[#1A1A1A]/30 italic text-xs">
                    No items added to the order.
                  </div>
                )}
              </div>

              {selectedItems.length > 0 && (
                <div className="p-6 bg-[#5A5A40] rounded-2xl text-white flex justify-between items-center shadow-lg">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Total Amount</p>
                    <p className="font-serif text-2xl font-bold">₹{totalAmount}</p>
                  </div>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-white text-[#5A5A40] rounded-xl text-xs font-bold hover:bg-[#F5F5F0] transition-all shadow-md disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Order'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function SupplierManager({ shopId }: { shopId: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'suppliers'), where('shopId', '==', shopId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [shopId]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'suppliers', id));
    } catch (err) {
      console.error("Error deleting supplier:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-serif text-3xl font-bold text-[#1A1A1A]">Suppliers</h3>
        <button 
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all shadow-md"
        >
          <Plus size={18} /> Add Supplier
        </button>
      </div>

      <div className="bg-white border border-[#1A1A1A]/10 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F5F5F0]/50 border-b border-[#1A1A1A]/5">
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Name</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Contact</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Phone</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">GST Number</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {suppliers.length > 0 ? (
                suppliers.map(s => (
                  <tr key={s.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                    <td className="p-6">
                      <div className="font-bold text-[#1A1A1A]">{s.name}</div>
                      <div className="text-[10px] text-[#1A1A1A]/40 uppercase tracking-widest">{s.email}</div>
                    </td>
                    <td className="p-6 text-sm text-[#1A1A1A]/60">{s.contactPerson || '-'}</td>
                    <td className="p-6 text-sm text-[#1A1A1A]/60">{s.phone || '-'}</td>
                    <td className="p-6 text-sm text-[#1A1A1A]/60 font-mono">{s.gstNumber || '-'}</td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setEditingSupplier(s)}
                          className="p-2 hover:bg-[#5A5A40] hover:text-white rounded-xl text-[#5A5A40] transition-all"
                        >
                          <Settings size={18} />
                        </button>
                        <button 
                          onClick={() => setConfirmDelete(s.id)}
                          className="p-2 hover:bg-red-500 hover:text-white rounded-xl text-red-500 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[#1A1A1A]/40 italic">
                    {loading ? 'Loading suppliers...' : 'No suppliers added yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showForm || editingSupplier) && (
        <SupplierForm 
          shopId={shopId} 
          supplier={editingSupplier || undefined} 
          onClose={() => {
            setShowForm(false);
            setEditingSupplier(null);
          }} 
        />
      )}

      <ConfirmModal 
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
      />
    </div>
  );
}

function SupplierForm({ shopId, supplier, onClose }: { shopId: string, supplier?: Supplier, onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    contactPerson: supplier?.contactPerson || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
    address: supplier?.address || '',
    gstNumber: supplier?.gstNumber || ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    
    setSubmitting(true);
    try {
      if (supplier) {
        await updateDoc(doc(db, 'suppliers', supplier.id), formData);
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...formData,
          shopId,
          createdAt: new Date().toISOString()
        });
      }
      onClose();
    } catch (err) {
      console.error("Error saving supplier:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#F5F5F0] w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl border border-white/20"
      >
        <div className="p-8 border-b border-[#1A1A1A]/5 flex justify-between items-center bg-white/50">
          <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">
            {supplier ? 'Edit Supplier' : 'Add New Supplier'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-[#1A1A1A]/5 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">Supplier Name *</label>
              <input 
                required
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
                placeholder="Enter supplier name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">Contact Person</label>
              <input 
                type="text" 
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
                placeholder="Name of contact person"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">Phone Number</label>
              <input 
                type="tel" 
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
                placeholder="Supplier phone number"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">Email Address</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
                placeholder="Supplier email"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">Address</label>
              <textarea 
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all min-h-[100px]"
                placeholder="Full address of supplier"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">GST Number</label>
              <input 
                type="text" 
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all font-mono"
                placeholder="Enter GSTIN"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-8 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm font-bold text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="flex-1 px-8 py-4 bg-[#5A5A40] text-white rounded-2xl text-sm font-bold hover:bg-[#4A4A30] transition-all shadow-lg disabled:opacity-50"
            >
              {submitting ? 'Saving...' : (supplier ? 'Update Supplier' : 'Add Supplier')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function BulkDiscountManager({ shopId, products }: { shopId: string, products: Product[] }) {
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscount[]>([]);
  const [orderDiscounts, setOrderDiscounts] = useState<OrderDiscount[]>([]);
  const [activeTab, setActiveTab] = useState<'product' | 'order'>('product');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<ProductDiscount | OrderDiscount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qProd = query(collection(db, 'product_discounts'), where('shopId', '==', shopId));
    const qOrder = query(collection(db, 'order_discounts'), where('shopId', '==', shopId));

    const unsubProd = onSnapshot(qProd, (snapshot) => {
      setProductDiscounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductDiscount)));
      setLoading(false);
    }, (error: any) => {
      handleFirestoreError(error, OperationType.LIST, 'product_discounts');
    });

    const unsubOrder = onSnapshot(qOrder, (snapshot) => {
      setOrderDiscounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderDiscount)));
    }, (error: any) => {
      handleFirestoreError(error, OperationType.LIST, 'order_discounts');
    });

    return () => {
      unsubProd();
      unsubOrder();
    };
  }, [shopId]);

  const handleDeleteProductDiscount = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'product_discounts', id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `product_discounts/${id}`);
    }
  };

  const handleDeleteOrderDiscount = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'order_discounts', id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `order_discounts/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-serif text-3xl font-bold">Bulk Discounts & Offers</h3>
          <p className="text-[#1A1A1A]/40 text-sm mt-1 uppercase tracking-widest font-bold">Boost your sales with modern offers</p>
        </div>
        <button 
          onClick={() => {
            setEditingDiscount(null);
            setShowAddModal(true);
          }}
          className="bg-[#5A5A40] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#4A4A30] transition-all shadow-lg"
        >
          <Plus size={20} /> Create New Offer
        </button>
      </div>

      <div className="flex gap-8 border-b border-[#1A1A1A]/5">
        <button 
          onClick={() => setActiveTab('product')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'product' ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/40'}`}
        >
          Product Offers
          {activeTab === 'product' && <motion.div layoutId="discount-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
        </button>
        <button 
          onClick={() => setActiveTab('order')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === 'order' ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/40'}`}
        >
          Bill Value Offers
          {activeTab === 'order' && <motion.div layoutId="discount-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTab === 'product' ? (
          productDiscounts.length > 0 ? (
            productDiscounts.map((d) => (
              <motion.div 
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-[#1A1A1A]/10 rounded-[2rem] p-6 shadow-sm relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 flex">
                  <button 
                    onClick={() => {
                      setEditingDiscount(d);
                      setShowAddModal(true);
                    }}
                    className="bg-green-500 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-green-600 transition-colors"
                  >
                    edit
                  </button>
                  <button 
                    onClick={() => handleDeleteProductDiscount(d.id)} 
                    className="bg-red-500 text-white px-4 py-2 hover:bg-red-600 transition-colors flex items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-[#F5F5F0] rounded-2xl flex items-center justify-center text-[#5A5A40]">
                    <Tag size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{d.productName}</h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded-full">
                        {d.type.replace(/_/g, ' ')}
                      </span>
                      {d.validTill && (
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${new Date(d.validTill) < new Date() ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          {new Date(d.validTill) < new Date() ? 'Expired' : `Till: ${new Date(d.validTill).toLocaleDateString()}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-[#F5F5F0]/50 rounded-2xl p-4">
                  <p className="text-2xl font-serif font-bold text-[#5A5A40]">
                    {d.type === 'bogo' ? 'Buy 1 Get 1 Free' : 
                     d.type === 'buy_x_get_y' ? `Buy ${d.buyQty} Get ${d.getQty} Free` :
                     d.type === 'individual' ? (d.discountType === 'percentage' ? `${d.discountValue}% OFF` : `₹${d.discountValue} OFF`) :
                     `Buy ${d.buyQty} for ₹${d.bulkPrice}`}
                  </p>
                  <p className="text-xs text-[#1A1A1A]/40 mt-1 font-bold uppercase tracking-widest">
                    {new Date(d.validTill || '9999-12-31') < new Date() ? 'Offer Ended' : 'Active Offer'}
                  </p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-[#1A1A1A]/5 rounded-[3rem]">
              <p className="text-[#1A1A1A]/30 italic">No product offers created yet.</p>
            </div>
          )
        ) : (
          orderDiscounts.length > 0 ? (
            orderDiscounts.map((d) => (
              <motion.div 
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-[#1A1A1A]/10 rounded-[2rem] p-6 shadow-sm relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 flex">
                  <button 
                    onClick={() => {
                      setEditingDiscount(d);
                      setShowAddModal(true);
                    }}
                    className="bg-green-500 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-green-600 transition-colors"
                  >
                    edit
                  </button>
                  <button 
                    onClick={() => handleDeleteOrderDiscount(d.id)} 
                    className="bg-red-500 text-white px-4 py-2 hover:bg-red-600 transition-colors flex items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-[#1A1A1A]/5 rounded-2xl flex items-center justify-center text-[#1A1A1A]">
                    <Percent size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Bill Above ₹{d.minBillValue}</h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-[#1A1A1A]/10 text-[#1A1A1A] px-2 py-0.5 rounded-full">
                        Tiered Discount
                      </span>
                      {d.validTill && (
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${new Date(d.validTill) < new Date() ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          {new Date(d.validTill) < new Date() ? 'Expired' : `Till: ${new Date(d.validTill).toLocaleDateString()}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-[#1A1A1A]/5 rounded-2xl p-4">
                  <p className="text-2xl font-serif font-bold text-[#1A1A1A]">
                    {d.discountType === 'percentage' ? `${d.discountValue}% OFF` : `₹${d.discountValue} OFF`}
                  </p>
                  <p className="text-xs text-[#1A1A1A]/40 mt-1 font-bold uppercase tracking-widest">
                    {new Date(d.validTill || '9999-12-31') < new Date() ? 'Offer Ended' : 'Applied at Checkout'}
                  </p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-[#1A1A1A]/5 rounded-[3rem]">
              <p className="text-[#1A1A1A]/30 italic">No bill value offers created yet.</p>
            </div>
          )
        )}
      </div>

      {showAddModal && (
        <AddDiscountModal 
          shopId={shopId} 
          products={products} 
          initialData={editingDiscount}
          existingProductDiscounts={productDiscounts}
          existingOrderDiscounts={orderDiscounts}
          onClose={() => {
            setShowAddModal(false);
            setEditingDiscount(null);
          }} 
        />
      )}
    </div>
  );
}

function AddDiscountModal({ 
  shopId, 
  products, 
  onClose, 
  initialData,
  existingProductDiscounts,
  existingOrderDiscounts
}: { 
  shopId: string, 
  products: Product[], 
  onClose: () => void,
  initialData?: ProductDiscount | OrderDiscount | null,
  existingProductDiscounts: ProductDiscount[],
  existingOrderDiscounts: OrderDiscount[]
}) {
  const [type, setType] = useState<'product' | 'order'>(initialData ? ('productId' in initialData ? 'product' : 'order') : 'product');
  const [formData, setFormData] = useState({
    productId: initialData && 'productId' in initialData ? initialData.productId : '',
    offerType: initialData && 'productId' in initialData ? initialData.type : 'bogo' as any,
    buyQty: initialData && 'buyQty' in initialData ? initialData.buyQty : 1,
    getQty: initialData && 'getQty' in initialData ? initialData.getQty : 1,
    bulkPrice: initialData && 'bulkPrice' in initialData ? initialData.bulkPrice || 0 : 0,
    minBillValue: initialData && 'minBillValue' in initialData ? initialData.minBillValue : 299,
    discountType: initialData ? initialData.discountType : 'percentage' as any,
    discountValue: initialData ? initialData.discountValue : 10,
    validTill: initialData?.validTill || ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  useEffect(() => {
    setDuplicateWarning(null);
  }, [formData, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for duplicates if not already warned
    if (!duplicateWarning) {
      if (type === 'product') {
        const product = products.find(p => p.id === formData.productId);
        if (product) {
          const isDuplicate = existingProductDiscounts.some(d => {
            if (d.id === initialData?.id) return false;
            if (d.productId !== formData.productId) return false;
            if (d.type === formData.offerType) {
              if (d.type === 'individual') {
                return d.discountType === formData.discountType && d.discountValue === Number(formData.discountValue);
              }
              return true;
            }
            return false;
          });

          if (isDuplicate) {
            const message = formData.offerType === 'individual' 
              ? `An identical individual discount (${formData.discountType === 'percentage' ? formData.discountValue + '%' : '₹' + formData.discountValue}) already exists for ${product.name}.`
              : `An offer of type "${formData.offerType.replace(/_/g, ' ')}" already exists for ${product.name}.`;
            setDuplicateWarning(message);
            return;
          }
        }
      } else {
        const isDuplicate = existingOrderDiscounts.some(d => 
          d.minBillValue === Number(formData.minBillValue) && 
          d.id !== initialData?.id
        );

        if (isDuplicate) {
          setDuplicateWarning(`An offer for bill value above ₹${formData.minBillValue} already exists.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      if (type === 'product') {
        const product = products.find(p => p.id === formData.productId);
        if (!product) throw new Error("Please select a product");
        
        const data = {
          shopId,
          productId: formData.productId,
          productName: product.name,
          type: formData.offerType,
          buyQty: Number(formData.buyQty),
          getQty: Number(formData.getQty),
          bulkPrice: formData.offerType === 'bulk_price' ? Number(formData.bulkPrice) : null,
          discountType: formData.offerType === 'individual' ? formData.discountType : null,
          discountValue: formData.offerType === 'individual' ? Number(formData.discountValue) : null,
          status: 'active',
          validTill: formData.validTill || null,
          updatedAt: new Date().toISOString()
        };

        if (initialData?.id && 'productId' in initialData) {
          await updateDoc(doc(db, 'product_discounts', initialData.id), data);
        } else {
          await addDoc(collection(db, 'product_discounts'), {
            ...data,
            createdAt: new Date().toISOString()
          });
        }
      } else {
        const data = {
          shopId,
          minBillValue: Number(formData.minBillValue),
          discountType: formData.discountType,
          discountValue: Number(formData.discountValue),
          status: 'active',
          validTill: formData.validTill || null,
          updatedAt: new Date().toISOString()
        };

        if (initialData?.id && !('productId' in initialData)) {
          await updateDoc(doc(db, 'order_discounts', initialData.id), data);
        } else {
          await addDoc(collection(db, 'order_discounts'), {
            ...data,
            createdAt: new Date().toISOString()
          });
        }
      }
      onClose();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, type === 'product' ? 'product_discounts' : 'order_discounts');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-xl rounded-[3rem] p-8 shadow-2xl overflow-hidden"
      >
        <div className="flex justify-between items-center mb-8">
          <h3 className="font-serif text-2xl font-bold">{initialData ? 'Edit Offer' : 'Create New Offer'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-full"><XCircle size={24} /></button>
        </div>

        {!initialData && (
          <div className="flex gap-4 p-1 bg-[#F5F5F0] rounded-2xl mb-8">
            <button 
              onClick={() => setType('product')}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${type === 'product' ? 'bg-white text-[#5A5A40] shadow-sm' : 'text-[#1A1A1A]/40'}`}
            >
              Product Specific
            </button>
            <button 
              onClick={() => setType('order')}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${type === 'order' ? 'bg-white text-[#5A5A40] shadow-sm' : 'text-[#1A1A1A]/40'}`}
            >
              Bill Value Based
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {type === 'product' ? (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Select Product</label>
                <select 
                  required
                  value={formData.productId}
                  onChange={(e) => setFormData({...formData, productId: e.target.value})}
                  className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                >
                  <option value="">Choose a product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (₹{p.mrp})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Offer Type</label>
                  <select 
                    value={formData.offerType}
                    onChange={(e) => setFormData({...formData, offerType: e.target.value as any})}
                    className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                  >
                    <option value="bogo">Buy 1 Get 1</option>
                    <option value="buy_x_get_y">Buy X Get Y</option>
                    <option value="bulk_price">Bulk Fixed Price</option>
                    <option value="individual">Individual Item Discount</option>
                  </select>
                </div>
                {formData.offerType !== 'bogo' && formData.offerType !== 'individual' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Buy Quantity</label>
                    <input 
                      type="number" 
                      required
                      value={formData.buyQty}
                      onChange={(e) => setFormData({...formData, buyQty: Number(e.target.value)})}
                      className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                    />
                  </div>
                )}
              </div>
              {formData.offerType === 'individual' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Discount Type</label>
                    <select 
                      value={formData.discountType}
                      onChange={(e) => setFormData({...formData, discountType: e.target.value as any})}
                      className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="flat">Flat Amount (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Value</label>
                    <input 
                      type="number" 
                      required
                      value={formData.discountValue}
                      onChange={(e) => setFormData({...formData, discountValue: Number(e.target.value)})}
                      className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                    />
                  </div>
                </div>
              )}
              {formData.offerType === 'buy_x_get_y' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Get Quantity (Free)</label>
                  <input 
                    type="number" 
                    required
                    value={formData.getQty}
                    onChange={(e) => setFormData({...formData, getQty: Number(e.target.value)})}
                    className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                  />
                </div>
              )}
              {formData.offerType === 'bulk_price' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Bulk Price (₹)</label>
                  <input 
                    type="number" 
                    required
                    value={formData.bulkPrice}
                    onChange={(e) => setFormData({...formData, bulkPrice: Number(e.target.value)})}
                    className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Min Bill Value (₹)</label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[299, 399, 499, 999].map(val => (
                    <button 
                      key={val}
                      type="button"
                      onClick={() => setFormData({...formData, minBillValue: val})}
                      className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${formData.minBillValue === val ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-[#1A1A1A]/40 border-[#1A1A1A]/10'}`}
                    >
                      ₹{val}
                    </button>
                  ))}
                </div>
                <input 
                  type="number" 
                  required
                  value={formData.minBillValue}
                  onChange={(e) => setFormData({...formData, minBillValue: Number(e.target.value)})}
                  className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Discount Type</label>
                  <select 
                    value={formData.discountType}
                    onChange={(e) => setFormData({...formData, discountType: e.target.value as any})}
                    className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Value</label>
                  <input 
                    type="number" 
                    required
                    value={formData.discountValue}
                    onChange={(e) => setFormData({...formData, discountValue: Number(e.target.value)})}
                    className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Valid Till (Optional)</label>
            <input 
              type="datetime-local" 
              value={formData.validTill}
              onChange={(e) => setFormData({...formData, validTill: e.target.value})}
              className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
            />
          </div>

          {duplicateWarning && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <p className="text-sm text-amber-800 font-bold">{duplicateWarning}</p>
                <p className="text-xs text-amber-700 mt-1">Are you sure you want to create this duplicate offer?</p>
                <button 
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mt-2 hover:text-amber-700"
                >
                  No, let me change it
                </button>
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={submitting}
            className="w-full bg-[#5A5A40] text-white py-5 rounded-2xl font-bold text-lg hover:bg-[#4A4A30] transition-all shadow-lg disabled:opacity-50 mt-4"
          >
            {submitting ? 'Saving...' : (duplicateWarning ? 'Yes, Create Anyway' : (initialData ? 'Update Offer' : 'Activate Offer'))}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function StockAdjustment({ 
  products, 
  shopId, 
  filterIds, 
  onClearFilter 
}: { 
  products: Product[], 
  shopId: string, 
  filterIds?: string[] | null, 
  onClearFilter?: () => void 
}) {
  const [search, setSearch] = useState('');
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<Product>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filterMode, setFilterMode] = useState<'all' | 'low_stock' | 'expiring' | 'task'>(filterIds ? 'task' : 'all');
  const [hideResolved, setHideResolved] = useState(false);

  useEffect(() => {
    if (filterIds && filterIds.length > 0) {
      setFilterMode('task');
    } else if (filterMode === 'task') {
      setFilterMode('all');
    }
  }, [filterIds]);

  const isLowStock = (p: Product) => {
    const threshold = p.lowStockThreshold ?? 0;
    return p.stock <= threshold && threshold > 0;
  };

  const isExpiring = (p: Product) => {
    if (!p.expiryDate) return false;
    const diff = new Date(p.expiryDate).getTime() - new Date().getTime();
    return diff > 0 && diff < (30 * 24 * 60 * 60 * 1000);
  };

  const filteredProducts = useMemo(() => {
    let base = products;
    if (filterMode === 'task' && filterIds) {
      base = products.filter(p => filterIds.includes(p.id));
    } else if (filterMode === 'low_stock') {
      base = products.filter(isLowStock);
    } else if (filterMode === 'expiring') {
      base = products.filter(isExpiring);
    }

    if (hideResolved && filterMode === 'task') {
      base = base.filter(p => isLowStock(p) || isExpiring(p));
    }

    return base.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search, filterIds, filterMode, hideResolved]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    if (itemsPerPage === -1) return filteredProducts;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const handleLocalUpdate = (productId: string, updates: Partial<Product>) => {
    setLocalEdits(prev => ({
      ...prev,
      [productId]: { ...prev[productId], ...updates }
    }));
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    const editCount = Object.keys(localEdits).length;
    if (editCount === 0) return;
    
    setIsSaving(true);
    try {
      const updatePromises = Object.entries(localEdits).map(([id, updates]) => 
        updateDoc(doc(db, 'products', id), updates)
      );
      await Promise.all(updatePromises);
      setLocalEdits({});
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error("Error saving updates:", err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const getVal = (p: Product, field: keyof Product) => {
    return localEdits[p.id]?.[field] ?? p[field];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h3 className="font-serif text-3xl font-bold text-[#1A1A1A]">Stock Adjustment</h3>
            {filterIds && filterIds.length > 0 && (
              <button 
                onClick={onClearFilter}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#5A5A40]/10 text-[#5A5A40] rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-[#5A5A40]/20 transition-all"
              >
                <X size={14} /> Clear Filter ({filterIds.length})
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setFilterMode('all');
                if (onClearFilter) onClearFilter();
              }}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${filterMode === 'all' ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] text-[#1A1A1A]/40 hover:bg-[#5A5A40]/10'}`}
            >
              All
            </button>
            <button 
              onClick={() => setFilterMode('low_stock')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${filterMode === 'low_stock' ? 'bg-red-500 text-white' : 'bg-[#F5F5F0] text-[#1A1A1A]/40 hover:bg-red-500/10'}`}
            >
              Low Stock
            </button>
            <button 
              onClick={() => setFilterMode('expiring')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${filterMode === 'expiring' ? 'bg-amber-500 text-white' : 'bg-[#F5F5F0] text-[#1A1A1A]/40 hover:bg-amber-500/10'}`}
            >
              Expiring
            </button>
            {filterIds && (
              <button 
                onClick={() => setFilterMode('task')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${filterMode === 'task' ? 'bg-blue-500 text-white' : 'bg-[#F5F5F0] text-[#1A1A1A]/40 hover:bg-blue-500/10'}`}
              >
                Task List
              </button>
            )}
          </div>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" size={18} />
          <input 
            type="text" 
            placeholder="Search products..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
          />
        </div>
      </div>

      {filterMode === 'task' && filterIds && (
        <div className="bg-blue-50 border border-blue-100 rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
              <ClipboardList size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-blue-900">Task Progress</h4>
              <p className="text-[10px] text-blue-700 font-medium">
                {products.filter(p => filterIds.includes(p.id) && !isLowStock(p) && !isExpiring(p)).length} of {filterIds.length} items resolved
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex-1 sm:w-48 h-2 bg-blue-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-500" 
                style={{ width: `${(products.filter(p => filterIds.includes(p.id) && !isLowStock(p) && !isExpiring(p)).length / (filterIds.length || 1)) * 100}%` }}
              />
            </div>
            <button 
              onClick={() => setHideResolved(!hideResolved)}
              className="px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-[10px] font-bold text-blue-600 hover:bg-blue-50 transition-all whitespace-nowrap"
            >
              {hideResolved ? 'Show All Task Items' : 'Hide Resolved Items'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#1A1A1A]/10 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F5F5F0]/50 border-b border-[#1A1A1A]/5">
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Product</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center w-32">Purchase Price</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center w-32">MRP</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center w-40">Stock Quantity</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center w-40">Restock</th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center w-40">Expiry Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {paginatedProducts.map(p => (
                <tr key={p.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F5F5F0] rounded-lg overflow-hidden flex-shrink-0">
                        {p.image ? <img src={p.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Package size={20} className="m-auto text-[#5A5A40]/20 mt-2.5" />}
                      </div>
                      <div>
                        <p className="font-bold text-[#1A1A1A]">{p.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-[#1A1A1A]/40 uppercase tracking-widest">{p.category}</p>
                          {(filterMode === 'task' && !isLowStock(p) && !isExpiring(p)) && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                              <CheckCircle2 size={10} /> Resolved
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <input 
                      type="number" 
                      value={getVal(p, 'price')}
                      onChange={(e) => handleLocalUpdate(p.id, { price: Number(e.target.value) })}
                      className="w-full bg-transparent border-b border-transparent focus:border-[#5A5A40] text-center font-bold outline-none py-1"
                    />
                  </td>
                  <td className="p-6">
                    <input 
                      type="number" 
                      value={getVal(p, 'mrp')}
                      onChange={(e) => handleLocalUpdate(p.id, { mrp: Number(e.target.value) })}
                      className="w-full bg-transparent border-b border-transparent focus:border-[#5A5A40] text-center font-bold text-[#5A5A40] outline-none py-1"
                    />
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleLocalUpdate(p.id, { stock: Math.max(0, Number(getVal(p, 'stock')) - 1) })}
                          className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                        >
                          <Plus size={14} className="rotate-45" />
                        </button>
                        <input 
                          type="number" 
                          value={getVal(p, 'stock')}
                          onChange={(e) => handleLocalUpdate(p.id, { stock: Number(e.target.value) })}
                          className="w-16 bg-[#F5F5F0] rounded-lg text-center font-bold py-1.5 outline-none"
                        />
                        <button 
                          onClick={() => handleLocalUpdate(p.id, { stock: Number(getVal(p, 'stock')) + 1 })}
                          className="p-1.5 hover:bg-green-100 text-green-600 rounded-lg transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      {(() => {
                        const stock = Number(getVal(p, 'stock'));
                        const threshold = Number(getVal(p, 'lowStockThreshold') ?? 0);
                        const isLow = stock <= threshold && threshold > 0;
                        return isLow ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[8px] font-bold uppercase tracking-widest rounded-md">
                            Low Stock
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col items-center gap-2">
                      <input 
                        type="number" 
                        value={getVal(p, 'lowStockThreshold') ?? 0}
                        onChange={(e) => handleLocalUpdate(p.id, { lowStockThreshold: Number(e.target.value) })}
                        className="w-full bg-transparent border-b border-transparent focus:border-[#5A5A40] text-center font-bold outline-none py-1"
                      />
                    </div>
                  </td>
                  <td className="p-6">
                    {(() => {
                      const expiry = getVal(p, 'expiryDate');
                      const isExpiring = expiry && (() => {
                        const today = new Date();
                        const thirtyDaysFromNow = new Date();
                        thirtyDaysFromNow.setDate(today.getDate() + 30);
                        const expDate = new Date(expiry);
                        return expDate <= thirtyDaysFromNow && expDate >= today;
                      })();
                      const isExpired = expiry && new Date(expiry) < new Date();

                      return (
                        <div className="relative">
                          <input 
                            type="date" 
                            value={expiry || ''}
                            onChange={(e) => handleLocalUpdate(p.id, { expiryDate: e.target.value })}
                            className={`w-full bg-transparent border-b border-transparent focus:border-[#5A5A40] text-center text-xs font-medium outline-none py-1 transition-colors ${
                              isExpired ? 'text-red-600 font-bold' : isExpiring ? 'text-amber-600 font-bold' : ''
                            }`}
                          />
                          {isExpiring && !isExpired && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-amber-600 uppercase tracking-widest whitespace-nowrap">
                              Expiring Soon
                            </div>
                          )}
                          {isExpired && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold text-red-600 uppercase tracking-widest whitespace-nowrap">
                              Expired
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredProducts.length > 0 && (
          <div className="p-6 bg-[#F5F5F0]/30 border-t border-[#1A1A1A]/5 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-widest">
              Showing {itemsPerPage === -1 ? filteredProducts.length : Math.min(itemsPerPage, filteredProducts.length - (currentPage - 1) * itemsPerPage)} of {filteredProducts.length} Products
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setItemsPerPage(itemsPerPage === -1 ? 10 : -1)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  itemsPerPage === -1 
                    ? 'bg-[#5A5A40] text-white' 
                    : 'bg-white border border-[#1A1A1A]/10 text-[#1A1A1A]/60 hover:bg-[#F5F5F0]'
                }`}
              >
                {itemsPerPage === -1 ? 'Show Paginated' : 'Show All'}
              </button>

              {itemsPerPage !== -1 && (
                <div className="flex items-center gap-1 ml-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-2 bg-white border border-[#1A1A1A]/10 rounded-xl text-[#1A1A1A]/60 hover:bg-[#F5F5F0] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  
                  <div className="px-4 py-2 bg-white border border-[#1A1A1A]/10 rounded-xl text-xs font-bold text-[#5A5A40]">
                    Page {currentPage} of {totalPages}
                  </div>

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-2 bg-white border border-[#1A1A1A]/10 rounded-xl text-[#1A1A1A]/60 hover:bg-[#F5F5F0] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-center pt-4">
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={handleSave}
          disabled={isSaving || Object.keys(localEdits).length === 0}
          className={`flex items-center gap-3 px-10 py-4 rounded-2xl font-bold text-lg shadow-lg transition-all active:scale-95 ${
            saveStatus === 'success' 
              ? 'bg-green-500 text-white' 
              : saveStatus === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-[#5A5A40] text-white hover:bg-[#4A4A30] disabled:opacity-30 disabled:cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            <>Saving...</>
          ) : saveStatus === 'success' ? (
            <><CheckCircle2 size={20} /> Saved Successfully</>
          ) : saveStatus === 'error' ? (
            <><AlertCircle size={20} /> Error Saving</>
          ) : (
            <>
              <Save size={20} /> 
              Save Changes 
              {Object.keys(localEdits).length > 0 && (
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-lg text-xs">
                  {Object.keys(localEdits).length}
                </span>
              )}
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}

function InventoryManager({ shopId, initialAction, onActionComplete, onCloseAddForm }: { shopId: string, initialAction?: string | null, onActionComplete?: () => void, onCloseAddForm?: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeSubTab, setActiveSubTab] = useState('catalog');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high' | 'stock_low' | 'stock_high'>('newest');
  const [stockAdjFilter, setStockAdjFilter] = useState<string[] | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<string | null>(null);
  const [dismissedLowStockAlert, setDismissedLowStockAlert] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSubTab, catalogSearch, itemsPerPage]);

  const lastHandledAction = useRef<string | null>(null);

  useEffect(() => {
    if (initialAction === lastHandledAction.current) return;

    if (initialAction === 'add_product') {
      setShowAddForm(true);
      lastHandledAction.current = initialAction;
      if (onActionComplete) onActionComplete();
    }
    if (initialAction === 'view_low_stock_adj' && products.length > 0) {
      const lowStockIds = products.filter(p => {
        const threshold = p.lowStockThreshold ?? 0;
        return p.stock <= threshold && threshold > 0;
      }).map(p => p.id);
      
      setStockAdjFilter(lowStockIds);
      setActiveSubTab('stock_adj');
      lastHandledAction.current = initialAction;
      if (onActionComplete) onActionComplete();
    }
  }, [initialAction, onActionComplete, products]);

  const filteredProducts = useMemo(() => {
    let baseProducts = products;
    
    if (activeSubTab === 'trash') {
      baseProducts = products.filter(p => p.status === 'deleted');
    } else {
      baseProducts = products.filter(p => p.status !== 'deleted');
    }

    // Category Filter
    if (categoryFilter !== 'All') {
      baseProducts = baseProducts.filter(p => p.category === categoryFilter);
    }

    // Search Filter
    if (catalogSearch) {
      const search = catalogSearch.toLowerCase();
      baseProducts = baseProducts.filter(p => 
        p.name.toLowerCase().includes(search) || 
        p.category.toLowerCase().includes(search)
      );
    }

    // Sorting
    const sorted = [...baseProducts].sort((a, b) => {
      if (sortBy === 'price_low') return a.mrp - b.mrp;
      if (sortBy === 'price_high') return b.mrp - a.mrp;
      if (sortBy === 'stock_low') return a.stock - b.stock;
      if (sortBy === 'stock_high') return b.stock - a.stock;
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });

    return sorted;
  }, [products, catalogSearch, activeSubTab, categoryFilter, sortBy]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['All', ...Array.from(cats)].sort();
  }, [products]);

  const paginatedProducts = useMemo(() => {
    if (itemsPerPage === -1) return filteredProducts;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(filteredProducts.length / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const expiringProducts = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    return products.filter(p => {
      if (!p.expiryDate) return false;
      const expiry = new Date(p.expiryDate);
      return expiry <= thirtyDaysFromNow && expiry >= today;
    });
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter(p => {
      const threshold = p.lowStockThreshold ?? 0;
      return p.stock <= threshold && threshold > 0;
    });
  }, [products]);

  useEffect(() => {
    const q = query(collection(db, 'products'), where('shopId', '==', shopId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(list);
    }, (error: any) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'products (inventory)');
      }
    });
    return () => unsubscribe();
  }, [shopId]);

  const handleDeleteProduct = async (productId: string) => {
    try {
      await updateDoc(doc(db, 'products', productId), { status: 'deleted' });
      setStatusMessage({ type: 'success', text: "Product moved to trash." });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleRestoreProduct = async (productId: string) => {
    try {
      await updateDoc(doc(db, 'products', productId), { status: 'active' });
      setStatusMessage({ type: 'success', text: "Product restored successfully." });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handlePermanentDeleteProduct = async (productId: string) => {
    try {
      await deleteDoc(doc(db, 'products', productId));
      setStatusMessage({ type: 'success', text: "Product permanently deleted." });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const menuItems = [
    { id: 'catalog', label: 'Catalog', icon: <Package size={18} /> },
    { 
      id: 'stock_main', 
      label: 'Stock', 
      icon: <ShoppingCart size={18} />,
      subItems: [
        { 
          label: 'Purchase', 
          subItems: ['Supplier', 'Purchase Order', 'Quotation', 'Goods Received Note', 'Goods Returned Against Goods Received Note'] 
        }
      ]
    },
    { 
      id: 'stock_adj', 
      label: 'Stock Adjustment', 
      icon: <RefreshCw size={18} />,
      badge: lowStockProducts.length > 0 ? lowStockProducts.length : null
    },
    { id: 'bulk', label: 'Bulk Discount', icon: <Percent size={18} /> },
    { 
      id: 'credit', 
      label: 'Credit', 
      icon: <CreditCard size={18} />,
      subItems: ['Supplier', 'Customer']
    },
    { id: 'trash', label: 'Trash', icon: <Trash2 size={18} />, badge: products.filter(p => p.status === 'deleted').length || null },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Expiry Notifications */}
      {expiringProducts.length > 0 && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="bg-amber-50 border border-amber-200 rounded-3xl p-4 flex items-start gap-4 shadow-sm"
        >
          <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
            <AlertCircle size={20} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-900">Expiry Alerts</h4>
            <p className="text-xs text-amber-700 mt-1">
              {expiringProducts.length} {expiringProducts.length === 1 ? 'product is' : 'products are'} nearing expiry within the next 30 days.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {expiringProducts.slice(0, 3).map(p => (
                <div key={p.id} className="bg-white/60 px-3 py-1 rounded-full text-[10px] font-bold text-amber-800 border border-amber-200">
                  {p.name} ({new Date(p.expiryDate!).toLocaleDateString()})
                </div>
              ))}
              {expiringProducts.length > 3 && (
                <div className="bg-white/60 px-3 py-1 rounded-full text-[10px] font-bold text-amber-800 border border-amber-200">
                  + {expiringProducts.length - 3} more
                </div>
              )}
            </div>
          </div>
          <button 
            onClick={() => {
              setStockAdjFilter(expiringProducts.map(p => p.id));
              setActiveSubTab('stock_adj');
            }}
            className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors"
          >
            Adjust Stock
          </button>
        </motion.div>
      )}

      {/* Low Stock Notifications */}
      {lowStockProducts.length > 0 && !dismissedLowStockAlert && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="bg-red-50 border border-red-200 rounded-3xl p-4 flex items-start gap-4 shadow-sm"
        >
          <div className="p-2 bg-red-100 rounded-xl text-red-600">
            <Package size={20} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-red-900">Low Stock Alerts</h4>
            <p className="text-xs text-red-700 mt-1">
              {lowStockProducts.length} {lowStockProducts.length === 1 ? 'product is' : 'products are'} below their restock threshold.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {lowStockProducts.slice(0, 3).map(p => (
                <div key={p.id} className="bg-white/60 px-3 py-1 rounded-full text-[10px] font-bold text-red-800 border border-red-200">
                  {p.name} (Stock: {p.stock} / Min: {p.lowStockThreshold})
                </div>
              ))}
              {lowStockProducts.length > 3 && (
                <div className="bg-white/60 px-3 py-1 rounded-full text-[10px] font-bold text-red-800 border border-red-200">
                  + {lowStockProducts.length - 3} more
                </div>
              )}
            </div>
          </div>
          <button 
            onClick={() => setDismissedLowStockAlert(true)}
            className="p-2 hover:bg-red-100 text-red-400 hover:text-red-600 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </motion.div>
      )}

      {/* Horizontal Floating Menu */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-[#1A1A1A]/10 rounded-[2rem] p-2 shadow-sm relative z-50 overflow-visible">
        {menuItems.map((item) => (
          <div 
            key={item.id} 
            className="relative group"
            onMouseLeave={() => {
              setOpenMenu(null);
              setOpenSubMenu(null);
            }}
          >
            <button
              onClick={() => {
                setActiveSubTab(item.id);
                if (item.subItems) {
                  setOpenMenu(openMenu === item.id ? null : item.id);
                } else {
                  setOpenMenu(null);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${
                activeSubTab === item.id 
                  ? 'bg-[#5A5A40] text-white shadow-md' 
                  : 'text-[#1A1A1A]/60 hover:bg-[#F5F5F0] hover:text-[#5A5A40]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge && (
                <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full shadow-sm">
                  {item.badge}
                </span>
              )}
              {item.subItems && <ChevronDown size={14} className={`opacity-40 transition-transform ${openMenu === item.id ? 'rotate-180' : ''}`} />}
            </button>
            
            {item.subItems && (openMenu === item.id || (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)) && (
              <div className={`absolute top-full left-0 mt-2 w-56 bg-white border border-[#1A1A1A]/10 rounded-2xl shadow-xl transition-all z-[60] py-2 translate-y-2 group-hover:translate-y-0 ${openMenu === item.id ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'}`}>
                {item.subItems.map((sub: any) => {
                  const subLabel = typeof sub === 'string' ? sub : sub.label;
                  const hasNested = typeof sub === 'object' && sub.subItems;
                  const isOpen = openSubMenu === subLabel;
                  
                  return (
                    <div key={subLabel} className="flex flex-col">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasNested) {
                            setOpenSubMenu(isOpen ? null : subLabel);
                          } else {
                            setActiveSubTab(subLabel.toLowerCase().replace(/\s+/g, '_'));
                            setOpenMenu(null);
                          }
                        }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors flex items-center justify-between ${
                          isOpen ? 'text-[#5A5A40] bg-[#F5F5F0]' : 'text-[#1A1A1A]/60 hover:text-[#5A5A40] hover:bg-[#F5F5F0]'
                        }`}
                      >
                        {subLabel}
                        {hasNested && (
                          <ChevronDown size={12} className={`opacity-40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                      
                      {hasNested && isOpen && (
                        <div className="bg-[#F5F5F0]/30 py-1">
                          {sub.subItems.map((nested: string) => (
                            <button
                              key={nested}
                              onClick={() => {
                                setActiveSubTab(nested.toLowerCase().replace(/\s+/g, '_'));
                                setOpenMenu(null);
                                setOpenSubMenu(null);
                              }}
                              className="w-full text-left px-8 py-2 text-[11px] font-medium text-[#1A1A1A]/50 hover:text-[#5A5A40] hover:bg-[#F5F5F0] transition-colors"
                            >
                              {nested}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="min-h-[400px]">
        {(activeSubTab === 'catalog' || activeSubTab === 'trash') ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
                {activeSubTab === 'trash' ? 'Trash / Deleted Products' : 'Product Catalog'}
              </h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {statusMessage && (
                  <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
                    statusMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {statusMessage.text}
                  </div>
                )}
                
                <div className="relative flex-1 sm:flex-none">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" />
                  <input 
                    type="text"
                    placeholder={activeSubTab === 'trash' ? "Search trash..." : "Search catalog..."}
                    value={catalogSearch}
                    onChange={(e) => {
                      setCatalogSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-11 pr-4 py-3 sm:py-3.5 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 ring-[#5A5A40]/10 outline-none w-full sm:w-64 shadow-sm"
                  />
                </div>

                {activeSubTab === 'catalog' && (
                  <>
                    <div className="flex items-center gap-2 bg-white border border-[#1A1A1A]/10 rounded-2xl px-4 py-3 shadow-sm">
                      <Filter size={14} className="text-[#1A1A1A]/30" />
                      <select 
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-transparent text-sm focus:outline-none font-bold"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 bg-white border border-[#1A1A1A]/10 rounded-2xl px-4 py-3 shadow-sm">
                      <ChevronDown size={14} className="text-[#1A1A1A]/30" />
                      <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-transparent text-sm focus:outline-none font-bold"
                      >
                        <option value="newest">Newest First</option>
                        <option value="price_low">Price: Low to High</option>
                        <option value="price_high">Price: High to Low</option>
                        <option value="stock_low">Stock: Low to High</option>
                        <option value="stock_high">Stock: High to Low</option>
                      </select>
                    </div>

                    <button 
                      onClick={() => setShowAddForm(true)}
                      className="bg-[#5A5A40] text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all shadow-lg hover:shadow-xl active:scale-95 whitespace-nowrap"
                    >
                      <Plus size={20} /> Add Product
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white border border-[#1A1A1A]/10 rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F5F5F0]/50 border-b border-[#1A1A1A]/5">
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Product</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Category</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center">Purchase Price</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center">MRP</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center">Stock</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-center">Status</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]/5">
                    {paginatedProducts.length > 0 ? (
                      paginatedProducts.map((p) => (
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
                              <div className="flex flex-col">
                                <span className="font-bold text-[#1A1A1A]">{p.name}</span>
                                {p.expiryDate && (new Date(p.expiryDate).getTime() - new Date().getTime()) < (30 * 24 * 60 * 60 * 1000) && (
                                  <span className="text-[9px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                                    <AlertCircle size={10} /> Expiring {new Date(p.expiryDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
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
                            <div className="font-serif font-bold text-lg text-[#5A5A40]">
                              ₹{p.mrp}
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
                            <div className="flex justify-end gap-2">
                              {activeSubTab === 'trash' ? (
                                <>
                                  <button 
                                    onClick={() => handleRestoreProduct(p.id)}
                                    className="p-2.5 hover:bg-green-500 hover:text-white rounded-xl text-green-500 transition-all shadow-sm hover:shadow-md flex items-center gap-2 px-4"
                                    title="Restore Product"
                                  >
                                    <RefreshCw size={18} />
                                    <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Restore</span>
                                  </button>
                                  <button 
                                    onClick={() => setConfirmDeleteProduct(p.id)}
                                    className="p-2.5 hover:bg-red-500 hover:text-white rounded-xl text-red-500 transition-all shadow-sm hover:shadow-md"
                                    title="Delete Permanently"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => setEditingProduct(p)}
                                    className="p-2.5 hover:bg-[#5A5A40] hover:text-white rounded-xl text-[#5A5A40] transition-all shadow-sm hover:shadow-md"
                                  >
                                    <Settings size={18} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteProduct(p.id)}
                                    className="p-2.5 hover:bg-red-500 hover:text-white rounded-xl text-red-500 transition-all shadow-sm hover:shadow-md"
                                  >
                                    <XCircle size={18} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-24 text-center">
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

              {/* Pagination Controls */}
              {filteredProducts.length > 0 && (
                <div className="p-6 bg-[#F5F5F0]/30 border-t border-[#1A1A1A]/5 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-widest">
                    Showing {itemsPerPage === -1 ? filteredProducts.length : Math.min(itemsPerPage, filteredProducts.length - (currentPage - 1) * itemsPerPage)} of {filteredProducts.length} Products
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setItemsPerPage(itemsPerPage === -1 ? 10 : -1)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        itemsPerPage === -1 
                          ? 'bg-[#5A5A40] text-white' 
                          : 'bg-white border border-[#1A1A1A]/10 text-[#1A1A1A]/60 hover:bg-[#F5F5F0]'
                      }`}
                    >
                      {itemsPerPage === -1 ? 'Show Paginated' : 'Show All'}
                    </button>

                    {itemsPerPage !== -1 && (
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className="p-2 bg-white border border-[#1A1A1A]/10 rounded-xl text-[#1A1A1A]/60 hover:bg-[#F5F5F0] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        
                        <div className="px-4 py-2 bg-white border border-[#1A1A1A]/10 rounded-xl text-xs font-bold text-[#5A5A40]">
                          Page {currentPage} of {totalPages}
                        </div>

                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className="p-2 bg-white border border-[#1A1A1A]/10 rounded-xl text-[#1A1A1A]/60 hover:bg-[#F5F5F0] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeSubTab === 'stock_adj' ? (
          <StockAdjustment 
            products={products} 
            shopId={shopId} 
            filterIds={stockAdjFilter}
            onClearFilter={() => setStockAdjFilter(null)}
          />
        ) : activeSubTab === 'supplier' ? (
          <SupplierManager shopId={shopId} />
        ) : activeSubTab === 'purchase_order' ? (
          <PurchaseOrderManager shopId={shopId} products={products} />
        ) : activeSubTab === 'bulk' ? (
          <BulkDiscountManager shopId={shopId} products={products} />
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

      {showAddForm && (
        <ProductForm 
          shopId={shopId} 
          existingProducts={products}
          onClose={() => {
            setShowAddForm(false);
            if (onCloseAddForm) onCloseAddForm();
          }} 
        />
      )}
      {editingProduct && (
        <ProductForm 
          shopId={shopId} 
          product={editingProduct} 
          existingProducts={products}
          onClose={() => setEditingProduct(null)} 
        />
      )}
      
      <ConfirmModal 
        isOpen={!!confirmDeleteProduct}
        onClose={() => setConfirmDeleteProduct(null)}
        onConfirm={() => confirmDeleteProduct && handlePermanentDeleteProduct(confirmDeleteProduct)}
        title="Delete Product Permanently"
        message="Are you sure you want to permanently delete this product? This action cannot be undone."
      />
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
  'Vegetables & Fruits': [
    { name: 'Tomato', price: 40, unit: 'kg', image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=400' },
    { name: 'Onion', price: 35, unit: 'kg', image: 'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&q=80&w=400' },
    { name: 'Potato', price: 30, unit: 'kg', image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=400' },
    { name: 'Banana', price: 60, unit: 'doz', image: 'https://images.unsplash.com/photo-1571771894821-ad990241274d?auto=format&fit=crop&q=80&w=400' },
  ],
  'Meat': [
    { name: 'Chicken', price: 240, unit: 'kg', image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&q=80&w=400' },
    { name: 'Mutton', price: 750, unit: 'kg', image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?auto=format&fit=crop&q=80&w=400' },
    { name: 'Fish (Rohu)', price: 280, unit: 'kg', image: 'https://images.unsplash.com/photo-1534043464124-3be32fe000c9?auto=format&fit=crop&q=80&w=400' },
    { name: 'Eggs', price: 72, unit: 'doz', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&q=80&w=400' },
  ],
  'Books': [
    { name: 'Notebook (A4)', price: 60, unit: 'pc', image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&q=80&w=400' },
    { name: 'Ball Pen (Blue)', price: 10, unit: 'pc', image: 'https://images.unsplash.com/photo-1585336139118-89ce350843f8?auto=format&fit=crop&q=80&w=400' },
    { name: 'Drawing Book', price: 45, unit: 'pc', image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400' },
    { name: 'Geometry Box', price: 120, unit: 'pc', image: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&q=80&w=400' },
  ]
};

function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Delete", 
  confirmColor = "bg-red-500" 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string, 
  confirmText?: string, 
  confirmColor?: string 
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#F5F5F0] w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20"
      >
        <div className="p-8 space-y-6">
          <div className="flex items-center gap-4 text-red-500">
            <div className="p-3 bg-red-100 rounded-2xl">
              <AlertTriangle size={24} />
            </div>
            <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">{title}</h3>
          </div>
          
          <p className="text-sm text-[#1A1A1A]/60 leading-relaxed">
            {message}
          </p>

          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-4 bg-white border border-[#1A1A1A]/10 text-[#1A1A1A]/60 rounded-2xl text-sm font-bold hover:bg-[#1A1A1A]/5 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 py-4 ${confirmColor} text-white rounded-2xl text-sm font-bold hover:opacity-90 transition-all shadow-lg`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ProductForm({ shopId, product, onClose, existingProducts }: { shopId: string, product?: Product, onClose: () => void, existingProducts?: Product[] }) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    price: product?.price.toString() || '',
    mrp: product?.mrp.toString() || '',
    unit: product?.unit || 'kg',
    category: product?.category || 'Grocery',
    stock: product?.stock.toString() || '100',
    lowStockThreshold: product?.lowStockThreshold?.toString() || '10',
    expiryDate: product?.expiryDate || '',
    description: '',
    image: product?.image || ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning', text: string } | null>(null);

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

    // Check for duplicates if adding a new product
    if (!product && existingProducts) {
      const isDuplicate = existingProducts.some(p => 
        p.name.toLowerCase().trim() === formData.name.toLowerCase().trim() && 
        p.unit === formData.unit
      );
      
      if (isDuplicate) {
        setStatusMessage({ 
          type: 'warning', 
          text: `Duplicate Product Warning: A product named "${formData.name}" with unit "${formData.unit}" already exists in your inventory. Please update the existing product instead.` 
        });
        return;
      }
    }

    setSubmitting(true);
    setStatusMessage(null);
    try {
      const productData: any = {
        shopId,
        name: formData.name,
        price: Number(formData.price),
        mrp: Number(formData.mrp || formData.price),
        unit: formData.unit,
        category: formData.category,
        stock: Number(formData.stock),
        lowStockThreshold: Number(formData.lowStockThreshold),
        expiryDate: formData.expiryDate || null,
        status: Number(formData.stock) > 0 ? 'active' : 'out_of_stock',
        image: formData.image || null,
        createdAt: product?.createdAt || new Date().toISOString()
      };
      
      if (product) {
        await updateDoc(doc(db, 'products', product.id), productData);
        setStatusMessage({ type: 'success', text: "Product updated successfully!" });
      } else {
        // Ensure we are adding to the correct collection
        const productsRef = collection(db, 'products');
        await addDoc(productsRef, productData);
        setStatusMessage({ type: 'success', text: "Product added successfully!" });
      }
      
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Error saving product:", err);
      setStatusMessage({ type: 'error', text: err.message });
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
          <h3 className="font-serif text-2xl font-bold">{product ? 'Edit Product' : 'Add New Product'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-full"><X size={24} /></button>
        </div>

        {statusMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-8 p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${
              statusMessage.type === 'success' ? 'bg-green-100 text-green-700' : 
              statusMessage.type === 'warning' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}
          >
            {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : 
             statusMessage.type === 'warning' ? <AlertCircle size={18} /> :
             <AlertCircle size={18} />}
            {statusMessage.text}
          </motion.div>
        )}

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
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Category</label>
                  <select 
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
                  >
                    {ALL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Purchase Price (₹)</label>
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
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">MRP (Selling Price) (₹)</label>
                    <input 
                      type="number" 
                      value={formData.mrp}
                      onChange={(e) => setFormData({...formData, mrp: e.target.value})}
                      className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
                      placeholder="100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
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
                      <option>ml</option>
                      <option>500ml</option>
                      <option>pkt</option>
                      <option>pc</option>
                      <option>pcs</option>
                      <option>doz</option>
                      <option>bundle</option>
                      <option>box</option>
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
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Low Stock Alert</label>
                    <input 
                      type="number" 
                      value={formData.lowStockThreshold}
                      onChange={(e) => setFormData({...formData, lowStockThreshold: e.target.value})}
                      className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
                      placeholder="10"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Expiry Date</label>
                    <input 
                      type="date" 
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
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
                {submitting ? 'Saving...' : product ? 'Update Product' : 'Add Product'}
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
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'online' | 'walk-in'>('all');
  const [activeSubTab, setActiveSubTab] = useState('manage');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    let q;
    if (selectedDate) {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      q = query(
        collection(db, 'orders'), 
        where('shopId', '==', shopId), 
        where('createdAt', '>=', startOfDay.toISOString()),
        where('createdAt', '<=', endOfDay.toISOString()),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(collection(db, 'orders'), where('shopId', '==', shopId), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });
    return () => unsubscribe();
  }, [shopId, selectedDate]);

  const updateStatus = async (orderId: string, status: Order['status']) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      // Reduce stock only when transitioning TO delivered
      if (status === 'delivered' && order.status !== 'delivered') {
        for (const item of order.items) {
          try {
            const productRef = doc(db, 'products', item.productId);
            await updateDoc(productRef, {
              stock: increment(-item.quantity)
            });
          } catch (err: any) {
            handleFirestoreError(err, OperationType.UPDATE, `products/${item.productId}`);
          }
        }
      }

      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      order.deliveryAddress.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || order.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const menuItems = [
    { id: 'manage', label: 'Manage Orders', icon: <ClipboardList size={18} /> },
    { 
      id: 'sale', 
      label: 'Sale', 
      icon: <Receipt size={18} />,
      subItems: ['Direct', 'Sale Return Against Bill']
    },
    { id: 'cancel', label: 'Cancel Order', icon: <XCircle size={18} /> },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Sub-Navigation */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-[#1A1A1A]/10 rounded-[2rem] p-2 shadow-sm relative z-50">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSubTab(item.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${
              activeSubTab === item.id 
                ? 'bg-[#5A5A40] text-white shadow-md' 
                : 'text-[#1A1A1A]/60 hover:bg-[#F5F5F0] hover:text-[#5A5A40]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h3 className="font-serif text-2xl font-bold">
            {activeSubTab === 'manage' ? 'Manage Orders' : 
             activeSubTab === 'sale' ? 'Sales Management' : 'Cancelled Orders'}
          </h3>
          <div className="relative">
            <button className="p-2 hover:bg-[#F5F5F0] rounded-full text-[#5A5A40] transition-all shadow-sm border border-[#1A1A1A]/5">
              <Calendar size={20} />
            </button>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="Select Date"
            />
          </div>
          <span className="text-xs font-bold text-[#5A5A40] bg-[#5A5A40]/10 px-3 py-1 rounded-full hidden sm:inline-block">
            {new Date(selectedDate).toLocaleDateString()}
          </span>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" size={16} />
            <input 
              type="text" 
              placeholder="Search ID, product, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-[#1A1A1A]/10 rounded-xl focus:outline-none text-sm w-full sm:w-64"
            />
          </div>
          
          <div className="flex items-center gap-2 bg-white border border-[#1A1A1A]/10 rounded-xl px-3 py-2">
            <Filter size={14} className="text-[#1A1A1A]/30" />
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-transparent text-sm focus:outline-none font-bold"
            >
              <option value="all">All Orders</option>
              <option value="online">Online Only</option>
              <option value="walk-in">Walk-in Only</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {activeSubTab === 'manage' ? (
          filteredOrders.length > 0 ? (
            filteredOrders.map((order) => (
              <div key={order.id} className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-6 flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="flex items-center flex-wrap gap-3 mb-4">
                    <span className="text-xs font-bold text-[#1A1A1A]/40 uppercase tracking-widest">Order #{order.id.slice(-6).toUpperCase()}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
                      order.type === 'walk-in' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                    }`}>
                      {order.type === 'walk-in' ? 'Walk-in' : 'Online'}
                    </span>
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
                        <span>{i + 1}. {item.name} {item.quantity}{item.unit && /^\d/.test(item.unit) ? ' x ' : ''}{item.unit || (['mutton', 'chicken', 'atta', 'flour', 'rice', 'dal', 'wheat', 'sugar', 'salt'].some(k => item.name.toLowerCase().includes(k)) ? 'kg' : '')}</span>
                        <span className="font-bold">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t border-[#1A1A1A]/5 space-y-2">
                    {order.subtotal !== undefined ? (
                      <>
                        <div className="flex justify-between text-xs text-[#1A1A1A]/40 font-bold uppercase tracking-widest">
                          <span>Subtotal</span>
                          <span>₹{order.subtotal.toFixed(2)}</span>
                        </div>
                        {order.itemDiscounts > 0 && (
                          <div className="flex justify-between text-xs text-green-600 font-bold uppercase tracking-widest">
                            <span>Item Offers</span>
                            <span>- ₹{order.itemDiscounts.toFixed(2)}</span>
                          </div>
                        )}
                        {order.billDiscount > 0 && (
                          <div className="flex justify-between text-xs text-green-600 font-bold uppercase tracking-widest">
                            <span>Bill Offer</span>
                            <span>- ₹{order.billDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        {order.totalDiscount > 0 && (
                          <div className="flex justify-between text-xs text-red-500 font-bold uppercase tracking-widest pt-1 border-t border-dashed border-[#1A1A1A]/5">
                            <span>Total Discount</span>
                            <span>₹{order.totalDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t border-[#1A1A1A]/5">
                          <span className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40">Total</span>
                          <span className="text-xl font-serif font-bold">₹{order.total.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40">Total</span>
                        <span className="text-xl font-serif font-bold">₹{order.total.toFixed(2)}</span>
                      </div>
                    )}
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
                  {order.status === 'rejected' && (
                    <div className="text-center py-3 bg-red-50 text-red-700 rounded-xl flex items-center justify-center gap-2">
                      <XCircle size={16} /> <span className="text-sm font-bold uppercase tracking-widest">Rejected</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center bg-white border border-[#1A1A1A]/10 rounded-3xl">
              <p className="text-[#1A1A1A]/30 italic">No orders found for this date.</p>
            </div>
          )
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
              The {menuItems.find(i => i.id === activeSubTab)?.label} module is now managed under the Orders section. 
              This allows you to handle {menuItems.find(i => i.id === activeSubTab)?.label.toLowerCase()} operations alongside your order workflow.
            </p>
            <button 
              onClick={() => setActiveSubTab('manage')}
              className="mt-10 text-[#5A5A40] font-bold flex items-center gap-2 mx-auto hover:underline"
            >
              <ArrowLeft size={18} /> Back to Manage Orders
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon, onClick }: { label: string, value: string, icon: React.ReactNode, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white border border-[#1A1A1A]/10 rounded-2xl p-4 flex flex-col items-center text-center sm:items-start sm:text-left shadow-sm ${onClick ? 'cursor-pointer hover:border-[#5A5A40] hover:shadow-md transition-all' : ''}`}
    >
      <div className="text-[#5A5A40] mb-2 scale-75 sm:scale-100">{icon}</div>
      <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-1 leading-tight">{label}</p>
      <p className="text-lg sm:text-3xl font-serif font-bold">{value}</p>
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
    pincode: '',
    city: '',
    state: '',
    category: 'Grocery',
    timings: '9 AM - 9 PM',
    locationName: '',
    lat: null as number | null,
    lng: null as number | null,
    deliveryRadius: 3
  });
  const [detecting, setDetecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const detectLocation = () => {
    setDetecting(true);
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }));
        setDetecting(false);
      },
      (error) => {
        alert("Unable to retrieve your location: " + error.message);
        setDetecting(false);
      }
    );
  };

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
        pincode: formData.pincode,
        city: formData.city,
        state: formData.state,
        category: formData.category,
        status: 'pending',
        timings: formData.timings,
        locationName: formData.locationName,
        location: formData.lat && formData.lng ? {
          lat: formData.lat,
          lng: formData.lng
        } : undefined,
        deliveryRadius: formData.deliveryRadius,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'shops'), shopData);
      alert("Shop registration submitted! It will be visible once approved by an administrator.");
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
        className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif text-2xl font-bold">Register Your Shop</h3>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F0] rounded-full text-[#1A1A1A]/40">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
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
                <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Category</label>
                <select 
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
                >
                  {ALL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
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

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Delivery Radius (km)</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    step="1"
                    value={formData.deliveryRadius}
                    onChange={(e) => setFormData({...formData, deliveryRadius: Number(e.target.value)})}
                    className="flex-1 accent-[#5A5A40]"
                  />
                  <span className="w-12 text-center font-bold text-[#5A5A40] bg-[#F5F5F0] py-2 rounded-xl">
                    {formData.deliveryRadius}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Full Address</label>
                <textarea 
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/20 min-h-[100px]"
                  placeholder="Street, Landmark, Area..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Pincode</label>
                  <input 
                    required
                    type="text" 
                    value={formData.pincode}
                    onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                    className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
                    placeholder="600001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">City</label>
                  <input 
                    required
                    type="text" 
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none"
                    placeholder="Chennai"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">GPS Location</label>
                <div className="flex gap-2">
                  <div className="flex-1 p-3 bg-[#F5F5F0] rounded-2xl text-[10px] font-mono text-[#1A1A1A]/60 flex items-center justify-center border border-dashed border-[#1A1A1A]/10">
                    {formData.lat ? `${formData.lat.toFixed(4)}, ${formData.lng?.toFixed(4)}` : "Not detected"}
                  </div>
                  <button 
                    type="button"
                    onClick={detectLocation}
                    disabled={detecting}
                    className="px-4 py-2 bg-[#5A5A40] text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#4A4A30] transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <MapPin size={14} />
                    {detecting ? "Detecting..." : "Detect"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Market Area (Custom Location)</label>
                <input 
                  required
                  type="text" 
                  value={formData.locationName}
                  onChange={(e) => setFormData({...formData, locationName: e.target.value})}
                  className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/20"
                  placeholder="e.g. Green Valley, Central Market"
                />
              </div>
            </div>
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
              className="flex-[2] p-4 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/20 disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Submit Registration'}
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
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'users' | 'owners'>('pending');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (!user) return;

    const qPending = query(collection(db, 'shops'), where('status', '==', 'pending'));
    const qAll = query(collection(db, 'shops'));
    
    const unsubPending = onSnapshot(qPending, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
      setPendingShops(list);
      setLoading(false);
    }, (error: any) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'shops (pending)');
      }
    });

    const unsubAll = onSnapshot(qAll, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
      setAllShops(list);
    }, (error: any) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'shops (all)');
      }
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(list);
    }, (error: any) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    });

    return () => {
      unsubPending();
      unsubAll();
      unsubUsers();
    };
  }, [user?.uid]);

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
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
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

  const handleToggleMultiLocation = async (userId: string, enabled: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        multiLocationEnabled: enabled,
        multiLocationRequestStatus: enabled ? 'approved' : 'none'
      });
      setStatusMessage({ type: 'success', text: `Multi-location ${enabled ? 'enabled' : 'disabled'} for user.` });
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
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          {statusMessage && (
            <div className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
              statusMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {statusMessage.text}
            </div>
          )}
          <button 
            onClick={handleApproveAll}
            className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
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

      <div className="flex gap-4 mb-6 border-b border-[#1A1A1A]/10 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('pending')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all relative shrink-0 ${activeTab === 'pending' ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/40'}`}
        >
          Pending Approvals ({pendingShops.length})
          {activeTab === 'pending' && <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
        </button>
        <button 
          onClick={() => setActiveTab('all')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all relative shrink-0 ${activeTab === 'all' ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/40'}`}
        >
          All Shops ({allShops.length})
          {activeTab === 'all' && <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
        </button>
        <button 
          onClick={() => setActiveTab('owners')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all relative shrink-0 ${activeTab === 'owners' ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/40'}`}
        >
          Owners ({users.filter(u => u.role === 'owner').length})
          {users.some(u => u.role === 'owner' && u.multiLocationRequestStatus === 'pending') && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          )}
          {activeTab === 'owners' && <motion.div layoutId="admin-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]" />}
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all relative shrink-0 ${activeTab === 'users' ? 'text-[#5A5A40]' : 'text-[#1A1A1A]/40'}`}
        >
          Users ({users.filter(u => u.role !== 'owner').length})
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
          ) : (activeTab === 'users' || activeTab === 'owners') ? (
            <div className="p-6">
              <div className="mb-6 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30" size={16} />
                <input 
                  type="text" 
                  placeholder={`Search ${activeTab === 'owners' ? 'owners' : 'users'} by email or name...`}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-2 bg-[#F5F5F0] rounded-2xl focus:outline-none focus:ring-2 ring-[#5A5A40]/10 transition-all text-sm"
                />
              </div>
              <div className="space-y-4">
                {users.filter(u => {
                  const matchesSearch = u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
                                      u.displayName?.toLowerCase().includes(userSearch.toLowerCase());
                  const matchesTab = activeTab === 'owners' ? u.role === 'owner' : u.role !== 'owner';
                  return matchesSearch && matchesTab;
                }).map(u => (
                  <div key={u.uid} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-[#F5F5F0]/30 rounded-2xl border border-[#1A1A1A]/5 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {u.displayName?.[0] || 'U'}
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-bold text-sm truncate">{u.displayName || 'User'}</h5>
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
                      <select 
                        value={u.role}
                        onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as UserRole)}
                        className="flex-1 sm:flex-none text-[10px] font-bold uppercase tracking-widest bg-white border border-[#1A1A1A]/10 px-2 py-2 rounded-xl focus:outline-none"
                      >
                        <option value="customer">Customer</option>
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                      </select>
                      
                      {u.role === 'owner' && (
                        <button
                          onClick={() => handleToggleMultiLocation(u.uid, !u.multiLocationEnabled)}
                          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                            u.multiLocationEnabled 
                              ? 'bg-green-100 text-green-700 border border-green-200' 
                              : u.multiLocationRequestStatus === 'pending'
                              ? 'bg-amber-100 text-amber-700 border border-amber-200 animate-pulse'
                              : 'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}
                        >
                          {u.multiLocationEnabled ? <Lock size={10} className="opacity-50" /> : <Lock size={10} />}
                          <span className="whitespace-nowrap">
                            {u.multiLocationEnabled ? 'Multi-Loc: ON' : u.multiLocationRequestStatus === 'pending' ? 'Approve Multi-Loc' : 'Multi-Loc: OFF'}
                          </span>
                        </button>
                      )}
                      
                      {deletingUser === u.uid ? (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button 
                            onClick={() => handleDeleteUser(u.uid)}
                            className="flex-1 sm:flex-none px-3 py-2 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button 
                            onClick={() => setDeletingUser(null)}
                            className="flex-1 sm:flex-none px-3 py-2 bg-[#F5F5F0] text-[#1A1A1A]/60 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#E5E5E0]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeletingUser(u.uid)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
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
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingShops.map((shop) => (
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
                          <p className="text-xs font-bold">{shop.deliveryRadius || 3} km</p>
                        </div>
                        <div className="bg-white/50 p-2 rounded-xl border border-[#1A1A1A]/5">
                          <p className="text-[8px] font-bold text-[#1A1A1A]/40 uppercase tracking-widest">GPS</p>
                          <p className="text-[10px] font-mono">{shop.location ? 'SET' : 'MISSING'}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3 mt-auto">
                        <input 
                          type="text"
                          placeholder="Set Market Area"
                          defaultValue={shop.locationName || ''}
                          onBlur={(e) => handleUpdateLocation(shop.id, e.target.value)}
                          className="w-full text-[10px] font-bold uppercase tracking-widest bg-white border border-[#1A1A1A]/10 px-3 py-2 rounded-xl text-[#5A5A40] focus:outline-none"
                        />

                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleReject(shop.id)}
                            className="flex-1 py-2 border border-red-200 text-red-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-all"
                          >
                            Reject
                          </button>
                          <button 
                            onClick={() => handleApprove(shop.id)}
                            className="flex-1 py-2 bg-green-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all shadow-sm"
                          >
                            Approve
                          </button>
                        </div>
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
          ) : (
            allShops.length > 0 ? (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {allShops.map((shop) => (
                  <div key={shop.id} className="bg-white rounded-3xl border border-[#1A1A1A]/5 overflow-hidden flex flex-col group hover:shadow-md transition-all">
                    <div className="aspect-[4/3] bg-[#F5F5F0] relative overflow-hidden">
                      {shop.logo ? (
                        <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#5A5A40]/20">
                          <Store size={48} />
                        </div>
                      )}
                      <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border ${
                        shop.status === 'approved' ? 'bg-green-100 text-green-700 border-green-200' : 
                        shop.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                        'bg-red-100 text-red-700 border-red-200'
                      }`}>
                        {shop.status}
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h4 className="font-bold text-base mb-1 truncate">{shop.name}</h4>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] text-[#1A1A1A]/40 flex items-center gap-1">
                          <MapPin size={10} /> {shop.locationName || 'No Location'}
                        </p>
                        <p className="text-[10px] font-bold text-[#5A5A40]">
                          {shop.pincode}
                        </p>
                      </div>
                      
                      <div className="mt-auto space-y-2">
                        <input 
                          type="text"
                          placeholder="Change Market Area"
                          defaultValue={shop.locationName || ''}
                          onBlur={(e) => handleUpdateLocation(shop.id, e.target.value)}
                          className="w-full text-[9px] font-bold uppercase tracking-widest bg-[#F5F5F0] border-none px-2 py-1.5 rounded-lg text-[#5A5A40] focus:outline-none"
                        />
                        <div className="flex gap-2">
                          {shop.status !== 'approved' && (
                            <button 
                              onClick={() => handleApprove(shop.id)}
                              className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-green-700"
                            >
                              Approve
                            </button>
                          )}
                          {shop.status !== 'rejected' && (
                            <button 
                              onClick={() => handleReject(shop.id)}
                              className="flex-1 py-1.5 border border-red-100 text-red-600 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-red-50"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-20 text-center text-[#1A1A1A]/30">
                <Store size={48} className="mx-auto mb-4 opacity-20" />
                <p>No shops found.</p>
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
                  {s.name} | Status: {s.status} | Loc: {s.locationName || 'NONE'} | Pin: {s.pincode || 'N/A'} | GPS: {s.location ? 'YES' : 'NO'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileView({ user, profile, onLogout, onUpdateProfile }: { 
  user: FirebaseUser, 
  profile: UserProfile, 
  onLogout: () => void,
  onUpdateProfile: (p: UserProfile) => void 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editData, setEditData] = useState({
    displayName: profile.displayName,
    phone: profile.phone || '',
    address: profile.address || ''
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert("File is too large. Please upload an image smaller than 1MB.");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        await updateProfile(user, { photoURL: base64String });
        await updateDoc(doc(db, 'users', user.uid), { photoURL: base64String });
        onUpdateProfile({ ...profile, photoURL: base64String });
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert("Error uploading photo: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateProfile(user, { displayName: editData.displayName });
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editData.displayName,
        phone: editData.phone,
        address: editData.address
      });
      onUpdateProfile({
        ...profile,
        displayName: editData.displayName,
        phone: editData.phone,
        address: editData.address
      });
      setIsEditing(false);
    } catch (err: any) {
      alert("Error saving profile: " + err.message);
    }
  };

  const handleChangePassword = async () => {
    try {
      await sendPasswordResetEmail(auth, user.email!);
      alert("Password reset email sent to " + user.email);
    } catch (err: any) {
      alert("Error sending reset email: " + err.message);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-8 max-w-2xl mx-auto"
    >
      <div className="bg-white border border-[#1A1A1A]/10 rounded-3xl p-8 shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <div 
            className="w-24 h-24 bg-[#5A5A40] rounded-full flex items-center justify-center text-white text-4xl font-serif mb-4 overflow-hidden relative group cursor-pointer"
            onClick={() => document.getElementById('photo-upload')?.click()}
          >
            {user.photoURL ? <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" /> : user.displayName?.[0]}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white" size={24} />
            </div>
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <RefreshCw className="text-white animate-spin" size={24} />
              </div>
            )}
          </div>
          <input 
            id="photo-upload" 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handlePhotoUpload}
            disabled={isUploading}
          />
          
          {isEditing ? (
            <input 
              type="text"
              value={editData.displayName}
              onChange={(e) => setEditData({...editData, displayName: e.target.value})}
              className="font-serif text-3xl font-bold text-center bg-[#F5F5F0] border-none focus:ring-2 ring-[#5A5A40]/20 rounded-xl px-4 py-1"
            />
          ) : (
            <h2 className="font-serif text-3xl font-bold">{user.displayName || 'User'}</h2>
          )}
          <p className="text-[#5A5A40] font-bold uppercase tracking-widest text-xs mt-1">{profile.role}</p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center py-4 border-b border-[#1A1A1A]/5">
            <span className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A]/40">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          
          <div className="flex justify-between items-center py-4 border-b border-[#1A1A1A]/5">
            <span className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A]/40">Phone</span>
            {isEditing ? (
              <input 
                type="tel"
                value={editData.phone}
                onChange={(e) => setEditData({...editData, phone: e.target.value})}
                placeholder="Enter phone number"
                className="font-medium text-right bg-[#F5F5F0] border-none rounded-lg px-3 py-1 focus:ring-2 ring-[#5A5A40]/20"
              />
            ) : (
              <span className={`font-medium ${!profile.phone ? 'text-[#1A1A1A]/40 italic' : ''}`}>
                {profile.phone || 'Not provided'}
              </span>
            )}
          </div>

          <div className="flex justify-between items-center py-4 border-b border-[#1A1A1A]/5">
            <span className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A]/40">Address</span>
            {isEditing ? (
              <input 
                type="text"
                value={editData.address}
                onChange={(e) => setEditData({...editData, address: e.target.value})}
                placeholder="Enter address"
                className="font-medium text-right bg-[#F5F5F0] border-none rounded-lg px-3 py-1 focus:ring-2 ring-[#5A5A40]/20"
              />
            ) : (
              <span className={`font-medium ${!profile.address ? 'text-[#1A1A1A]/40 italic' : ''}`}>
                {profile.address || 'Not provided'}
              </span>
            )}
          </div>

          <div className="flex justify-between items-center py-4 border-b border-[#1A1A1A]/5">
            <span className="text-sm font-bold uppercase tracking-widest text-[#1A1A1A]/40">Joined</span>
            <span className="font-medium">{new Date(profile.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="mt-12 space-y-4">
          {isEditing ? (
            <div className="flex gap-4">
              <button 
                onClick={handleSave}
                className="flex-1 bg-[#5A5A40] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all shadow-lg"
              >
                <CheckCircle2 size={20} /> Save Changes
              </button>
              <button 
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-[#F5F5F0] text-[#1A1A1A]/60 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#E5E5E0] transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all shadow-lg"
            >
              <Settings size={20} /> Edit Profile
            </button>
          )}

          <button 
            onClick={handleChangePassword}
            className="w-full bg-[#F5F5F0] text-[#5A5A40] py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#E5E5E0] transition-all"
          >
            <RefreshCw size={20} /> Change Password
          </button>

          <button 
            onClick={onLogout}
            className="w-full bg-red-50 text-red-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all"
          >
            <LogOut size={20} /> Sign Out
          </button>
        </div>
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
  const total = cart.reduce((sum, item) => sum + (item.product.mrp * item.quantity), 0);

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
                <p className="text-xs text-[#1A1A1A]/40 mb-2">₹{item.product.mrp} / {item.product.unit}</p>
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
                ₹{item.product.mrp * item.quantity}
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
