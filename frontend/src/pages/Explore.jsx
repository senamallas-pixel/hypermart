// All-Categories explore page (mobile-first category browser).
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Heart, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';

// Each item maps a display label to a real ShopCategory used for filtering.
const GROUPS = [
  {
    title: 'Grocery & Kitchen',
    items: [
      { cat: 'Vegetables & Fruits', label: 'Vegetables & Fruits', img: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=300&q=80' },
      { cat: 'Dairy',               label: 'Dairy, Bread & Eggs',  img: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=300&q=80' },
      { cat: 'Grocery',             label: 'Atta, Rice, Oil & Dals', img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&q=80' },
      { cat: 'Meat',                label: 'Meat, Fish & Eggs',    img: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=300&q=80' },
    ],
  },
  {
    title: 'Snacks & Drinks',
    items: [
      { cat: 'Bakery & Snacks', label: 'Bakery & Snacks', img: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=300&q=80' },
      { cat: 'Beverages',       label: 'Beverages & Juices', img: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&q=80' },
    ],
  },
  {
    title: 'Household & Personal Care',
    items: [
      { cat: 'Household',     label: 'Household & Cleaning', img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&q=80' },
      { cat: 'Personal Care', label: 'Personal Care',       img: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=300&q=80' },
    ],
  },
];

export default function Explore() {
  const navigate = useNavigate();
  const { setSearch } = useApp();

  const openCategory = (cat) => {
    setSearch(cat);          // marketplace filters + scrolls to this category
    navigate('/marketplace');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto px-4 py-6 pb-24">
      {/* Title row */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold">All Categories</h1>
        <div className="flex items-center gap-2">
          <button title="Favorites" className="w-10 h-10 rounded-full bg-white border border-[#1A1A1A]/8 shadow-sm flex items-center justify-center text-[#5A5A40] hover:bg-[#F5F5F0] transition-colors">
            <Heart size={18} />
          </button>
          <button title="Search" onClick={() => navigate('/marketplace')} className="w-10 h-10 rounded-full bg-white border border-[#1A1A1A]/8 shadow-sm flex items-center justify-center text-[#5A5A40] hover:bg-[#F5F5F0] transition-colors">
            <Search size={18} />
          </button>
        </div>
      </div>

      {GROUPS.map((group) => (
        <section key={group.title} className="mb-9">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-5 rounded-full bg-[#5A5A40]" />
            <h2 className="text-lg font-bold">{group.title}</h2>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-x-3 gap-y-5">
            {group.items.map((it) => (
              <button key={it.label} onClick={() => openCategory(it.cat)} className="group flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                <div className="w-full aspect-square rounded-2xl overflow-hidden bg-[#EDEDE4] border border-[#1A1A1A]/5 shadow-sm">
                  <img src={it.img} alt={it.label} loading="lazy" referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
                <span className="text-[11px] font-semibold text-center leading-tight text-[#1A1A1A]/80">{it.label}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </motion.div>
  );
}
