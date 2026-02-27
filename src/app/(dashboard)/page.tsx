'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import DayDetailModal from '@/components/DayDetailModal';
import TaskTable from '@/components/TaskTable';
import type { Task } from '@/lib/types';
import { localDateStr } from '@/lib/task-helpers';

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
  tasks: Task[];
  hasBellringer: boolean;
  bellringerApproved: boolean;
}

interface ActivityData {
  id: number;
  class_id: number;
  date: string;
  title: string;
  description: string | null;
  activity_type: string;
  material_status: string;
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

function getWeekdays(count = 5): string[] {
  const days: string[] = [];
  const d = new Date();
  while (days.length < count) {
    if (d.getDay() >= 1 && d.getDay() <= 5) {
      // Use local date parts to avoid timezone shift
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      days.push(`${yyyy}-${mm}-${dd}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export default function Dashboard() {
  const today = localDateStr();

  const [weekdayDates] = useState(() => getWeekdays(5));
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Today's lessons state
  const [todayActivities, setTodayActivities] = useState<ActivityData[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);

  // Countdown state
  const [gradingEnd, setGradingEnd] = useState<{ days: number; date: string; title: string } | null>(null);
  const [semesterEnd, setSemesterEnd] = useState<{ days: number; date: string; title: string } | null>(null);
  const [nextDayOff, setNextDayOff] = useState<{ date: string; title: string; days: number } | null>(null);

  // Load countdowns
  useEffect(() => {
    async function loadCountdowns() {
      try {
        const futureEnd = new Date();
        futureEnd.setMonth(futureEnd.getMonth() + 6);
        const endStr = localDateStr(futureEnd);

        const eventsRes = await fetch(`/api/calendar/events?start=${today}&end=${endStr}`);
        const events: CalendarEvent[] = (await eventsRes.json()) || [];
        const futureEvents = events.filter((e) => e.date > today)
          .sort((a, b) => a.date.localeCompare(b.date));

        const countSchoolDays = (endDate: string) => {
          const end = new Date(endDate + 'T12:00:00');
          const start = new Date();
          start.setHours(12, 0, 0, 0);
          let count = 0;
          const d = new Date(start);
          while (d <= end) {
            const day = d.getDay();
            if (day >= 1 && day <= 5) count++;
            d.setDate(d.getDate() + 1);
          }
          return Math.max(0, count - 1);
        };

        const formatDate = (dateStr: string) => {
          const d = new Date(dateStr + 'T12:00:00');
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };

        // Fuzzy match grading period end from calendar events
        const gradingPatterns = /end\s+of\s+(\d+\w*\s+)?(nine\s*weeks|9\s*weeks|grading\s*period|marking\s*period|quarter)/i;
        const semesterPatterns = /end\s+of\s+(\d+\w*\s+)?semester|last\s+day\s+of\s+(classes|school)/i;

        const nextGrading = futureEvents.find(e => gradingPatterns.test(e.title || ''));
        const nextSemester = futureEvents.find(e => semesterPatterns.test(e.title || ''));

        if (nextGrading) {
          setGradingEnd({
            days: countSchoolDays(nextGrading.date),
            date: formatDate(nextGrading.date),
            title: nextGrading.title,
          });
        }

        if (nextSemester) {
          // Don't show semester if it's the same date as grading period
          if (!nextGrading || nextSemester.date !== nextGrading.date) {
            setSemesterEnd({
              days: countSchoolDays(nextSemester.date),
              date: formatDate(nextSemester.date),
              title: nextSemester.title,
            });
          }
        }

        // Also check if grading period event title contains semester info
        // e.g. "End of 2nd Nine Weeks / End of 1st Semester"
        if (nextGrading && !nextSemester && semesterPatterns.test(nextGrading.title || '')) {
          // The grading period event IS also a semester end — find the NEXT semester after it
          const laterSemester = futureEvents.find(e => e.date > nextGrading.date && semesterPatterns.test(e.title || ''));
          if (laterSemester) {
            setSemesterEnd({
              days: countSchoolDays(laterSemester.date),
              date: formatDate(laterSemester.date),
              title: laterSemester.title,
            });
          }
        }

        // Find next day off
        const dayOffTypes = ['holiday', 'break', 'professional_day'];
        const dayOffPatterns = /professional\s*day|in-?\s*service|no\s+school|no\s+students/i;
        const nextOff = futureEvents.find(e =>
          dayOffTypes.includes(e.event_type) ||
          dayOffPatterns.test(e.title || '') ||
          dayOffPatterns.test(e.notes || '')
        );

        if (nextOff) {
          const offDate = new Date(nextOff.date + 'T12:00:00');
          const todayDate = new Date(today + 'T12:00:00');
          const diffMs = offDate.getTime() - todayDate.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          setNextDayOff({ date: nextOff.date, title: nextOff.title, days: diffDays });
        }
      } catch { /* ignore */ }
    }
    loadCountdowns();
  }, [today]);

  // Load classes and today's activities
  useEffect(() => {
    fetch('/api/classes').then(r => r.json()).then(setClasses).catch(() => {});
    fetch(`/api/day/${today}`).then(r => r.json()).then(data => {
      setTodayActivities(data.activities || []);
    }).catch(() => {});
  }, [today]);

  // Group today's activities by class
  const activitiesByClass: Record<number, ActivityData[]> = {};
  for (const act of todayActivities) {
    if (!activitiesByClass[act.class_id]) activitiesByClass[act.class_id] = [];
    activitiesByClass[act.class_id].push(act);
  }

  const loadWeekDays = useCallback(async () => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
            tasks: (data.tasks || []) as Task[],
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
            tasks: [],
            hasBellringer: false,
            bellringerApproved: false,
          };
        }
      })
    );

    setWeekDays(results);
  }, [today, weekdayDates]);

  useEffect(() => { loadWeekDays(); }, [loadWeekDays]);

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
          <a href={`/display/${today}`} target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-accent-yellow text-[#111] rounded-lg font-bold text-sm hover:brightness-110">
            Display on TV
          </a>
        </div>
      </div>

      {/* Countdown Stats */}
      {(gradingEnd || semesterEnd || nextDayOff) && (
        <div className="flex flex-wrap gap-3">
          {nextDayOff && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-card border border-border">
              <span className="text-2xl font-bold text-accent-yellow">{nextDayOff.days}</span>
              <span className="text-xs text-text-muted leading-tight">days to next day off<br/><span className="text-text-secondary">{new Date(nextDayOff.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &middot; {nextDayOff.title}</span></span>
            </div>
          )}
          {gradingEnd && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-card border border-border">
              <span className="text-2xl font-bold text-accent">{gradingEnd.days}</span>
              <span className="text-xs text-text-muted leading-tight">school days to grading period end<br/><span className="text-text-secondary">{gradingEnd.date} &middot; {gradingEnd.title}</span></span>
            </div>
          )}
          {semesterEnd && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-card border border-border">
              <span className="text-2xl font-bold text-accent">{semesterEnd.days}</span>
              <span className="text-xs text-text-muted leading-tight">school days to semester end<br/><span className="text-text-secondary">{semesterEnd.date} &middot; {semesterEnd.title}</span></span>
            </div>
          )}
        </div>
      )}

      {/* 5-Day Calendar Strip */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">This Week</h2>
          <Link href="/calendar" className="text-xs text-accent hover:underline">
            See full calendar
          </Link>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {weekDays.map(day => {
            const pendingTasks = day.tasks.filter(t => !t.is_done);
            return (
              <button key={day.date} onClick={() => setSelectedDate(day.date)}
                className={`rounded-xl p-5 border text-left transition-all hover:border-accent flex flex-col ${
                  day.isToday ? 'border-accent bg-bg-card' : 'border-border bg-bg-secondary'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-text-muted uppercase font-medium">{day.dayName}</span>
                  <span className={`text-lg font-bold ${day.isToday ? 'text-accent' : 'text-text-primary'}`}>{day.display}</span>
                </div>
                {/* Bellringer indicator */}
                {day.hasBellringer && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${day.bellringerApproved ? 'bg-accent-green' : 'bg-accent-yellow'}`} />
                    <span className="text-sm text-text-muted">Bellringer</span>
                  </div>
                )}
                {/* Calendar events */}
                {day.events.length > 0 && (
                  <div className="space-y-1">
                    {day.events.slice(0, 2).map(evt => (
                      <div key={evt.id} className="text-sm text-text-secondary truncate leading-snug">
                        {evt.title}
                      </div>
                    ))}
                    {day.events.length > 2 && (
                      <div className="text-sm text-text-muted">+{day.events.length - 2} more</div>
                    )}
                  </div>
                )}
                {/* Tasks due */}
                {pendingTasks.length > 0 && (
                  <div className="space-y-1 mt-1">
                    {pendingTasks.slice(0, 2).map(task => (
                      <div key={task.id} className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-sm bg-accent-yellow shrink-0" />
                        <span className="text-sm text-text-secondary truncate leading-snug">{task.text}</span>
                      </div>
                    ))}
                    {pendingTasks.length > 2 && (
                      <div className="text-sm text-text-muted">+{pendingTasks.length - 2} tasks</div>
                    )}
                  </div>
                )}
                {day.events.length === 0 && pendingTasks.length === 0 && !day.hasBellringer && (
                  <div className="text-sm text-text-muted mt-2">No events</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks — managed by TaskTable */}
        <TaskTable onTasksChanged={loadWeekDays} />

        {/* Today's Lessons */}
        <div className="rounded-xl bg-bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text-primary">Today&apos;s Lessons</h2>
            <div className="flex items-center gap-2">
              <Link href={`/sub`} className="text-xs text-text-secondary hover:text-accent transition-colors">Sub Pack</Link>
              <Link href="/lesson-plans" className="text-xs text-accent hover:underline">Plans</Link>
            </div>
          </div>

          {classes.length > 0 ? (
            <div className="space-y-3">
              {classes.map(cls => {
                const acts = activitiesByClass[cls.id] || [];

                return (
                  <div key={cls.id}
                    className={`rounded-lg bg-bg-secondary border border-border/50 p-3 ${cls.color ? 'border-l-4' : ''}`}
                    style={cls.color ? { borderLeftColor: cls.color } : undefined}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-text-primary">{cls.name}</h3>
                        {cls.periods && (
                          <span className="text-[0.65rem] text-text-muted">{cls.periods}</span>
                        )}
                      </div>
                      {acts.length > 0 && (
                        <span className="text-[0.65rem] text-text-muted">
                          {acts.length} activit{acts.length === 1 ? 'y' : 'ies'}
                        </span>
                      )}
                    </div>

                    {acts.length > 0 ? (
                      <div className="space-y-1">
                        {acts.map(act => (
                          <div key={act.id} className="flex items-center gap-2 group">
                            <Link href="/lesson-plans" className="shrink-0" title={
                              act.material_status === 'ready' ? 'Materials ready' :
                              act.material_status === 'pending' ? 'Materials pending' : 'No materials'
                            }>
                              <svg className={`w-4 h-4 ${
                                act.material_status === 'ready'
                                  ? 'text-accent-green'
                                  : act.material_status === 'pending'
                                  ? 'text-accent-yellow'
                                  : 'text-text-muted/40'
                              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            </Link>
                            <span className="text-xs text-text-secondary">
                              {act.title}
                            </span>
                            {act.is_graded && (
                              <span className="text-accent-yellow text-[0.6rem]">&#9733;</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted">No activities planned</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-muted">No classes configured yet.</p>
          )}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          onClose={() => { setSelectedDate(null); loadWeekDays(); }}
          onDataChanged={loadWeekDays}
          onDateChange={setSelectedDate}
        />
      )}
    </div>
  );
}
