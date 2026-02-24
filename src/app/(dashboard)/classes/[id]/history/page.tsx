'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface ClassInfo {
  id: number;
  name: string;
  periods: string | null;
  color: string | null;
}

interface ActivityItem {
  id: number;
  date: string;
  title: string;
  description: string | null;
  activity_type: string;
  material_status: string;
  is_done: boolean;
  is_graded: boolean;
  moved_to_date: string | null;
}

interface HistoryData {
  class: ClassInfo;
  activities: ActivityItem[];
  weeks: Record<string, ActivityItem[]>;
  stats: {
    total: number;
    done: number;
    ready: number;
    recent_titles: string[];
  };
}

function formatWeekLabel(mondayStr: string): string {
  const d = new Date(mondayStr + 'T12:00:00');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const day = d.getDate();
  const endDate = new Date(d);
  endDate.setDate(d.getDate() + 4);
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
  const endDay = endDate.getDate();

  if (month === endMonth) {
    return `${month} ${day}-${endDay}`;
  }
  return `${month} ${day} - ${endMonth} ${endDay}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${dayNames[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ClassHistoryPage() {
  const params = useParams();
  const classId = String(params.id);

  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/classes/${classId}/history`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [classId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-text-muted py-12">Class not found.</p>;
  }

  const weekKeys = Object.keys(data.weeks).sort().reverse();
  const completionRate = data.stats.total > 0 ? Math.round((data.stats.done / data.stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {data.class.color && (
            <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: data.class.color }} />
          )}
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{data.class.name}</h1>
            {data.class.periods && (
              <p className="text-sm text-text-muted">{data.class.periods}</p>
            )}
          </div>
        </div>
        <Link href={`/day/today`} className="text-sm text-accent hover:underline">
          Back to Day View
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-bg-card border border-border p-4 text-center">
          <div className="text-2xl font-bold text-accent">{data.stats.total}</div>
          <div className="text-xs text-text-muted uppercase tracking-wider mt-1">Total Activities</div>
        </div>
        <div className="rounded-xl bg-bg-card border border-border p-4 text-center">
          <div className="text-2xl font-bold text-accent-green">{data.stats.done}</div>
          <div className="text-xs text-text-muted uppercase tracking-wider mt-1">Completed</div>
        </div>
        <div className="rounded-xl bg-bg-card border border-border p-4 text-center">
          <div className="text-2xl font-bold text-text-primary">{completionRate}%</div>
          <div className="text-xs text-text-muted uppercase tracking-wider mt-1">Completion Rate</div>
          <div className="w-full bg-bg-secondary rounded-full h-1.5 mt-2">
            <div className="bg-accent-green h-1.5 rounded-full" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
      </div>

      {/* Week-by-Week History */}
      {weekKeys.length > 0 ? (
        <div className="space-y-4">
          {weekKeys.map(weekOf => {
            const weekActs = data.weeks[weekOf] || [];
            // Group by date within the week
            const byDate: Record<string, ActivityItem[]> = {};
            for (const act of weekActs) {
              if (!byDate[act.date]) byDate[act.date] = [];
              byDate[act.date].push(act);
            }
            const dates = Object.keys(byDate).sort();

            return (
              <div key={weekOf} className="rounded-xl bg-bg-card border border-border p-5">
                <h2 className="text-base font-semibold text-text-primary mb-3">
                  Week of {formatWeekLabel(weekOf)}
                </h2>

                <div className="space-y-3">
                  {dates.map(dateStr => (
                    <div key={dateStr}>
                      <div className="text-xs text-text-muted uppercase tracking-wider mb-1.5">
                        {formatDate(dateStr)}
                      </div>
                      <div className="space-y-1.5 ml-2">
                        {byDate[dateStr].map(act => (
                          <div key={act.id} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              act.is_done ? 'bg-accent-green'
                                : act.material_status === 'ready' || act.material_status === 'not_needed' ? 'bg-accent'
                                : 'bg-accent-yellow'
                            }`} />
                            <span className={`text-sm ${act.is_done ? 'text-text-muted line-through' : 'text-text-secondary'}`}>
                              {act.title}
                            </span>
                            <span className="text-[0.65rem] text-text-muted capitalize ml-auto">
                              {act.activity_type}
                            </span>
                            {act.is_graded && (
                              <span className="text-accent-yellow text-xs">&#9733;</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-bg-card border border-border p-8 text-center">
          <p className="text-text-muted">No activity history for this class yet.</p>
          <p className="text-sm text-text-muted mt-1">Activities will appear here as you add them to lesson plans.</p>
        </div>
      )}
    </div>
  );
}
