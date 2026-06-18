// Decide whether a shop is open *right now* from its `timings` string
// (e.g. "8 AM – 1 PM", "9:00 AM – 9:00 PM"). Handles AM/PM, optional minutes,
// en-dash or hyphen separators, and overnight ranges (e.g. "6 PM – 2 AM").

function parseTime(str) {
  const m = String(str || '').trim().match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

// Returns true/false from a timings string, or null if it can't be parsed.
export function isWithinTimings(timings, now = new Date()) {
  if (!timings) return null;
  const parts = String(timings).split(/[–—-]/);
  if (parts.length < 2) return null;
  const open = parseTime(parts[0]);
  const close = parseTime(parts[1]);
  if (open == null || close == null) return null;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (close === open) return true;                 // treat as 24h
  if (close > open) return cur >= open && cur < close;   // same-day window
  return cur >= open || cur < close;               // overnight window
}

// Full open/closed decision for a shop, considering manual flag + timings.
export function isShopOpenNow(shop, now = new Date()) {
  if (!shop) return false;
  if (shop.is_open === 0 || shop.is_open === false) return false; // owner force-closed
  const byTimings = isWithinTimings(shop.timings, now);
  if (byTimings !== null) return byTimings;        // timings win when present
  return shop.is_open !== 0;                        // fallback to flag
}

export default isShopOpenNow;
