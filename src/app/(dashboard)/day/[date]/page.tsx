'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MaterialGeneratorPanel from '@/components/MaterialGeneratorPanel';

interface CalendarEvent {
  id: number;
  date: string;
  event_type: string;
  title: string;
  notes: string | null;
}

interface TaskItem {
  id: number;
  text: string;
  due_date: string | null;
  is_done: boolean;
}

interface BellringerData {
  id: number;
  date: string;
  status: string;
  is_approved: boolean;
  journal_prompt: string | null;
  act_skill: string | null;
  act_skill_category: string | null;
  prompts?: { slot: number; journal_type: string | null; journal_prompt: string | null }[];
}

interface ActivityData {
  id: number;
  class_id: number;
  date: string;
  title: string;
  description: string | null;
  activity_type: string;
  material_status: string;
  material_content: Record<string, unknown> | null;
  is_done: boolean;
  is_graded: boolean;
  moved_to_date: string | null;
  classes: { name: string; periods: string | null; color: string | null } | null;
}

interface ClassInfo {
  id: number;
  name: string;
  periods: string | null;
  color: string | null;
}

interface DayData {
  date: string;
  events: CalendarEvent[];
  tasks: TaskItem[];
  unscheduled_tasks: TaskItem[];
  bellringer: BellringerData | null;
  activities: ActivityData[];
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  holiday: 'bg-accent-red',
  break: 'bg-card2',
  testing: 'bg-accent-yellow',
  assembly: 'bg-card3',
  custom: 'bg-accent',
  school_day: 'bg-accent-green',
};

