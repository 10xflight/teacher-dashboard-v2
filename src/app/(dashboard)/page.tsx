'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import DayDetailModal from '@/components/DayDetailModal';

interface TaskItem {
  id: number;
  text: string;
  due_date: string | null;
  is_done: boolean;
}

interface CalendarEvent {
  id: number;
  date: string;
  event_type: string;
  title: string;
  notes: string | null;
}

interface WeekDay {
  date: string;
  dayName: string;
  display: string;
  isToday: boolean;
  events: CalendarEvent[];
  hasBellringer: boolean;
  bellringerApproved: boolean;
}

function getWeekdays(count = 5): string[] {
  const days: string[] = [];
  const d = new Date();
  while (days.length < count) {
    if (d.getDay() >= 1 && d.getDay() <= 5) {
      days.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export default function Dashboard() {
  const today = new Date().toISOString().split('T')[0];
  const [weekdayDates] = useState(() => getWeekdays(5));

  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [tasksTodo, setTasksTodo] = useState<TaskItem[]>([]);
  const [tasksDone, setTasksDone] = useState<TaskItem[]>([]);
  const [newTask, setNewTask] = useState('');
  const [editingTask, setEditingTask] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasksTodo(data.todo || []);
      setTasksDone(data.done || []);
    } catch { /* ignore */ }
  }, []);

  const loadWeekDays = useCallback(async () => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Fetch all days in parallel instead of sequentially
    const results = await Promise.all(
      weekdayDates.map(async (dateStr) => {
        const d = new Date(dateStr + 'T12:00:00');
        try {
          const res = await fetch(`/api/day/${dateStr}`);
          const data = await res.json();
          return {
            date: dateStr,
            dayName: dayNames[d.getDay()],
            display: `${d.getMonth() + 1}/${d.getDate()}`,
            isToday: dateStr === today,
            events: data.events || [],
            hasBellringer: !!data.bellringer,
            bellringerApproved: data.bellringer?.is_approved || false,
          };
        } catch {
          return {
            date: dateStr,
            dayName: dayNames[d.getDay()],
            display: `${d.getMonth() + 1}/${d.getDate()}`,
            isToday: dateStr === today,
            events: [],
            hasBellringer: false,
            bellringerApproved: false,
          };
        }
      })
    );

    setWeekDays(results);
  }, [today, weekdayDates]);

  useEffect(() => { loadTasks(); loadWeekDays(); }, [loadTasks, loadWeekDays]);

  async function addTask() {
    if (!newTask.trim()) return;
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newTask.trim() }),
    });
    setNewTask('');
    loadTasks();
  }

  async function toggleTask(id: number, done: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_done: done }),
    });
    loadTasks();
  }

  async function deleteTask(id: number) {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
  }

  async function saveEdit(id: number) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: editText }),
    });
    setEditingTask(null);
    loadTasks();
  }

  const todayData = weekDays.find(d => d.isToday);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/bellringer/edit/${today}`}
            className="px-4 py-2 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110">
            Edit Bellringer
          </Link>
          <Link href={`/display/${today}`}
            className="px-4 py-2 bg-accent-yellow text-[#111] rounded-lg font-bold text-sm hover:brightness-110">
            Display on TV
          </Link>
        </div>
      </div>

      {/* 5-Day Calendar Strip — shows calendar events on tiles */}
      <div className="grid grid-cols-5 gap-3">
        {weekDays.map(day => (
          <button key={day.date} onClick={() => setSelectedDate(day.date)}
            className={`rounded-xl p-3 border text-left transition-all hover:border-accent ${
              day.isToday ? 'border-accent bg-bg-card' : 'border-border bg-bg-secondary'
            }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted uppercase">{day.dayName}</span>
              <span className={`text-sm font-bold ${day.isToday ? 'text-accent' : 'text-text-primary'}`}>{day.display}</span>
            </div>
            {/* Bellringer indicator */}
            {day.hasBellringer && (
              <div className="flex items-center gap-1 mb-1">
                <span className={`inline-block w-2 h-2 rounded-full ${day.bellringerApproved ? 'bg-accent-green' : 'bg-accent-yellow'}`} />
                <span className="text-[0.6rem] text-text-muted">Bellringer</span>
              </div>
            )}
            {/* Calendar events listed */}
            {day.events.length > 0 ? (
              <div className="space-y-0.5">
                {day.events.slice(0, 3).map(evt => (
                  <div key={evt.id} className="text-[0.6rem] text-text-secondary truncate leading-tight">
                    {evt.title}
                  </div>
                ))}
                {day.events.length > 3 && (
                  <div className="text-[0.6rem] text-text-muted">+{day.events.length - 3} more</div>
                )}
              </div>
            ) : (
              <div className="text-[0.6rem] text-text-muted mt-1">No events</div>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks — shows ALL tasks (today's due tasks are highlighted) */}
        <div className="rounded-xl bg-bg-card border border-border p-5">
          <h2 className="text-lg font-semibold text-text-primary mb-3">Tasks</h2>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="Add a task..."
              className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none"
            />
            <button onClick={addTask}
              className="px-4 py-2 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110">
              Add
            </button>
          </div>

          <div className="space-y-1.5 mb-4">
            {tasksTodo.map(task => (
              <div key={task.id} className="flex items-center gap-2 group">
                <button onClick={() => toggleTask(task.id, true)}
                  className="w-5 h-5 rounded border border-border hover:border-accent shrink-0 transition-colors" />
                {editingTask === task.id ? (
                  <input autoFocus value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(task.id); if (e.key === 'Escape') setEditingTask(null); }}
                    onBlur={() => saveEdit(task.id)}
                    className="flex-1 px-2 py-1 bg-bg-input border border-accent rounded text-text-primary text-sm focus:outline-none" />
                ) : (
                  <span className="flex-1 text-sm text-text-secondary cursor-pointer hover:text-text-primary"
                    onClick={() => { setEditingTask(task.id); setEditText(task.text); }}>
                    {task.text}
                  </span>
                )}
                {task.due_date && (
                  <span className={`text-xs ${task.due_date === today ? 'text-accent font-medium' : 'text-text-muted'}`}>
                    {task.due_date === today ? 'Today' : task.due_date}
                  </span>
                )}
                <button onClick={() => deleteTask(task.id)}
                  className="text-accent-red opacity-0 group-hover:opacity-100 text-xs hover:underline transition-opacity">
                  del
                </button>
              </div>
            ))}
            {tasksTodo.length === 0 && <p className="text-sm text-text-muted py-2">No tasks. Add one above!</p>}
          </div>

          {tasksDone.length > 0 && (
            <>
              <div className="text-xs text-text-muted uppercase tracking-wider mb-1.5">Completed</div>
              <div className="space-y-1">
                {tasksDone.map(task => (
                  <div key={task.id} className="flex items-center gap-2 group">
                    <button onClick={() => toggleTask(task.id, false)}
                      className="w-5 h-5 rounded bg-accent-green shrink-0 flex items-center justify-center text-white text-xs">
                      &#10003;
                    </button>
                    <span className="flex-1 text-sm text-text-muted line-through">{task.text}</span>
                    <button onClick={() => deleteTask(task.id)}
                      className="text-accent-red opacity-0 group-hover:opacity-100 text-xs hover:underline transition-opacity">
                      del
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Today's Bellringer Status */}
          <div className="rounded-xl bg-bg-card border border-border p-5">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Today&apos;s Bellringer</h2>
            {todayData?.hasBellringer ? (
              <div className="flex items-center gap-3">
                <span className={`inline-block w-3 h-3 rounded-full ${todayData.bellringerApproved ? 'bg-accent-green' : 'bg-accent-yellow'}`} />
                <span className="text-sm text-text-secondary">
                  {todayData.bellringerApproved ? 'Approved & Ready' : 'Draft - needs review'}
                </span>
                <Link href={`/bellringer/edit/${today}`} className="text-sm text-accent hover:underline ml-auto">Edit</Link>
                <Link href={`/display/${today}`} className="text-sm text-accent-yellow hover:underline">Display</Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="inline-block w-3 h-3 rounded-full bg-accent-red" />
                <span className="text-sm text-text-secondary">Not created yet</span>
                <Link href={`/bellringer/edit/${today}`} className="text-sm text-accent hover:underline ml-auto">Create Now</Link>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="rounded-xl bg-bg-card border border-border p-5">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Quick Links</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { href: `/bellringer/edit/${today}`, icon: '\u270E', label: 'Edit Bellringer' },
                { href: `/display/${today}`, icon: '\uD83D\uDCFA', label: 'TV Display' },
                { href: '/lesson-plans', icon: '\uD83D\uDCC4', label: 'Lesson Plans' },
                { href: '/bellringer/batch', icon: '\uD83D\uDCE6', label: 'Batch Bellringers' },
                { href: '/calendar', icon: '\uD83D\uDCC5', label: 'Calendar' },
                { href: '/settings', icon: '\u2699', label: 'Settings' },
              ].map(link => (
                <Link key={link.href} href={link.href}
                  className="block p-3 rounded-lg bg-bg-input border border-border hover:border-accent text-center transition-colors">
                  <div className="text-2xl mb-1">{link.icon}</div>
                  <div className="text-sm text-text-secondary">{link.label}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          onClose={() => { setSelectedDate(null); loadWeekDays(); loadTasks(); }}
          onDataChanged={() => { loadWeekDays(); loadTasks(); }}
        />
      )}
    </div>
  );
}
