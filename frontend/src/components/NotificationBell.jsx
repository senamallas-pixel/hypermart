// Header notification bell: shows unread count, dropdown list, mark-as-read.
import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/client';

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell({ open = false, onToggle = () => {} }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      setUnread(res.data.unread_count || 0);
    } catch { /* not logged in / network */ }
  }, []);

  const loadList = useCallback(async () => {
    try {
      const res = await listNotifications(30);
      setItems(res.data.items || []);
      setUnread(res.data.unread_count || 0);
    } catch { /* ignore */ }
  }, []);

  // Poll unread count every 30s
  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, 30000);
    return () => clearInterval(id);
  }, [refreshCount]);

  // Load list whenever the dropdown opens
  useEffect(() => {
    if (open) loadList();
  }, [open, loadList]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e) => { if (open && ref.current && !ref.current.contains(e.target)) onToggle(); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, onToggle]);

  const onItemClick = async (n) => {
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)));
      setUnread((u) => Math.max(0, u - 1));
      try { await markNotificationRead(n.id); } catch { /* ignore */ }
    }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, is_read: 1 })));
    setUnread(0);
    try { await markAllNotificationsRead(); } catch { /* ignore */ }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        title="Notifications"
        className="relative w-8 h-8 flex items-center justify-center hover:bg-[#F5F5F0] rounded-xl transition-colors text-[#5A5A40]"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 w-80 max-w-[88vw] bg-white border border-[#1A1A1A]/10 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1A1A1A]/8">
            <span className="text-sm font-bold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-[11px] font-semibold text-[#5A5A40] hover:underline flex items-center gap-1">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#1A1A1A]/40">No notifications yet</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onItemClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-[#1A1A1A]/5 hover:bg-[#F5F5F0] transition-colors flex gap-3 ${n.is_read ? '' : 'bg-[#5A5A40]/5'}`}
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-[#5A5A40]'}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{n.title}</span>
                    {n.message && <span className="block text-xs text-[#1A1A1A]/55 line-clamp-2">{n.message}</span>}
                    <span className="block text-[10px] text-[#1A1A1A]/35 mt-0.5">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
