// Plain Tailwind spinner shown while the heavy 3D chunk downloads.
// IMPORTANT: no three.js import here — this must ship in the main bundle.
export default function Store3DLoader() {
  return (
    <div className="w-full h-[70vh] rounded-3xl border border-[#1A1A1A]/8 bg-[#EFEFE8] flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-[#5A5A40]/20 border-t-[#5A5A40] rounded-full animate-spin" />
      <p className="text-[#1A1A1A]/40 font-serif italic text-sm">Loading 3D store…</p>
    </div>
  );
}
