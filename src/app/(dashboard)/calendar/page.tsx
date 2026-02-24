'use client';

import { useEffect, useState, useCallback } from 'react';
import DayDetailModal from '@/components/DayDetailModal';

interface CalendarEvent {
  id: number;
  date: string;
  event_type: string;
  title: string;
  notes: string | null;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  holiday: 'bg-accent-red',
  break: 'bg-card2',
  testing: 'bg-accent-yellow',
  assembly: 'bg-card3',
  custom: 'bg-accent',
  school_day: 'bg-accent-green',
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newEvent, setNewEvent] = useState({ date: '', event_type: 'custom', title: '', notes: '' });
  const [toast, setToast] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const loadEvents = useCallback(async () => {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const startDate = `${monthStr}-01`;
    const endDate = `${monthStr}-31`;
    try {
      const res = await fetch(`/api/calendar/events?start=${startDate}&end=${endDate}`);
      const data = await res.json();
      setEvents(data || []);
    } catch { /* ignore */ }
  }, [year, month]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  async function addEvent() {
    if (!newEvent.date || !newEvent.title) return;
    await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvent),
    });
    setNewEvent({ date: '', event_type: 'custom', title: '', notes: '' });
    setShowAdd(false);
    loadEvents();
    setToast('Event added!');
    setTimeout(() => setToast(null), 3000);
  }

  async function deleteEvent(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/calendar/events/${id}`, { method: 'DELETE' });
    loadEvents();
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  }

  const inputCls = 'w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Calendar</h1>
        <button onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110">
          {showAdd ? 'Cancel' : 'Add Event'}
        </button>
      </div>

      {/* Add Event Form */}
      {showAdd && (
        <div className="rounded-xl bg-bg-card border border-accent p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <input type="date" value={newEvent.date} onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))} className={inputCls} />
            <select value={newEvent.event_type} onChange={e => setNewEvent(p => ({ ...p, event_type: e.target.value }))} className={inputCls}>
              <option value="custom">Custom</option>
              <option value="holiday">Holiday</option>
              <option value="break">Break</option>
              <option value="testing">Testing</option>
              <option value="assembly">Assembly</option>
              <option value="school_day">School Day</option>
            </select>
            <input type="text" value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
              placeholder="Title" className={inputCls} />
            <input type="text" value={newEvent.notes} onChange={e => setNewEvent(p => ({ ...p, notes: e.target.value }))}
              placeholder="Notes (optional)" className={inputCls} />
          </div>
          <button onClick={addEvent} className="px-4 py-2 bg-accent-green text-white rounded-lg font-semibold text-sm">
            Save Event
          </button>
        </div>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="px-3 py-1 text-text-secondary hover:text-accent transition-colors text-lg">&larr;</button>
        <h2 className="text-xl font-bold text-text-primary">{MONTH_NAMES[month]} {year}</h2>
        <button onClick={nextMonth} className="px-3 py-1 text-text-secondary hover:text-accent transition-colors text-lg">&rarr;</button>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
        {/* Day names header */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-xs text-text-muted uppercase py-2 font-semibold">{d}</div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
            const dayEvents = dateStr ? eventsByDate[dateStr] || [] : [];
            const isToday = dateStr === today;

            return (
              <div
                key={i}
                onClick={() => day && setSelectedDate(dateStr)}
                className={`min-h-[80px] p-1.5 border-b border-r border-border cursor-pointer transition-colors
                  ${day ? 'bg-bg-secondary hover:bg-hover' : 'bg-bg-primary cursor-default'}`}
              >
                {day && (
                  <>
                    <div className={`text-sm font-medium mb-0.5 ${isToday ? 'text-accent font-bold' : 'text-text-secondary'}`}>
                      {day}
                    </div>
                    {dayEvents.map(evt => (
                      <div key={evt.id} className="group flex items-start gap-1 mb-0.5">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${EVENT_TYPE_COLORS[evt.event_type] || 'bg-accent'}`} />
                        <span className="text-[0.65rem] text-text-secondary leading-tight flex-1 truncate" title={evt.title}>
                          {evt.title}
                        </span>
                        <button onClick={(e) => deleteEvent(evt.id, e)}
                          className="text-accent-red opacity-0 group-hover:opacity-100 text-[0.6rem] shrink-0 transition-opacity">
                          &times;
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          onClose={() => { setSelectedDate(null); loadEvents(); }}
          onDataChanged={loadEvents}
        />
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
