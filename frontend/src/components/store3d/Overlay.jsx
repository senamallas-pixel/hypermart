// DOM chrome layered over a 3D scene: Beta badge + auto-hiding gesture hint.
import { useState, useEffect } from 'react';

export default function Overlay({ extra }) {
  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 4500);
    return () => clearTimeout(t);
  }, []);
  return (
    <>
      <span className="absolute top-3 right-3 z-10 px-2 py-1 rounded-full bg-[#4A7C59] text-white text-[10px] font-bold shadow-md pointer-events-none">
        3D · Beta
      </span>
      {showHint && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-black/55 text-white text-[11px] font-medium backdrop-blur-sm pointer-events-none whitespace-nowrap">
          Drag to look · pinch to zoom · tap to open
        </div>
      )}
      {extra}
    </>
  );
}

export function MoreNote({ n }) {
  if (!n || n <= 0) return null;
  return (
    <span className="absolute top-3 left-3 z-10 px-2 py-1 rounded-full bg-white/90 text-[#1A1A1A]/60 text-[10px] font-semibold shadow-sm pointer-events-none">
      +{n} more — switch to 2D to see all
    </span>
  );
}
