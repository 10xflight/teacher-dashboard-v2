'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import MaterialGeneratorPanel from '@/components/MaterialGeneratorPanel';

// ──────────────── Types ────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClassInfo {
  id: number;
  name: string;
  periods: string | null;
  color: string | null;
}

interface ActivityData {
  id: number;
  class_id: number;
  lesson_plan_id: number | null;
  date: string | null;
  title: string;
  description: string | null;
  activity_type: string;
  sort_order: number;
  material_status: string;
  is_done: boolean;
  is_graded: boolean;
  classes: { name: string; periods: string | null; color: string | null } | null;
}

interface LessonPlanData {
  id: number;
  week_of: string;
  brainstorm_history: ChatMessage[] | null;
  status: string;
  publish_token?: string | null;
  announcements?: string | null;
  writers_corner?: Record<string, string> | null;
  created_at: string;
  updated_at: string | null;
}

// ──────────────── Helpers ────────────────

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getCurrentMonday(): string {
  return getMonday(new Date().toISOString().split('T')[0]);
}

function getWeekDates(mondayStr: string): string[] {
  const d = new Date(mondayStr + 'T12:00:00');
  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const current = new Date(d);
    current.setDate(d.getDate() + i);
    dates.push(current.toISOString().split('T')[0]);
  }
  return dates;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatWeekLabel(mondayStr: string): string {
  const d = new Date(mondayStr + 'T12:00:00');
  const fri = new Date(d);
  fri.setDate(d.getDate() + 4);
  const mStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fStr = fri.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${mStr} - ${fStr}`;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const ACTIVITY_TYPES = [
  'lesson', 'game', 'discussion', 'writing', 'assessment',
  'warmup', 'review', 'project', 'homework', 'lab',
];


// ──────────────── Component ────────────────

export default function LessonPlansPage() {
  // State: week & lesson plan
  const [weekOf, setWeekOf] = useState(getCurrentMonday);
  const [plan, setPlan] = useState<LessonPlanData | null>(null);
  const [loading, setLoading] = useState(true);

  // State: classes
  const [classes, setClasses] = useState<ClassInfo[]>([]);

  // State: brainstorm chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // State: activities grid
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [parsing, setParsing] = useState(false);

  // State: editing
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // State: inline add
  const [addingFor, setAddingFor] = useState<{ date: string; classId: number } | null>(null);
  const [addTitle, setAddTitle] = useState('');

  // State: saving
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // State: mobile panel toggle
  const [activePanel, setActivePanel] = useState<'chat' | 'grid'>('chat');

  // State: announcements & writers corner
  const [announcements, setAnnouncements] = useState('');
  const [writersCorner, setWritersCorner] = useState<Record<string, string>>({});

  // State: material generator panel
  const [materialActivity, setMaterialActivity] = useState<ActivityData | null>(null);

  // ──────────────── Data Loading ────────────────

  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/classes');
      if (res.ok) setClasses(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lesson-plans?week_of=${weekOf}`);
      if (!res.ok) { setLoading(false); return; }
      const plans = await res.json();

      if (plans.length > 0) {
        const p = plans[0];
        setPlan(p);
        const history = Array.isArray(p.brainstorm_history) ? p.brainstorm_history : [];
        setChatMessages(history);
        setAnnouncements(p.announcements || '');
        setWritersCorner(p.writers_corner || {});
      } else {
        setPlan(null);
        setChatMessages([]);
        setAnnouncements('');
        setWritersCorner({});
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [weekOf]);

  const loadActivities = useCallback(async () => {
    if (!plan) { setActivities([]); return; }
    try {
      const weekDates = getWeekDates(weekOf);
      const allActivities: ActivityData[] = [];
      for (const date of weekDates) {
        const res = await fetch(`/api/activities?date=${date}`);
        if (res.ok) {
          const data = await res.json();
          allActivities.push(...data);
        }
      }
      setActivities(allActivities);
    } catch { /* ignore */ }
  }, [plan, weekOf]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadPlan(); }, [loadPlan]);
  useEffect(() => { loadActivities(); }, [loadActivities]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ──────────────── Plan CRUD ────────────────

  async function ensurePlan(): Promise<number | null> {
    if (plan) return plan.id;
    try {
      const res = await fetch('/api/lesson-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_of: weekOf }),
      });
      if (!res.ok) return null;
      const newPlan = await res.json();
      setPlan(newPlan);
      return newPlan.id;
    } catch {
      return null;
    }
  }

  // ──────────────── Chat Actions ────────────────

  async function sendMessage() {
    if (!chatInput.trim() || chatSending) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatSending(true);

    const planId = await ensurePlan();
    if (!planId) {
      setChatSending(false);
      return;
    }

    // Optimistically add user message
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);

    try {
      const res = await fetch('/api/lesson-plans/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_plan_id: planId, message: msg }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.history);
      } else {
        const err = await res.json();
        setChatMessages(prev => [
          ...prev,
          { role: 'assistant', content: `Error: ${err.error || 'Failed to get response'}` },
        ]);
      }
    } catch {
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Error: Network error. Please try again.' },
      ]);
    }

    setChatSending(false);
  }

  // ──────────────── Parse to Grid ────────────────

  async function generatePlan() {
    if (!plan || chatMessages.length === 0 || parsing) return;
    setParsing(true);

    try {
      const res = await fetch('/api/lesson-plans/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_plan_id: plan.id }),
      });

      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
        setActivePanel('grid');
      } else {
        const err = await res.json();
        alert(`Parse failed: ${err.error}`);
      }
    } catch {
      alert('Network error while parsing. Please try again.');
    }

    setParsing(false);
  }

  // ──────────────── Activity Actions ────────────────

  async function deleteActivity(id: number) {
    try {
      await fetch(`/api/activities/${id}`, { method: 'DELETE' });
      setActivities(prev => prev.filter(a => a.id !== id));
    } catch { /* ignore */ }
  }

  async function saveActivityTitle(id: number) {
    if (!editTitle.trim()) {
      setEditingActivityId(null);
      return;
    }
    try {
      const res = await fetch(`/api/activities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setActivities(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a));
      }
    } catch { /* ignore */ }
    setEditingActivityId(null);
  }

  async function changeActivityType(id: number, newType: string) {
    try {
      const res = await fetch(`/api/activities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_type: newType }),
      });
      if (res.ok) {
        const updated = await res.json();
        setActivities(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a));
      }
    } catch { /* ignore */ }
  }

  async function addActivity(date: string, classId: number) {
    if (!addTitle.trim()) {
      setAddingFor(null);
      return;
    }

    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: classId,
          date,
          title: addTitle.trim(),
          lesson_plan_id: plan?.id || null,
          activity_type: 'lesson',
          material_status: 'not_needed',
        }),
      });
      if (res.ok) {
        const newAct = await res.json();
        setActivities(prev => [...prev, newAct]);
      }
    } catch { /* ignore */ }

    setAddTitle('');
    setAddingFor(null);
  }

  // ──────────────── Save / Publish ────────────────

  async function savePlanField(field: string, value: unknown) {
    if (!plan) return;
    try {
      const res = await fetch(`/api/lesson-plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlan(updated);
      }
    } catch { /* ignore */ }
  }

  async function saveDraft() {
    if (!plan) return;
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/lesson-plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlan(updated);
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
    setTimeout(() => setSaveStatus('idle'), 2000);
  }

  async function publishPlan() {
    if (!plan) return;
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/lesson-plans/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_plan_id: plan.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlan({ ...plan, status: 'published', publish_token: data.token });
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
    setTimeout(() => setSaveStatus('idle'), 2000);
  }

  // ──────────────── Week Navigation ────────────────

  function shiftWeek(offset: number) {
    const d = new Date(weekOf + 'T12:00:00');
    d.setDate(d.getDate() + offset * 7);
    setWeekOf(d.toISOString().split('T')[0]);
  }

  // ──────────────── Derived Data ────────────────

  const weekDates = getWeekDates(weekOf);

  // Group activities by date, then by class
  function getActivitiesForDayClass(date: string, classId: number): ActivityData[] {
    return activities
      .filter(a => a.date === date && a.class_id === classId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  // ──────────────── Render ────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Lesson Plans</h1>
          <p className="text-sm text-text-muted mt-1">
            Brainstorm with AI, then generate your weekly plan
          </p>
        </div>

        {/* Week Picker */}
        <div className="flex items-center gap-2">
          <button onClick={() => shiftWeek(-1)}
            className="px-2 py-1 text-text-secondary hover:text-accent transition-colors">
            &larr;
          </button>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={weekOf}
              onChange={e => {
                const val = e.target.value;
                if (val) setWeekOf(getMonday(val));
              }}
              className="px-3 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none"
            />
            <span className="text-sm text-text-secondary hidden sm:inline">
              {formatWeekLabel(weekOf)}
            </span>
          </div>
          <button onClick={() => shiftWeek(1)}
            className="px-2 py-1 text-text-secondary hover:text-accent transition-colors">
            &rarr;
          </button>
          <button onClick={() => setWeekOf(getCurrentMonday())}
            className="px-2 py-1 text-xs text-accent hover:underline">
            Today
          </button>
        </div>
      </div>

      {/* Status bar */}
      {plan && (
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="px-2 py-1 rounded-full font-medium bg-bg-card border border-border text-text-secondary">
            {plan.status === 'published' ? 'Published' : 'Draft'}
          </span>
          <span className="text-text-muted">
            {chatMessages.length} messages &middot; {activities.length} activities
          </span>
          {plan.status === 'published' && plan.publish_token && (
            <a
              href={`/plans/${plan.publish_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              View Published &rarr;
            </a>
          )}
          <Link
            href={`/bellringer/batch?week_of=${weekOf}`}
            className="text-accent hover:underline"
          >
            Set up Bellringers &rarr;
          </Link>
          {saveStatus === 'saving' && <span className="text-text-muted">Saving...</span>}
          {saveStatus === 'saved' && <span className="text-text-secondary">Saved!</span>}
          {saveStatus === 'error' && <span className="text-accent-red">Save failed</span>}
        </div>
      )}

      {/* Mobile panel toggle */}
      <div className="flex lg:hidden gap-2">
        <button
          onClick={() => setActivePanel('chat')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activePanel === 'chat'
              ? 'bg-accent text-bg-primary'
              : 'bg-bg-card border border-border text-text-secondary'
          }`}>
          Brainstorm Chat
        </button>
        <button
          onClick={() => setActivePanel('grid')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activePanel === 'grid'
              ? 'bg-accent text-bg-primary'
              : 'bg-bg-card border border-border text-text-secondary'
          }`}>
          Weekly Grid
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        /* Split layout */
        <div className="flex flex-col lg:flex-row gap-4" style={{ height: 'calc(100vh - 220px)' }}>

          {/* ──────────── LEFT PANEL: Brainstorm Chat ──────────── */}
          <div className={`lg:w-[420px] lg:shrink-0 flex flex-col rounded-xl bg-bg-card border border-border overflow-hidden ${
            activePanel !== 'chat' ? 'hidden lg:flex' : 'flex'
          }`}>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">AI Brainstorm</h2>
              {chatMessages.length > 0 && (
                <button
                  onClick={generatePlan}
                  disabled={parsing || chatMessages.length === 0}
                  className="px-3 py-1.5 bg-accent text-bg-primary rounded-lg font-semibold text-xs hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
                  {parsing ? (
                    <>
                      <span className="w-3 h-3 border-2 border-bg-primary border-t-transparent rounded-full animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    <>Generate Plan &rarr;</>
                  )}
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-text-muted text-sm mb-2">No messages yet.</p>
                  <p className="text-text-muted text-xs">
                    Start brainstorming your lesson plan for the week of {formatWeekLabel(weekOf)}.
                    Tell me what topics you&apos;re covering, what books you&apos;re reading, or any ideas you have!
                  </p>
                </div>
              )}

              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-accent text-bg-primary rounded-br-sm'
                      : 'bg-bg-secondary text-text-secondary rounded-bl-sm'
                  }`}>
                    {msg.content.split('\n').map((line, i) => (
                      <span key={i}>
                        {line}
                        {i < msg.content.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {chatSending && (
                <div className="flex justify-start">
                  <div className="bg-bg-secondary rounded-xl px-4 py-3 rounded-bl-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type your ideas..."
                  disabled={chatSending}
                  className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={chatSending || !chatInput.trim()}
                  className="px-4 py-2 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed">
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* ──────────── RIGHT PANEL: Weekly Grid ──────────── */}
          <div className={`flex-1 flex flex-col rounded-xl bg-bg-card border border-border overflow-hidden ${
            activePanel !== 'grid' ? 'hidden lg:flex' : 'flex'
          }`}>
            {/* Grid header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">
                Weekly Plan &mdash; {formatWeekLabel(weekOf)}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={saveDraft}
                  disabled={!plan || saveStatus === 'saving'}
                  className="px-3 py-1.5 bg-bg-input border border-border text-text-secondary rounded-lg text-xs font-medium hover:border-accent hover:text-text-primary transition-colors disabled:opacity-50">
                  Save Draft
                </button>
                <button
                  onClick={publishPlan}
                  disabled={!plan || saveStatus === 'saving'}
                  className="px-3 py-1.5 bg-accent-green text-white rounded-lg text-xs font-semibold hover:brightness-110 disabled:opacity-50">
                  Publish
                </button>
              </div>
            </div>

            {/* Grid body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {/* Announcements */}
              {plan && (
                <div className="rounded-lg bg-bg-secondary border border-border p-3">
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                    Announcements
                  </label>
                  <input
                    type="text"
                    value={announcements}
                    onChange={e => setAnnouncements(e.target.value)}
                    onBlur={() => savePlanField('announcements', announcements || null)}
                    placeholder="e.g., Library visit Thursday, essay due Friday..."
                    className="w-full px-3 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none placeholder:text-text-muted"
                  />
                </div>
              )}

              {/* Writers Corner */}
              {plan && classes.length > 0 && (
                <div className="rounded-lg bg-bg-secondary border border-border p-3">
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                    Writers Corner
                  </label>
                  <div className="space-y-1.5">
                    {classes.map(cls => (
                      <div key={cls.id} className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary w-24 shrink-0">{cls.name}:</span>
                        <input
                          type="text"
                          value={writersCorner[String(cls.id)] || ''}
                          onChange={e => setWritersCorner(prev => ({ ...prev, [String(cls.id)]: e.target.value }))}
                          onBlur={() => savePlanField('writers_corner', writersCorner)}
                          placeholder="Student name(s)..."
                          className="flex-1 px-2 py-1 bg-bg-input border border-border rounded text-text-primary text-xs focus:border-accent focus:outline-none placeholder:text-text-muted"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activities.length === 0 && !loading && (
                <div className="text-center py-12">
                  <p className="text-text-muted text-sm mb-1">No activities yet.</p>
                  <p className="text-text-muted text-xs">
                    Use the brainstorm chat to plan your week, then click &quot;Generate Plan&quot; to populate this grid.
                  </p>
                </div>
              )}

              {weekDates.map((date, dayIdx) => {
                const dayActivities = activities.filter(a => a.date === date);
                if (dayActivities.length === 0 && activities.length === 0) return null;

                return (
                  <div key={date} className="space-y-2">
                    {/* Day header */}
                    <div className="flex items-center gap-2 sticky top-0 bg-bg-card z-10 py-1">
                      <h3 className="text-sm font-bold text-text-primary">
                        {DAY_NAMES[dayIdx]}
                      </h3>
                      <span className="text-xs text-text-muted">{formatDate(date)}</span>
                      {dayActivities.length > 0 && (
                        <span className="text-xs text-text-muted ml-auto">
                          {dayActivities.length} activit{dayActivities.length === 1 ? 'y' : 'ies'}
                        </span>
                      )}
                    </div>

                    {/* Classes for this day */}
                    {classes.map(cls => {
                      const clsActivities = getActivitiesForDayClass(date, cls.id);
                      const isAddingHere = addingFor?.date === date && addingFor?.classId === cls.id;

                      return (
                        <div key={`${date}-${cls.id}`}
                          className="rounded-lg bg-bg-secondary border border-border/50 p-3">
                          {/* Class header */}
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cls.color || '#4ECDC4' }}
                            />
                            <span className="text-xs font-semibold text-text-primary">{cls.name}</span>
                            {cls.periods && (
                              <span className="text-[0.6rem] text-text-muted">{cls.periods}</span>
                            )}
                          </div>

                          {/* Activities */}
                          {clsActivities.length > 0 && (
                            <div className="space-y-1.5 mb-2">
                              {clsActivities.map(act => (
                                <div key={act.id}
                                  className="flex items-center gap-2 group rounded-md bg-bg-card/50 px-2.5 py-1.5">
                                  {/* Bullet */}
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-text-muted" />

                                  {/* Title (editable) */}
                                  {editingActivityId === act.id ? (
                                    <input
                                      autoFocus
                                      value={editTitle}
                                      onChange={e => setEditTitle(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') saveActivityTitle(act.id);
                                        if (e.key === 'Escape') setEditingActivityId(null);
                                      }}
                                      onBlur={() => saveActivityTitle(act.id)}
                                      className="flex-1 px-1.5 py-0.5 bg-bg-input border border-accent rounded text-text-primary text-xs focus:outline-none"
                                    />
                                  ) : (
                                    <span
                                      className="flex-1 text-xs text-text-secondary cursor-pointer hover:text-text-primary transition-colors"
                                      onClick={() => { setEditingActivityId(act.id); setEditTitle(act.title); }}>
                                      {act.title}
                                    </span>
                                  )}

                                  {/* Type dropdown */}
                                  <select
                                    value={act.activity_type}
                                    onChange={e => changeActivityType(act.id, e.target.value)}
                                    className="px-1.5 py-0.5 rounded text-[0.6rem] font-medium shrink-0 bg-bg-secondary border border-border text-text-secondary cursor-pointer focus:outline-none focus:border-accent"
                                  >
                                    {ACTIVITY_TYPES.map(t => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>

                                  {/* Materials button */}
                                  <button
                                    onClick={() => setMaterialActivity(act)}
                                    className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity text-xs hover:text-accent shrink-0"
                                    title="Generate materials">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </button>

                                  {/* Delete button */}
                                  <button
                                    onClick={() => deleteActivity(act.id)}
                                    className="text-accent-red opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold hover:text-accent-red/80 shrink-0"
                                    title="Delete activity">
                                    &times;
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add activity */}
                          {isAddingHere ? (
                            <div className="flex gap-1.5">
                              <input
                                autoFocus
                                value={addTitle}
                                onChange={e => setAddTitle(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') addActivity(date, cls.id);
                                  if (e.key === 'Escape') { setAddingFor(null); setAddTitle(''); }
                                }}
                                onBlur={() => {
                                  if (addTitle.trim()) addActivity(date, cls.id);
                                  else { setAddingFor(null); setAddTitle(''); }
                                }}
                                placeholder="Activity title..."
                                className="flex-1 px-2 py-1 bg-bg-input border border-accent rounded text-text-primary text-xs focus:outline-none"
                              />
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAddingFor({ date, classId: cls.id }); setAddTitle(''); }}
                              className="text-[0.65rem] text-text-muted hover:text-accent transition-colors">
                              + Add Activity
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Separator between days */}
                    {dayIdx < 4 && (
                      <div className="border-b border-border/30 mt-2" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Material Generator Panel */}
      {materialActivity && (
        <MaterialGeneratorPanel
          activity={{ ...materialActivity, date: materialActivity.date ?? undefined }}
          onClose={() => setMaterialActivity(null)}
          onSaved={() => {
            setMaterialActivity(null);
            loadActivities();
          }}
        />
      )}
    </div>
  );
}
