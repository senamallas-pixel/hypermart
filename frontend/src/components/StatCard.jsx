import { motion } from 'motion/react';

export default function StatCard({ icon: Icon, label, value, sub, accent, onClick }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300 }}
      onClick={onClick}
      className={`bg-white border border-[#1A1A1A]/5 rounded-3xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-xl transition-shadow duration-300${onClick ? ' cursor-pointer' : ''}`}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${accent || 'bg-[#5A5A40]/10'}`}>
        <Icon size={24} className="text-[#5A5A40]" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A]/40 mb-1">{label}</p>
        <p className="font-serif text-3xl font-bold">{value}</p>
        {sub && <p className="text-xs text-[#1A1A1A]/40 mt-1">{sub}</p>}
      </div>
    </motion.div>
  );
}