function formatDateDisplay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function DayViewPage() {
  const params = useParams();
  const router = useRouter();
  const dateStr = params.date === 'today'
    ? new Date().toISOString().split('T')[0]
    : String(params.date);

  const today = new Date().toISOString().split('T')[0];
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [bumpingId, setBumpingId] = useState<number | null>(null);
  const [newTask, setNewTask] = useState('');
  const [generatingFor, setGeneratingFor] = useState<ActivityData | null>(null);

  const loadDay = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/day/${dateStr}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [dateStr]);

  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/classes');
      if (res.ok) setClasses(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadDay(); loadClasses(); }, [loadDay, loadClasses]);

  function goDate(offset: number) {
    router.push(`/day/${shiftDate(dateStr, offset)}`);
  }

  async function toggleTask(id: number, done: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_done: done }),
    });
    loadDay();
  }

  async function addTask() {
    if (!newTask.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newTask.trim(), due_date: dateStr }),
    });
    setNewTask('');
    loadDay();
  }

  async function toggleActivity(id: number, done: boolean) {
    await fetch(`/api/activities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_done: done }),
    });
    loadDay();
  }

  async function bumpActivity(id: number) {
    setBumpingId(id);
    try {
      await fetch(`/api/activities/${id}/bump`, { method: 'POST' });
      loadDay();
    } catch { /* ignore */ }
    setBumpingId(null);
  }

  async function markReady(id: number) {
    await fetch(`/api/activities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ material_status: 'ready' }),
    });
    loadDay();
  }

  // Group activities by class
  const activitiesByClass: Record<number, ActivityData[]> = {};
  for (const act of data?.activities || []) {
    if (!activitiesByClass[act.class_id]) activitiesByClass[act.class_id] = [];
    activitiesByClass[act.class_id].push(act);
  }

  const b = data?.bellringer;
  const bellStatus = !b
    ? { label: 'Not Created', color: 'text-text-muted', bg: 'bg-bg-input' }
    : b.is_approved
      ? { label: 'Approved', color: 'text-accent-green', bg: 'bg-accent-green/15' }
      : { label: 'Draft', color: 'text-accent-yellow', bg: 'bg-accent-yellow/15' };

  return (
    <div className="space-y-6">
      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => goDate(-1)}
          className="px-3 py-1.5 text-text-secondary hover:text-accent transition-colors text-lg">
          &larr; Prev
        </button>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">{formatDateDisplay(dateStr)}</h1>
          {dateStr === today && (
            <span className="text-xs text-accent font-semibold uppercase tracking-wider">Today</span>
          )}
        </div>
        <button onClick={() => goDate(1)}
          className="px-3 py-1.5 text-text-secondary hover:text-accent transition-colors text-lg">
          Next &rarr;
        </button>
      </div>

      {/* Quick nav + Sub Pack button */}
      <div className="flex items-center justify-center gap-4">
        {dateStr !== today && (
          <button onClick={() => router.push(`/day/${today}`)}
            className="text-sm text-accent hover:underline">
            Jump to Today
          </button>
        )}
        <Link href={`/subpack?date=${dateStr}`}
          className="text-sm text-text-secondary hover:text-accent transition-colors">
          Generate Sub Pack
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data ? (
        <div className="space-y-5">
          {/* Bellringer Card */}
          <div className="rounded-xl bg-bg-card border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-text-primary">Bellringer</h2>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${bellStatus.bg} ${bellStatus.color}`}>
                {bellStatus.label}
              </span>
            </div>

            {b ? (
              <div className="space-y-3">
                {b.prompts && b.prompts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {b.prompts.map((p, i) => (
                      <div key={i} className="rounded-lg bg-bg-secondary p-2.5">
                        <div className="text-[0.65rem] uppercase tracking-wider text-text-muted mb-1">
                          {p.journal_type || 'Prompt'} #{p.slot + 1}
                        </div>
                        <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed">
                          {p.journal_prompt || '(empty)'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : b.journal_prompt ? (
                  <p className="text-sm text-text-secondary leading-relaxed">{b.journal_prompt}</p>
                ) : null}

                {b.act_skill && (
                  <p className="text-xs text-text-muted">
                    ACT: {b.act_skill_category} &mdash; {b.act_skill}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No bellringer for this date.</p>
            )}

            <div className="flex gap-2 mt-4">
              <Link href={`/bellringer/edit/${dateStr}`}
                className="px-3 py-1.5 bg-accent text-bg-primary rounded-lg font-semibold text-xs hover:brightness-110">
                {b ? 'Edit Bellringer' : 'Create Bellringer'}
              </Link>
              {b && (
                <Link href={`/display/${dateStr}`}
                  className="px-3 py-1.5 bg-accent-yellow text-[#111] rounded-lg font-bold text-xs hover:brightness-110">
                  Display on TV
                </Link>
              )}
            </div>
          </div>

          {/* Class Sections with Activities */}
          {classes.map(cls => {
            const acts = activitiesByClass[cls.id] || [];
            const readyCount = acts.filter(a => a.material_status === 'ready' || a.material_status === 'not_needed').length;
            const borderColor = cls.color ? `border-l-4` : '';

            return (
              <div key={cls.id}
                className={`rounded-xl bg-bg-card border border-border p-5 ${borderColor}`}
                style={cls.color ? { borderLeftColor: cls.color } : undefined}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">{cls.name}</h2>
                    {cls.periods && (
                      <p className="text-xs text-text-muted">{cls.periods}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {acts.length > 0 && (
                      <span className="text-xs text-text-muted">
                        {readyCount}/{acts.length} ready
                      </span>
                    )}
                    <Link href={`/classes/${cls.id}/history`}
                      className="text-xs text-accent hover:underline">
                      History
                    </Link>
                  </div>
                </div>

                {acts.length > 0 ? (
                  <div className="space-y-2">
                    {acts.map(act => (
                      <div key={act.id}
                        className={`flex items-start gap-3 rounded-lg bg-bg-secondary p-3 group ${act.is_done ? 'opacity-60' : ''}`}>
                        {/* Done checkbox */}
                        <button onClick={() => toggleActivity(act.id, !act.is_done)}
                          className={`mt-0.5 w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors
                            ${act.is_done ? 'bg-accent-green border-accent-green text-white' : 'border-border hover:border-accent'}`}>
                          {act.is_done && <span className="text-xs">&#10003;</span>}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {/* Material status indicator */}
                            <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                              act.material_status === 'ready' || act.material_status === 'not_needed'
                                ? 'bg-accent-green' : 'bg-accent-yellow'
                            }`} />
                            <p className={`text-sm font-medium ${act.is_done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                              {act.title}
                            </p>
                            {act.is_graded && (
                              <span className="text-accent-yellow text-xs">&#9733;</span>
                            )}
                          </div>
                          {act.description && (
                            <p className="text-xs text-text-muted mt-0.5 ml-4">{act.description}</p>
                          )}
                          {act.moved_to_date && (
                            <p className="text-xs text-accent-yellow mt-0.5 ml-4">
                              Bumped to {act.moved_to_date}
                            </p>
                          )}

                          {/* Material action buttons for items needing materials */}
                          {act.material_status === 'needs_material' && !act.is_done && (
                            <div className="flex gap-1.5 mt-2 ml-4">
                              <button onClick={() => setGeneratingFor(act)}
                                className="px-2 py-1 text-[0.65rem] bg-accent/20 text-accent rounded hover:bg-accent/30 transition-colors font-semibold">
                                Generate
                              </button>
                              <button onClick={() => markReady(act.id)}
                                className="px-2 py-1 text-[0.65rem] bg-accent-green/20 text-accent-green rounded hover:bg-accent-green/30 transition-colors">
                                Mark Ready
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Bump to tomorrow button */}
                        {!act.is_done && (
                          <button
                            onClick={() => bumpActivity(act.id)}
                            disabled={bumpingId === act.id}
                            className="mt-0.5 px-2 py-1 text-xs text-text-muted hover:text-accent hover:bg-accent/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Bump to next school day">
                            {bumpingId === act.id ? '...' : '\u2192'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">No activities for this date.</p>
                )}
              </div>
            );
          })}

          {/* Events Card */}
          {data.events.length > 0 && (
            <div className="rounded-xl bg-bg-card border border-border p-5">
              <h2 className="text-lg font-semibold text-text-primary mb-3">Events</h2>
              <div className="space-y-2">
                {data.events.map(evt => (
                  <div key={evt.id} className="flex items-start gap-3 rounded-lg bg-bg-secondary p-3">
                    <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${EVENT_TYPE_COLORS[evt.event_type] || 'bg-accent'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{evt.title}</p>
                      <p className="text-xs text-text-muted capitalize">{evt.event_type.replace('_', ' ')}</p>
                      {evt.notes && <p className="text-xs text-text-secondary mt-1">{evt.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks Section */}
          <div className="rounded-xl bg-bg-card border border-border p-5">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Other Tasks</h2>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="Add a task..."
                className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none"
              />
              <button onClick={addTask}
                className="px-3 py-2 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110">
                Add
              </button>
            </div>

            {data.tasks.length > 0 ? (
              <div className="space-y-2">
                {data.tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 group">
                    <button onClick={() => toggleTask(task.id, !task.is_done)}
                      className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors
                        ${task.is_done ? 'bg-accent-green border-accent-green text-white' : 'border-border hover:border-accent'}`}>
                      {task.is_done && <span className="text-xs">&#10003;</span>}
                    </button>
                    <span className={`text-sm ${task.is_done ? 'text-text-muted line-through' : 'text-text-secondary'}`}>
                      {task.text}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No tasks due on this date.</p>
            )}

            {data.unscheduled_tasks.length > 0 && (
              <>
                <div className="text-xs text-text-muted uppercase tracking-wider mt-4 mb-2">Unscheduled</div>
                <div className="space-y-2">
                  {data.unscheduled_tasks.map(task => (
                    <div key={task.id} className="flex items-center gap-3 group">
                      <button onClick={() => toggleTask(task.id, true)}
                        className="w-5 h-5 rounded border border-border hover:border-accent shrink-0 transition-colors" />
                      <span className="text-sm text-text-secondary">{task.text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Class Tiles (quick glance) */}
          {classes.length > 0 && (
            <div className="rounded-xl bg-bg-card border border-border p-5">
              <h2 className="text-lg font-semibold text-text-primary mb-3">Class Tiles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {classes.map(cls => {
                  const acts = activitiesByClass[cls.id] || [];
                  const readyCount = acts.filter(a => a.material_status === 'ready' || a.material_status === 'not_needed').length;
                  const doneCount = acts.filter(a => a.is_done).length;

                  return (
                    <Link key={cls.id} href={`/classes/${cls.id}/history`}
                      className="rounded-lg bg-bg-secondary border border-border p-4 hover:border-accent transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        {cls.color && (
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                        )}
                        <h3 className="text-sm font-semibold text-text-primary">{cls.name}</h3>
                      </div>
                      {cls.periods && (
                        <p className="text-xs text-text-muted mb-1">{cls.periods}</p>
                      )}
                      {acts.length > 0 ? (
                        <div className="text-xs text-text-secondary">
                          <span>{readyCount}/{acts.length} ready today</span>
                          {doneCount > 0 && <span className="ml-2">{doneCount} done</span>}
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted">No activities today</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-text-muted">Failed to load data for this date.</p>
      )}

      {/* Material Generator Panel */}
      {generatingFor && (
        <MaterialGeneratorPanel
          activity={generatingFor}
          onClose={() => setGeneratingFor(null)}
          onSaved={() => {
            setGeneratingFor(null);
            loadDay();
          }}
        />
      )}
    </div>
  );
}
