// Delivery-address input with: manual entry, "Use current location" (GPS +
// reverse geocode), and a "Select address" panel listing previously used
// addresses (remembered in localStorage) plus quick "Add address" / "Use
// current location" actions.
import { useState, useRef, useEffect } from 'react';
import { Navigation, Loader2, ChevronDown, Plus, MapPin, Check } from 'lucide-react';

const LS_KEY = 'hsi_saved_addresses';

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

// Persist an address to the recent list (call after a successful order).
export function rememberAddress(addr) {
  const a = (addr || '').trim();
  if (a.length < 10) return;
  try {
    const next = [a, ...loadSaved().filter(x => x !== a)].slice(0, 5);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export default function AddressPicker({ value, onChange }) {
  const [locating, setLocating] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(loadSaved());
  const [savedMsg, setSavedMsg] = useState(false);
  const taRef = useRef(null);
  const wrapRef = useRef(null);

  // close the panel on outside click
  useEffect(() => {
    const onDoc = (e) => { if (open && wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const useCurrent = () => {
    setOpen(false);
    if (!navigator.geolocation) { alert('Geolocation is not supported on this device.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, { headers: { Accept: 'application/json' } });
          const data = await r.json();
          onChange(data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } catch {
          onChange(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } finally { setLocating(false); }
      },
      (err) => { alert('Could not get your location: ' + err.message); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Save the address currently in the box to history so it can be reused later.
  const addCurrent = () => {
    const a = (value || '').trim();
    if (a.length < 10) { alert('Please type or pick an address first (at least 10 characters), then tap Add address.'); return; }
    rememberAddress(a);
    setSaved(loadSaved());
    setOpen(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };
  const pick = (a) => { onChange(a); setOpen(false); };

  return (
    <div ref={wrapRef}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Delivery Address</p>

      <textarea
        ref={taRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        placeholder="Flat / house no, street, area, landmark…"
        className="w-full resize-none rounded-xl border border-[#1A1A1A]/10 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40 focus:border-[#5A5A40]/40 placeholder-[#1A1A1A]/30"
      />

      {/* options under the box: current location and select address, side by side */}
      <div className="flex items-center gap-5 mt-2">
        <button type="button" onClick={useCurrent} disabled={locating}
          className="flex items-center gap-1 text-[11px] font-bold text-[#5A5A40] hover:underline disabled:opacity-50">
          {locating ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
          {locating ? 'Locating…' : 'Use current location'}
        </button>

        <div className="relative">
          <button type="button" onClick={() => { setSaved(loadSaved()); setOpen(o => !o); }}
            className="flex items-center gap-1 text-[11px] font-bold text-[#1A1A1A]/55 hover:text-[#5A5A40]">
            Select address <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="absolute z-30 left-0 bottom-full mb-1 w-64 max-w-[78vw] bg-white border border-[#1A1A1A]/10 rounded-xl shadow-lg overflow-hidden">
              {saved.length > 0 && (
                <div className="max-h-40 overflow-y-auto border-b border-[#1A1A1A]/6">
                  {saved.map((a, i) => (
                    <button key={i} type="button" onClick={() => pick(a)}
                      className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-[#F5F5F0] transition-colors">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-[#5A5A40]/60" />
                      <span className="text-[12px] text-[#1A1A1A]/75 line-clamp-2 flex-1">{a}</span>
                      {value === a && <Check size={14} className="shrink-0 text-[#5A5A40]" />}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={addCurrent}
                className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-[12px] font-semibold text-[#1A1A1A]/70 hover:bg-[#F5F5F0] transition-colors">
                <Plus size={14} className="text-[#5A5A40]" /> Add address
              </button>
              <button type="button" onClick={useCurrent}
                className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-[12px] font-semibold text-[#1A1A1A]/70 hover:bg-[#F5F5F0] transition-colors border-t border-[#1A1A1A]/6">
                <Navigation size={14} className="text-[#5A5A40]" /> Use current location
              </button>
            </div>
          )}
        </div>
      </div>
      {savedMsg && <span className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#5A7C59]"><Check size={12} /> Address saved</span>}
    </div>
  );
}
