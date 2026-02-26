'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { CalendarEvent, Task, Bellringer, ClassInfo } from '@/lib/types';

interface DayData {
  date: string;
  events: CalendarEvent[];
  tasks: Task[];
  bellringer: Bellringer | null;
}

interface DayDetailModalProps {
  date: string; // YYYY-MM-DD
  onClose: () => void;
  onDataChanged?: () => void;
}

export default function DayDetailModal({ date, onClose, onDataChanged }: DayDetailModalProps) {
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add event form
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState('event');
  const [newEventNotes, setNewEventNotes] = useState('');
  const [addingEvent, setAddingEvent] = useState(false);

  // Add task form
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskClassId, setNewTaskClassId] = useState<number | null>(null);
  const [addingTask, setAddingTask] = useState(false);

  // Classes for dropdown
  const [classes, setClasses] = useState<ClassInfo[]>([]);

  const fetchDayData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/day/${date}`);
      if (!res.ok) {
        throw new Error(`Failed to load data for ${date}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load day data');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchDayData();
  }, [fetchDayData]);

  // Load classes on mount
  useEffect(() => {
    fetch('/api/classes')
      .then(r => r.json())
      .then(setClasses)
      .catch(() => {});
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getBellringerStatus = (bellringer: Bellringer | null) => {
    if (!bellringer) return { label: 'Not Created', color: 'text-text-muted', bg: 'bg-bg-input' };
    if (bellringer.is_approved) return { label: 'Approved', color: 'text-accent-green', bg: 'bg-accent-green/15' };
    if (bellringer.status === 'draft') return { label: 'Draft', color: 'text-accent-yellow', bg: 'bg-accent-yellow/15' };
    return { label: bellringer.status, color: 'text-text-secondary', bg: 'bg-bg-input' };
  };

  async function addEvent() {
    if (!newEventTitle.trim() || addingEvent) return;
    setAddingEvent(true);
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          event_type: newEventType,
          title: newEventTitle.trim(),
          notes: newEventNotes.trim() || null,
        }),
      });
      if (res.ok) {
        const newEvt = await res.json();
        setData(prev => prev ? { ...prev, events: [...prev.events, newEvt] } : prev);
        setNewEventTitle('');
        setNewEventNotes('');
        setNewEventType('event');
        setShowAddEvent(false);
        onDataChanged?.();
      }
    } catch { /* ignore */ }
    setAddingEvent(false);
  }

  async function deleteEvent(eventId: number) {
    try {
      const res = await fetch(`/api/calendar/events/${eventId}`, { method: 'DELETE' });
      if (res.ok) {
        setData(prev => prev ? { ...prev, events: prev.events.filter(e => e.id !== eventId) } : prev);
        onDataChanged?.();
      }
    } catch { /* ignore */ }
  }

  async function addTask() {
    if (!newTaskText.trim() || addingTask) return;
    setAddingTask(true);
    try {
      const body: Record<string, unknown> = {
        text: newTaskText.trim(),
        due_date: date,
      };
      if (newTaskClassId !== null) {
        body.class_id = newTaskClassId;
      }
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const newT = await res.json();
        setData(prev => prev ? { ...prev, tasks: [...prev.tasks, newT] } : prev);
        setNewTaskText('');
        setNewTaskClassId(null);
        setShowAddTask(false);
        onDataChanged?.();
      }
    } catch { /* ignore */ }
    setAddingTask(false);
  }

  async function toggleTask(taskId: number, isDone: boolean) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_done: isDone }),
      });
      if (res.ok) {
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            tasks: prev.tasks.map(t => t.id === taskId ? { ...t, is_done: isDone } : t),
          };
        });
        onDataChanged?.();
      }
    } catch { /* ignore */ }
  }

  async function deleteTask(taskId: number) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        setData(prev => prev ? { ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) } : prev);
        onDataChanged?.();
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[85vh] bg-bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {formatDate(date)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-hover transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-accent-red/15 border border-accent-red/30 p-4">
              <p className="text-accent-red text-sm">{error}</p>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Bellringer Section */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                    Bellringer
                  </h3>
                  {(() => {
                    const status = getBellringerStatus(data.bellringer);
                    return (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    );
                  })()}
                </div>

                {data.bellringer ? (
                  <div className="rounded-lg bg-bg-secondary p-3 space-y-2">
                    {data.bellringer.journal_prompt && (
                      <p className="text-sm text-text-primary leading-relaxed">
                        {data.bellringer.journal_prompt}
                      </p>
                    )}
                    {data.bellringer.act_skill && (
                      <p className="text-xs text-text-muted">
                        ACT: {data.bellringer.act_skill_category} &mdash; {data.bellringer.act_skill}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">
                    No bellringer created for this date.
                  </p>
                )}

                <div className="flex gap-2 mt-3">
                  <Link
                    href={`/bellringer/edit/${date}`}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
                  >
                    Edit Bellringer
                  </Link>
                  <a
                    href={`/display/${date}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-bg-input text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
                  >
                    TV Display
                  </a>
                </div>
              </section>

              {/* Events Section */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                    Events
                  </h3>
                  <button
                    onClick={() => { setShowAddEvent(!showAddEvent); setShowAddTask(false); }}
                    className="text-xs font-medium px-2 py-1 rounded-lg text-accent hover:bg-accent/10 transition-colors"
                  >
                    + Add Event
                  </button>
                </div>

                {/* Add event form */}
                {showAddEvent && (
                  <div className="rounded-lg bg-bg-secondary border border-border p-3 mb-3 space-y-2">
                    <input
                      autoFocus
                      type="text"
                      value={newEventTitle}
                      onChange={e => setNewEventTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addEvent(); if (e.key === 'Escape') setShowAddEvent(false); }}
                      placeholder="Event title..."
                      className="w-full px-3 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <select
                        value={newEventType}
                        onChange={e => setNewEventType(e.target.value)}
                        className="px-2 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-xs focus:border-accent focus:outline-none"
                      >
                        <option value="event">Event</option>
                        <option value="holiday">Holiday</option>
                        <option value="professional_day">Professional Day</option>
                        <option value="early_release">Early Release</option>
                        <option value="break">Break</option>
                        <option value="testing">Testing</option>
                        <option value="other">Other</option>
                      </select>
                      <input
                        type="text"
                        value={newEventNotes}
                        onChange={e => setNewEventNotes(e.target.value)}
                        placeholder="Notes (optional)"
                        className="flex-1 px-2 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-xs focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowAddEvent(false)}
                        className="px-3 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addEvent}
                        disabled={!newEventTitle.trim() || addingEvent}
                        className="px-3 py-1 bg-accent text-bg-primary rounded-lg text-xs font-semibold hover:brightness-110 disabled:opacity-50"
                      >
                        {addingEvent ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  </div>
                )}

                {data.events.length > 0 ? (
                  <ul className="space-y-2">
                    {data.events.map((event) => (
                      <li
                        key={event.id}
                        className="flex items-start gap-3 rounded-lg bg-bg-secondary p-3 group"
                      >
                        <span className="mt-0.5 w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary">
                            {event.title}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5">
                            {event.event_type}
                          </p>
                          {event.notes && (
                            <p className="text-xs text-text-secondary mt-1">
                              {event.notes}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteEvent(event.id)}
                          className="text-accent-red opacity-0 group-hover:opacity-100 text-xs font-medium hover:underline transition-opacity shrink-0"
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-text-muted">No events for this date.</p>
                )}
              </section>

              {/* Tasks Section */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                    Tasks
                  </h3>
                  <button
                    onClick={() => { setShowAddTask(!showAddTask); setShowAddEvent(false); }}
                    className="text-xs font-medium px-2 py-1 rounded-lg text-accent hover:bg-accent/10 transition-colors"
                  >
                    + Add Task
                  </button>
                </div>

                {/* Add task form */}
                {showAddTask && (
                  <div className="rounded-lg bg-bg-secondary border border-border p-3 mb-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={newTaskText}
                        onChange={e => setNewTaskText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setShowAddTask(false); }}
                        placeholder="Task description..."
                        className="flex-1 px-3 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <select
                        value={newTaskClassId === null ? '' : String(newTaskClassId)}
                        onChange={e => setNewTaskClassId(e.target.value ? parseInt(e.target.value) : null)}
                        className="px-2 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-xs focus:border-accent focus:outline-none"
                      >
                        <option value="">General</option>
                        {classes.map(cls => (
                          <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                      </select>
                      <div className="flex-1" />
                      <button
                        onClick={() => setShowAddTask(false)}
                        className="px-3 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addTask}
                        disabled={!newTaskText.trim() || addingTask}
                        className="px-3 py-1.5 bg-accent text-bg-primary rounded-lg text-xs font-semibold hover:brightness-110 disabled:opacity-50"
                      >
                        {addingTask ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  </div>
                )}

                {data.tasks.length > 0 ? (
                  <ul className="space-y-2">
                    {data.tasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center gap-3 rounded-lg bg-bg-secondary p-3 group"
                      >
                        <button
                          onClick={() => toggleTask(task.id, !task.is_done)}
                          className={`
                            w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors
                            ${task.is_done
                              ? 'border-accent-green bg-accent-green/20'
                              : 'border-border hover:border-accent'
                            }
                          `}
                        >
                          {task.is_done && (
                            <svg className="w-2.5 h-2.5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span
                          className={`flex-1 text-sm ${
                            task.is_done
                              ? 'text-text-muted line-through'
                              : 'text-text-primary'
                          }`}
                        >
                          {task.text}
                        </span>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-accent-red opacity-0 group-hover:opacity-100 text-xs font-medium hover:underline transition-opacity shrink-0"
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-text-muted">No tasks due on this date.</p>
                )}
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-bg-input text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
