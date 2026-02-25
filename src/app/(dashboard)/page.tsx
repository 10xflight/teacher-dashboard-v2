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
          onClose={() => { setSelectedDate(null); loadWeekDays(); }}
          onDataChanged={loadWeekDays}
        />
      )}
    </div>
  );
}
