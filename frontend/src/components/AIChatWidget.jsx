import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { aiChat } from '../api/client';

// Typing indicator — three animated dots
function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center px-3 py-2 rounded-2xl bg-white shadow-sm w-fit">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-[#4A7C59] inline-block animate-bounce"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
  );
}

// Single chat message bubble
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words shadow-sm
          ${isUser
            ? 'bg-[#4A7C59] text-white rounded-br-sm'
            : 'bg-white text-[#1A1A1A] rounded-bl-sm border border-[#E8E8E0]'
          }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

export default function AIChatWidget() {
  const { aiAvailable, currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your HyperMart assistant. How can I help you today? 🛒' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Determine caller role
  const callerRole = currentUser?.role === 'admin'
    ? 'admin'
    : currentUser?.role === 'owner'
    ? 'owner'
    : 'customer';

  // Scroll to newest message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  if (!aiAvailable) return null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      // Pass last 9 messages as history (excluding the brand-new one)
      const history = next.slice(-10, -1).map(m => ({ role: m.role, content: m.content }));
      const res = await aiChat(text, null, callerRole, history);
      const reply = res.data?.reply || 'Sorry, I couldn\'t get a response.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Connection issue. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Open AI Assistant"
          className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-[#4A7C59] text-white shadow-lg
                     flex items-center justify-center text-2xl hover:bg-[#3d6b4a] active:scale-95
                     transition-all duration-200 border-2 border-white"
          style={{ boxShadow: '0 4px 20px rgba(74,124,89,0.45)' }}
        >
          ✨
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div
          className="fixed bottom-20 right-4 z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl
                     border border-[#E8E8E0] bg-[#F5F5F0]"
          style={{ width: '340px', height: '480px', animation: 'slideUp 0.22s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#4A7C59] text-white">
            <div className="flex items-center gap-2">
              <span className="text-lg">✨</span>
              <div>
                <p className="font-semibold text-sm leading-none">HyperMart Assistant</p>
                <p className="text-xs text-green-200 mt-0.5 capitalize">{callerRole} mode</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center
                         text-sm font-bold transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
            {loading && (
              <div className="flex justify-start mb-2">
                <TypingIndicator />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-[#E8E8E0] bg-white flex gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything…"
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-[#D0D0C8] px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#4A7C59]/40 bg-[#F5F5F0]
                         placeholder-[#9A9A8A] disabled:opacity-60 max-h-24 overflow-y-auto"
              style={{ lineHeight: '1.4' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl bg-[#4A7C59] text-white flex items-center justify-center
                         disabled:opacity-40 hover:bg-[#3d6b4a] active:scale-95 transition-all shrink-0"
            >
              <svg className="w-4 h-4 rotate-90" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21L23 12 2 3v7l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Slide-up keyframe */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1);    }
        }
      `}</style>
    </>
  );
}
