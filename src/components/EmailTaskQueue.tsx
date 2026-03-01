'use client';

import { useEffect, useState, useCallback } from 'react';
import type { EmailTaskQueueItem, ClassInfo } from '@/lib/types';
import { formatShortDate } from '@/lib/task-helpers';
import { useToast } from '@/components/Toast';

interface EmailTaskQueueProps {
  onTaskCreated?: () => void;
}

export default function EmailTaskQueue({ onTaskCreated }: EmailTaskQueueProps) {
  const [items, setItems] = useState<EmailTaskQueueItem[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const { showToast } = useToast();

  const loadQueue = useCallback(async () => {
    try {
      const [queueRes, classesRes] = await Promise.all([
        fetch('/api/email/queue'),
        fetch('/api/classes'),
      ]);
      const queueData = await queueRes.json();
      const classesData = await classesRes.json();
      setItems(Array.isArray(queueData) ? queueData : []);
      setClasses(classesData || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  async function checkNow() {
    setChecking(true);
    try {
      const res = await fetch('/api/email/fetch', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(`Checked ${data.fetched} emails, extracted ${data.extracted} tasks`);
        await loadQueue();
      } else {
        showToast(data.error || 'Failed to check email', true);
      }
    } catch {
      showToast('Check failed', true);
    }
    setChecking(false);
  }

  async function approveItem(item: EmailTaskQueueItem, overrides?: { task_text?: string; due_date?: string | null; class_id?: number | null }) {
    try {
      const res = await fetch(`/api/email/queue/${item.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides || {}),
      });
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== item.id));
        onTaskCreated?.();
      } else {
        const data = await res.json();
        showToast(data.error || 'Approve failed', true);
      }
    } catch {
      showToast('Approve failed', true);
    }
  }

  async function dismissItem(id: number) {
    try {
      const res = await fetch(`/api/email/queue/${id}/dismiss`, { method: 'POST' });
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== id));
      } else {
        showToast('Dismiss failed', true);
      }
    } catch {
      showToast('Dismiss failed', true);
    }
  }

  async function approveAll() {
    for (const item of items) {
      await approveItem(item);
    }
  }

  function startEdit(item: EmailTaskQueueItem) {
    setEditingId(item.id);
    setEditText(item.task_text);
  }

  function commitEdit(item: EmailTaskQueueItem) {
    if (editText.trim() && editText !== item.task_text) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, task_text: editText.trim() } : i));
    }
    setEditingId(null);
  }

  function updateItemField(id: number, field: string, value: string | number | null) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function getClassName(classId: number | null): string {
    if (!classId) return 'General';
    const cls = classes.find(c => c.id === classId);
    return cls ? cls.name : 'General';
  }

  // Don't render anything if no items and not loading
  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl bg-bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">
          Email Tasks
          <span className="ml-2 text-sm font-normal text-text-muted">
            ({items.length} pending)
          </span>
        </h2>
        <button
          onClick={checkNow}
          disabled={checking}
          className="px-3 py-1.5 text-xs font-semibold text-accent border border-accent/30 rounded-lg hover:bg-accent/10 transition-colors"
        >
          {checking ? 'Checking...' : 'Check Now'}
        </button>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="rounded-lg bg-bg-secondary border border-border/50 p-3">
            <div className="flex items-start gap-2">
              {/* Confidence indicator */}
              <span
                className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                  item.confidence === 'high' ? 'bg-accent' : 'bg-text-muted/40'
                }`}
                title={`${item.confidence} confidence`}
              />

              <div className="flex-1 min-w-0">
                {/* Task text — editable inline */}
                {editingId === item.id ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onBlur={() => commitEdit(item)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(item); if (e.key === 'Escape') setEditingId(null); }}
                    autoFocus
                    className="w-full px-2 py-1 bg-bg-input border border-accent rounded text-sm text-text-primary focus:outline-none"
                  />
                ) : (
                  <p
                    className="text-sm font-medium text-text-primary cursor-text hover:text-accent transition-colors"
                    onClick={() => startEdit(item)}
                    title="Click to edit"
                  >
                    {item.task_text}
                  </p>
                )}

                {/* Class + due date selectors */}
                <div className="flex items-center gap-3 mt-1.5">
                  <select
                    value={item.suggested_class_id || ''}
                    onChange={e => updateItemField(item.id, 'suggested_class_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="text-xs bg-bg-input border border-border rounded px-2 py-1 text-text-secondary"
                  >
                    <option value="">General</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <span className="text-xs text-text-muted">Due:</span>
                  <input
                    type="date"
                    value={item.suggested_due_date || ''}
                    onChange={e => updateItemField(item.id, 'suggested_due_date', e.target.value || null)}
                    className="text-xs bg-bg-input border border-border rounded px-2 py-1 text-text-secondary"
                  />
                  {item.suggested_due_date && (
                    <span className="text-xs text-accent-yellow">
                      {formatShortDate(item.suggested_due_date)}
                    </span>
                  )}
                </div>

                {/* Source email info */}
                <p className="text-xs text-text-muted mt-1 truncate">
                  {item.email_from} &mdash; &ldquo;{item.email_subject}&rdquo;
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => approveItem(item, {
                    task_text: item.task_text,
                    due_date: item.suggested_due_date,
                    class_id: item.suggested_class_id,
                  })}
                  className="px-3 py-1.5 text-xs font-semibold bg-accent text-bg-primary rounded-lg hover:brightness-110 transition-all"
                >
                  Approve
                </button>
                <button
                  onClick={() => dismissItem(item.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-text-muted border border-border rounded-lg hover:border-accent-red hover:text-accent-red transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="mt-3">
          <button
            onClick={approveAll}
            className="px-4 py-2 text-xs font-semibold text-accent border border-accent/30 rounded-lg hover:bg-accent/10 transition-colors"
          >
            Approve All
          </button>
        </div>
      )}

      {/* Toast */}
    </div>
  );
}
