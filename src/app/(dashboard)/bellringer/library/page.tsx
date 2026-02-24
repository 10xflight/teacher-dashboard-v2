'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface LibraryPrompt {
  id: number;
  bellringer_id: number;
  slot: number;
  journal_type: string | null;
  journal_prompt: string | null;
  journal_subprompt: string | null;
  image_path: string | null;
  date: string | null;
  status: string | null;
  is_approved: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  creative: 'Creative', quote: 'Quote', image: 'Image', emoji: 'Emoji',
  reflective: 'Reflective', critical_thinking: 'Thought-Provoking',
  descriptive: 'Descriptive', poetry: 'Poetry', list: 'Top 5 List',
  debate: 'Debate', would_you_rather: 'Would You Rather',
};

const TYPE_COLORS: Record<string, string> = {
  creative: 'bg-card1/20 text-card1 border-card1/30',
  quote: 'bg-card2/20 text-card2 border-card2/30',
  emoji: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30',
  reflective: 'bg-card3/20 text-card3 border-card3/30',
  critical_thinking: 'bg-card4/20 text-card4 border-card4/30',
  image: 'bg-accent-green/20 text-accent-green border-accent-green/30',
};

export default function BellringerLibraryPage() {
  const [prompts, setPrompts] = useState<LibraryPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sendModal, setSendModal] = useState<LibraryPrompt | null>(null);
  const [sendDate, setSendDate] = useState('');
  const [sendSlot, setSendSlot] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    try {
      const res = await fetch('/api/bellringers/library');
      const data = await res.json();
      setPrompts(data.prompts || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  const filtered = prompts.filter(p => {
    if (!p.journal_prompt) return false;
    if (typeFilter && p.journal_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (p.journal_prompt?.toLowerCase().includes(q) ||
              p.journal_type?.toLowerCase().includes(q) ||
              p.date?.includes(q));
    }
    return true;
  });

  // Get unique types from data
  const types = [...new Set(prompts.map(p => p.journal_type).filter(Boolean))] as string[];

  async function deletePrompt(id: number) {
    if (!confirm('Delete this prompt from the library?')) return;
    await fetch(`/api/bellringers/library/${id}`, { method: 'DELETE' });
    setPrompts(prev => prev.filter(p => p.id !== id));
    showToast('Prompt deleted');
  }

  async function sendToSlot() {
    if (!sendModal || !sendDate) return;
    try {
      const res = await fetch('/api/bellringers/send-to-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_id: sendModal.id, target_date: sendDate, slot: sendSlot }),
      });
      if (res.ok) {
        showToast(`Sent to ${sendDate} slot ${sendSlot + 1}`);
        setSendModal(null);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to send', true);
      }
    } catch {
      showToast('Failed to send', true);
    }
  }

  function showToast(msg: string, _err?: boolean) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const inputCls = 'px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Bellringer Library</h1>
          <p className="text-sm text-text-muted mt-1">{filtered.length} prompts</p>
        </div>
        <Link href={`/bellringer/edit/${new Date().toISOString().split('T')[0]}`}
          className="px-4 py-2 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110">
          Edit Today
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search prompts..."
          className={`${inputCls} flex-1 min-w-[200px]`}
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className={`${inputCls} w-[180px]`}
        >
          <option value="">All Types</option>
          {types.map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
          ))}
        </select>
      </div>

      {/* Prompts List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="rounded-xl bg-bg-card border border-border p-4 group hover:border-accent/40 transition-colors">
              <div className="flex items-start gap-3">
                {/* Type badge */}
                <span className={`shrink-0 text-[0.65rem] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLORS[p.journal_type || ''] || 'bg-bg-input text-text-muted border-border'}`}>
                  {TYPE_LABELS[p.journal_type || ''] || p.journal_type || 'Unknown'}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary leading-relaxed">
                    {p.journal_prompt}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                    {p.date && <span>{p.date}</span>}
                    <span>Slot {p.slot + 1}</span>
                    <span className={p.is_approved ? 'text-accent-green' : 'text-accent-yellow'}>
                      {p.is_approved ? 'Approved' : 'Draft'}
                    </span>
                  </div>
                </div>

                {/* Image thumbnail */}
                {p.image_path && (
                  <img src={p.image_path} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setSendModal(p); setSendDate(new Date().toISOString().split('T')[0]); setSendSlot(0); }}
                  className="px-3 py-1 bg-accent/15 text-accent rounded-lg text-xs font-medium hover:bg-accent/25 transition-colors">
                  Send to Slot
                </button>
                <Link href={`/bellringer/edit/${p.date}`}
                  className="px-3 py-1 bg-bg-input text-text-secondary rounded-lg text-xs font-medium hover:bg-hover hover:text-text-primary transition-colors">
                  View Day
                </Link>
                <button
                  onClick={() => deletePrompt(p.id)}
                  className="px-3 py-1 text-accent-red/70 hover:text-accent-red rounded-lg text-xs font-medium transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-text-muted">
            {search || typeFilter ? 'No prompts match your search.' : 'No prompts in the library yet. Generate some bellringers to populate it!'}
          </p>
        </div>
      )}

      {/* Send to Slot Modal */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in" onClick={() => setSendModal(null)} />
          <div className="relative w-full max-w-sm bg-bg-card border border-border rounded-xl shadow-2xl p-5 animate-modal-in">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Send to Slot</h3>
            <p className="text-xs text-text-muted mb-4 line-clamp-2">{sendModal.journal_prompt}</p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-accent font-semibold mb-1">Target Date</label>
                <input type="date" value={sendDate} onChange={e => setSendDate(e.target.value)} className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-accent font-semibold mb-1">Slot</label>
                <select value={sendSlot} onChange={e => setSendSlot(Number(e.target.value))} className={`${inputCls} w-full`}>
                  <option value={0}>Slot 1</option>
                  <option value={1}>Slot 2</option>
                  <option value={2}>Slot 3</option>
                  <option value={3}>Slot 4</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setSendModal(null)}
                className="px-4 py-2 bg-bg-input text-text-secondary rounded-lg text-sm font-medium hover:bg-hover transition-colors">
                Cancel
              </button>
              <button onClick={sendToSlot}
                className="px-4 py-2 bg-accent text-bg-primary rounded-lg text-sm font-semibold hover:brightness-110">
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[200] px-5 py-3 rounded-lg bg-accent-green text-white font-medium shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
