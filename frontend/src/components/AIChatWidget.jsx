import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { aiChat, aiAgentStart, aiAgentStep, aiAgentConfirm } from '../api/client';

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

// Lightweight markdown renderer for AI responses
function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines (add spacing)
    if (!trimmed) {
      elements.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }

    // Headings: ### heading
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const cls = level === 1 ? 'text-base font-bold' : level === 2 ? 'text-sm font-bold' : 'text-[13px] font-semibold';
      elements.push(<p key={i} className={`${cls} mt-1 mb-0.5`}>{formatInline(headingMatch[2])}</p>);
      i++;
      continue;
    }

    // Numbered list: 1. item or 1) item
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      const listItems = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(/^(\d+)[.)]\s+(.+)/);
        if (!m) break;
        listItems.push(<li key={i} className="flex gap-1.5 py-0.5"><span className="font-semibold text-[#4A7C59] shrink-0 min-w-[18px]">{m[1]}.</span><span>{formatInline(m[2])}</span></li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`} className="my-1 space-y-0.5">{listItems}</ol>);
      continue;
    }

    // Bullet list: - item or * item or • item
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)/);
    if (bulletMatch) {
      const listItems = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(/^[-*•]\s+(.+)/);
        if (!m) break;
        listItems.push(<li key={i} className="flex gap-1.5 py-0.5"><span className="text-[#4A7C59] shrink-0 mt-0.5">•</span><span>{formatInline(m[1])}</span></li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} className="my-1 space-y-0.5">{listItems}</ul>);
      continue;
    }

    // Regular paragraph
    elements.push(<p key={i} className="my-0.5 leading-relaxed">{formatInline(trimmed)}</p>);
    i++;
  }

  return elements;
}

// Inline formatting: **bold**, *italic*, `code`
function formatInline(text) {
  if (!text) return text;
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldIdx = remaining.indexOf('**');
    // Code: `text`
    const codeIdx = remaining.indexOf('`');
    // Italic: *text* (but not **)
    let italicIdx = -1;
    for (let j = 0; j < remaining.length; j++) {
      if (remaining[j] === '*' && remaining[j + 1] !== '*' && (j === 0 || remaining[j - 1] !== '*')) {
        italicIdx = j;
        break;
      }
    }

    // Find earliest match
    const candidates = [
      boldIdx >= 0 ? { type: 'bold', idx: boldIdx } : null,
      codeIdx >= 0 ? { type: 'code', idx: codeIdx } : null,
      italicIdx >= 0 ? { type: 'italic', idx: italicIdx } : null,
    ].filter(Boolean).sort((a, b) => a.idx - b.idx);

    if (candidates.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = candidates[0];

    if (first.type === 'bold') {
      const end = remaining.indexOf('**', first.idx + 2);
      if (end === -1) { parts.push(remaining); break; }
      if (first.idx > 0) parts.push(remaining.slice(0, first.idx));
      parts.push(<strong key={key++} className="font-semibold">{remaining.slice(first.idx + 2, end)}</strong>);
      remaining = remaining.slice(end + 2);
    } else if (first.type === 'code') {
      const end = remaining.indexOf('`', first.idx + 1);
      if (end === -1) { parts.push(remaining); break; }
      if (first.idx > 0) parts.push(remaining.slice(0, first.idx));
      parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-black/5 text-[12px] font-mono">{remaining.slice(first.idx + 1, end)}</code>);
      remaining = remaining.slice(end + 1);
    } else if (first.type === 'italic') {
      const end = remaining.indexOf('*', first.idx + 1);
      if (end === -1 || remaining[end + 1] === '*') { parts.push(remaining.slice(0, first.idx + 1)); remaining = remaining.slice(first.idx + 1); continue; }
      if (first.idx > 0) parts.push(remaining.slice(0, first.idx));
      parts.push(<em key={key++}>{remaining.slice(first.idx + 1, end)}</em>);
      remaining = remaining.slice(end + 1);
    }
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

// Single chat message bubble
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-2.5`}>
      <div
        className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-[13px] break-words shadow-sm leading-relaxed
          ${isUser
            ? 'bg-[#4A7C59] text-white rounded-br-sm'
            : 'bg-white text-[#1A1A1A] rounded-bl-sm border border-[#E8E8E0]'
          }`}
      >
        {isUser ? msg.content : <div className="ai-msg">{renderMarkdown(msg.content)}</div>}
      </div>
      {!isUser && msg.toolsUsed?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 max-w-[88%]">
          {msg.toolsUsed.map((tool, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#4A7C59]/8 rounded-full text-[9px] font-semibold text-[#4A7C59]/80 tracking-wide">
              <span className="text-[8px]">⚡</span>{tool.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Quick action chips. Read-only ones answer instantly; the ⚡ ones are real
// actions the agent performs (and gates high-risk ones behind confirmation).
const ROLE_PROMPTS = {
  customer: [
    { label: '🔥 Popular products', prompt: 'What are the most popular products available right now?' },
    { label: '🏪 Shops near me', prompt: 'Show me all available shops and what they sell' },
    { label: '📦 Track my order', prompt: 'What is the status of my most recent order?' },
    { label: '🥛 Recommend dairy', prompt: 'Recommend some dairy products with prices' },
  ],
  owner: [
    { label: '📊 Sales this week', prompt: 'Show me my sales summary for the last 7 days' },
    { label: '⚠️ Low stock', prompt: 'Which products are running low in my shop?' },
    { label: '⚡ Restock low items', prompt: 'Restock all my low-stock products to 50 units each.', action: true },
    { label: '⚡ Run a 10% sale', prompt: 'Apply a 10% discount to my best-selling product.', action: true },
  ],
  admin: [
    { label: '📈 Platform stats', prompt: 'Show me the overall platform statistics' },
    { label: '🏪 List shops', prompt: 'List all shops and their current status' },
    { label: '💰 Revenue overview', prompt: 'What is the total platform revenue?' },
    { label: '👥 Activity summary', prompt: 'Give me a summary of user and shop activity' },
  ],
};

// Human-friendly summary of a pending high-risk action.
function describeAction(tool, args) {
  const a = args || {};
  switch (tool) {
    case 'place_order': {
      const n = Array.isArray(a.items) ? a.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0) : 0;
      return `Place a Cash-on-Delivery order (${n} item${n === 1 ? '' : 's'}) from shop #${a.shop_id}.`;
    }
    case 'delete_product':  return `Permanently delete product #${a.product_id}.`;
    case 'suspend_shop':    return `Suspend shop #${a.shop_id}${a.reason ? ` — ${a.reason}` : ''}.`;
    case 'set_user_role':   return `Change user #${a.user_id}'s role to "${a.role}".`;
    default:                return `Run ${tool.replace(/_/g, ' ')}.`;
  }
}

export default function AIChatWidget() {
  const { currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your HyperShopIndia assistant. I can look up live data **and take actions** for you — restock items, run discounts, place orders, manage orders. Try a quick action below or just tell me what to do. 🛒' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);          // a request/loop is in flight
  const [progress, setProgress] = useState(null);          // live "working…" tool line
  const [pending, setPending] = useState(null);            // { runId, actions: [{pending_id, tool, args, resolved}] }
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Logged-in users get the autonomous agent (it can act); guests get read-only chat.
  const isAgent = !!currentUser;
  const callerRole = currentUser?.role === 'admin'
    ? 'admin'
    : currentUser?.role === 'owner'
    ? 'owner'
    : 'customer';

  // Scroll to newest message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, loading, progress, pending]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const pushAssistant = (content, toolsUsed = []) =>
    setMessages(prev => [...prev, { role: 'assistant', content, toolsUsed }]);

  // Drive the client-orchestrated agent loop until it finishes or needs confirmation.
  const runAgentLoop = async (firstResp) => {
    let resp = firstResp;
    const usedAll = [];
    let safety = 0;
    while (resp && safety++ < 16) {
      (resp.tools_used || []).forEach(t => usedAll.push(t));
      if (resp.status === 'awaiting_confirmation') {
        setProgress(null);
        setPending({
          runId: resp.run_id,
          actions: (resp.pending_actions || []).map(a => ({ ...a, resolved: null })),
        });
        return;
      }
      if (resp.status === 'done') {
        setProgress(null);
        pushAssistant(resp.assistant_message || 'Done.', Array.from(new Set(usedAll)));
        return;
      }
      // status === 'continue' → show progress and step again
      const uniq = Array.from(new Set(usedAll));
      setProgress(uniq.length ? `Working… (${uniq.map(t => t.replace(/_/g, ' ')).join(', ')})` : 'Working…');
      resp = (await aiAgentStep(resp.run_id)).data;
    }
    setProgress(null);
    if (safety >= 16) pushAssistant('I stopped after several steps to stay safe. Please refine your request.');
  };

  const send = async (text) => {
    const t = (text || '').trim();
    if (!t || loading) return;
    setMessages(prev => [...prev, { role: 'user', content: t }]);
    setInput('');
    setLoading(true);
    setProgress(isAgent ? 'Thinking…' : null);
    try {
      if (isAgent) {
        const res = await aiAgentStart(t);
        await runAgentLoop(res.data);
      } else {
        const history = messages.slice(-9).map(m => ({ role: m.role, content: m.content }));
        const res = await aiChat(t, null, callerRole, history);
        pushAssistant(res.data?.reply || 'Sorry, I couldn\'t get a response.', res.data?.tools_used || []);
      }
    } catch (e) {
      setProgress(null);
      const msg = e?.response?.status === 401
        ? '⚠️ Please log in again to use the assistant.'
        : '⚠️ Connection issue. Please try again.';
      pushAssistant(msg);
    } finally {
      setLoading(false);
    }
  };

  // Approve / deny one gated action; when all are resolved, resume the loop.
  const resolveAction = async (pendingId, approve) => {
    if (!pending || loading) return;
    setLoading(true);
    try {
      await aiAgentConfirm(pending.runId, pendingId, approve);
      const updated = pending.actions.map(a => a.pending_id === pendingId ? { ...a, resolved: approve ? 'approved' : 'denied' } : a);
      const allDone = updated.every(a => a.resolved !== null);
      setPending(allDone ? null : { ...pending, actions: updated });
      if (allDone) {
        setProgress('Working…');
        const res = await aiAgentStep(pending.runId);
        await runAgentLoop(res.data);
      }
    } catch {
      setProgress(null);
      pushAssistant('⚠️ Could not confirm that action. Please try again.');
      setPending(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
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
          className="fixed bottom-20 right-4 left-4 sm:left-auto z-50 flex flex-col rounded-2xl overflow-hidden shadow-2xl
                     border border-[#E8E8E0] bg-[#F5F5F0] sm:w-[340px]"
          style={{ height: '480px', maxHeight: 'calc(100vh - 120px)', animation: 'slideUp 0.22s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#4A7C59] text-white">
            <div className="flex items-center gap-2">
              <span className="text-lg">✨</span>
              <div>
                <p className="font-semibold text-sm leading-none">HyperShopIndia Assistant</p>
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

            {/* Role-based quick actions — shown when only the welcome message exists */}
            {messages.length <= 1 && !loading && !pending && (
              <div className="flex flex-wrap gap-1.5 mt-2 mb-1">
                {(ROLE_PROMPTS[callerRole] || ROLE_PROMPTS.customer).map((qp, i) => (
                  <button key={i}
                    onClick={() => send(qp.prompt)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all text-left border
                      ${qp.action
                        ? 'bg-[#4A7C59]/10 border-[#4A7C59]/30 text-[#4A7C59] hover:bg-[#4A7C59]/15'
                        : 'bg-white border-[#D0D0C8] text-[#1A1A1A]/60 hover:border-[#4A7C59] hover:text-[#4A7C59] hover:bg-[#4A7C59]/5'}`}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            )}

            {/* Confirmation card for gated high-risk actions */}
            {pending && pending.actions.length > 0 && (
              <div className="mb-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 shadow-sm">
                <p className="text-[12px] font-bold text-amber-800 flex items-center gap-1 mb-1.5">
                  ⚠️ Confirm {pending.actions.length > 1 ? 'these actions' : 'this action'}
                </p>
                <div className="space-y-2">
                  {pending.actions.map((a) => (
                    <div key={a.pending_id} className="text-[12px] text-amber-900">
                      <p className="leading-snug">{describeAction(a.tool, a.args)}</p>
                      {a.resolved ? (
                        <p className={`mt-0.5 text-[11px] font-semibold ${a.resolved === 'approved' ? 'text-[#4A7C59]' : 'text-red-500'}`}>
                          {a.resolved === 'approved' ? '✓ Approved' : '✕ Declined'}
                        </p>
                      ) : (
                        <div className="flex gap-1.5 mt-1.5">
                          <button
                            onClick={() => resolveAction(a.pending_id, true)}
                            disabled={loading}
                            className="px-3 py-1 rounded-lg bg-[#4A7C59] text-white text-[11px] font-semibold hover:bg-[#3d6b4a] disabled:opacity-50 active:scale-95 transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => resolveAction(a.pending_id, false)}
                            disabled={loading}
                            className="px-3 py-1 rounded-lg bg-white border border-red-300 text-red-500 text-[11px] font-semibold hover:bg-red-50 disabled:opacity-50 active:scale-95 transition-all"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live progress / typing indicator */}
            {loading && (
              progress ? (
                <div className="flex items-center gap-2 mb-2 text-[12px] text-[#4A7C59] font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#4A7C59] animate-pulse" />
                  {progress}
                </div>
              ) : (
                <div className="flex justify-start mb-2"><TypingIndicator /></div>
              )
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
              placeholder={isAgent ? 'Tell me what to do…' : 'Ask anything…'}
              disabled={loading}
              className="flex-1 resize-none rounded-xl border border-[#D0D0C8] px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#4A7C59]/40 bg-[#F5F5F0]
                         placeholder-[#9A9A8A] disabled:opacity-60 max-h-24 overflow-y-auto"
              style={{ lineHeight: '1.4' }}
            />
            <button
              onClick={() => send(input)}
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
