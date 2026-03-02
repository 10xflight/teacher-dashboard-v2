'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { localDateStr } from '@/lib/task-helpers';
import { LibrarySkeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';

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

interface StoredImage {
  name: string;
  url: string;
  created: string;
  size: number;
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
  const [tab, setTab] = useState<'prompts' | 'images'>('prompts');
  const [prompts, setPrompts] = useState<LibraryPrompt[]>([]);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sendModal, setSendModal] = useState<LibraryPrompt | null>(null);
  const [sendDate, setSendDate] = useState('');
  const [sendSlot, setSendSlot] = useState(0);
  const [viewImage, setViewImage] = useState<StoredImage | null>(null);
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const loadLibrary = useCallback(async () => {
    try {
      const res = await fetch('/api/bellringers/library');
      const data = await res.json();
      setPrompts(data.prompts || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadImages = useCallback(async () => {
    setImagesLoading(true);
    try {
      const res = await fetch('/api/bellringers/images');
      const data = await res.json();
      setImages(data.images || []);
    } catch { /* ignore */ }
    setImagesLoading(false);
  }, []);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  // Load images when tab switches to images
  useEffect(() => {
    if (tab === 'images' && images.length === 0 && !imagesLoading) {
      loadImages();
    }
  }, [tab, images.length, imagesLoading, loadImages]);

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
    const ok = await confirm({
      title: 'Delete Prompt',
      message: 'Delete this prompt from the library? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    await fetch(`/api/bellringers/library/${id}`, { method: 'DELETE' });
    setPrompts(prev => prev.filter(p => p.id !== id));
    showToast('Prompt deleted');
  }

  async function deleteImage(img: StoredImage) {
    const ok = await confirm({
      title: 'Delete Image',
      message: 'Delete this image from storage? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch('/api/bellringers/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: img.name }),
      });
      if (res.ok) {
        setImages(prev => prev.filter(i => i.name !== img.name));
        setViewImage(null);
        showToast('Image deleted');
      } else {
        showToast('Failed to delete', true);
      }
    } catch {
      showToast('Failed to delete', true);
    }
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

  const inputCls = 'px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none';
  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
      active
        ? 'bg-accent/15 text-accent border border-accent/30'
        : 'text-text-muted hover:text-text-primary hover:bg-hover'
    }`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/bellringer/edit/${localDateStr()}`}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-hover transition-colors"
            title="Back to Bellringer Generator">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Bellringer Library</h1>
            <p className="text-sm text-text-muted mt-1">
              {tab === 'prompts' ? `${filtered.length} prompts` : `${images.length} images`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button className={tabCls(tab === 'prompts')} onClick={() => setTab('prompts')}>
          Prompts
        </button>
        <button className={tabCls(tab === 'images')} onClick={() => setTab('images')}>
          Images
        </button>
      </div>

      {/* PROMPTS TAB */}
      {tab === 'prompts' && (
        <>
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
            <LibrarySkeleton />
          ) : filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map(p => (
                <div key={p.id} className="rounded-xl bg-bg-card border border-border p-4 group hover:border-accent/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`shrink-0 text-[0.65rem] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLORS[p.journal_type || ''] || 'bg-bg-input text-text-muted border-border'}`}>
                      {TYPE_LABELS[p.journal_type || ''] || p.journal_type || 'Unknown'}
                    </span>
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
                    {p.image_path && (
                      <img src={p.image_path} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                    )}
                  </div>
                  <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setSendModal(p); setSendDate(localDateStr()); setSendSlot(0); }}
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
          ) : search || typeFilter ? (
            <EmptyState
              preset="search"
              title="No Matching Prompts"
              description="Try adjusting your search or filter to find what you're looking for."
              compact
            />
          ) : (
            <EmptyState
              preset="bellringer"
              title="Library is Empty"
              description="Generate bellringers from the editor and they'll appear here for reuse."
              action={{ label: 'Go to Bellringer Editor', href: `/bellringer/edit/today` }}
            />
          )}
        </>
      )}

      {/* IMAGES TAB */}
      {tab === 'images' && (
        <>
          {imagesLoading ? (
            <LibrarySkeleton />
          ) : images.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {images.map(img => (
                <button
                  key={img.name}
                  className="group relative rounded-xl overflow-hidden border border-border hover:border-accent/50 transition-colors aspect-square bg-bg-card"
                  onClick={() => setViewImage(img)}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[0.6rem] text-white truncate">{img.name}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              preset="bellringer"
              title="No Images Yet"
              description="Upload or generate images in the bellringer editor and they'll appear here."
              action={{ label: 'Go to Bellringer Editor', href: `/bellringer/edit/today` }}
            />
          )}
        </>
      )}

      {/* Image Viewer Modal */}
      {viewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setViewImage(null)} />
          <div className="relative max-w-3xl w-full bg-bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
            <img
              src={viewImage.url}
              alt={viewImage.name}
              className="w-full max-h-[70vh] object-contain bg-black"
            />
            <div className="p-4 flex items-center justify-between">
              <p className="text-sm text-text-muted truncate flex-1 mr-4">{viewImage.name}</p>
              <div className="flex gap-2 shrink-0">
                <a
                  href={viewImage.url}
                  download={viewImage.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-accent/15 text-accent rounded-lg text-xs font-medium hover:bg-accent/25 transition-colors"
                >
                  Save
                </a>
                <button
                  onClick={() => deleteImage(viewImage)}
                  className="px-3 py-1.5 text-accent-red/70 hover:text-accent-red bg-accent-red/10 rounded-lg text-xs font-medium transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setViewImage(null)}
                  className="px-3 py-1.5 bg-bg-input text-text-secondary rounded-lg text-xs font-medium hover:bg-hover transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
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

    </div>
  );
}
