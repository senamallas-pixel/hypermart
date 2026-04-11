export default function ActionButton({ icon: Icon, label, color = 'bg-[#5A5A40]', textColor = 'text-white', onClick }) {
  return (
    <button
      onClick={onClick}
      className={`${color} ${textColor} p-4 rounded-2xl flex flex-col items-center gap-2 shadow-sm hover:opacity-90 transition-all`}
    >
      <Icon size={22} />
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}
