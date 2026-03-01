'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { localDateStr, nextSchoolDay } from '@/lib/task-helpers';

interface BatchResult {
  date: string;
  success: boolean;
  bellringer_id?: number;
  error?: string;
  skipped?: boolean;
}

interface BatchResponse {
  week_of: string;
  results: BatchResult[];
  summary: { generated: number; skipped: number; failed: number };
}

const JOURNAL_TYPES = [
  { value: '', label: 'Random' },
  { value: 'creative', label: 'Creative' },
  { value: 'quote', label: 'Quote' },
  { value: 'emoji', label: 'Emoji' },
  { value: 'reflective', label: 'Reflective' },
  { value: 'critical_thinking', label: 'Thought-Provoking' },
  { value: 'descriptive', label: 'Descriptive' },
  { value: 'poetry', label: 'Poetry / Poem' },
  { value: 'list', label: 'Top 5 List' },
  { value: 'debate', label: 'Debate' },
  { value: 'would_you_rather', label: 'Would You Rather' },
];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Default: each day gets a different mix of 4 types
const DEFAULT_DAY_TYPES: string[][] = [
  ['creative', 'quote', 'reflective', 'emoji'],
  ['critical_thinking', 'descriptive', 'would_you_rather', 'quote'],
  ['poetry', 'creative', 'debate', 'reflective'],
  ['list', 'emoji', 'critical_thinking', 'descriptive'],
  ['would_you_rather', 'poetry', 'creative', 'quote'],
];

function getMondayOfWeek(date?: Date): string {
  const d = date || new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : day === 6 ? 2 : (day === 1 ? 0 : -(day - 1));
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return localDateStr(monday);
}

function getWeekDates(mondayStr: string): string[] {
  const d = new Date(mondayStr + 'T12:00:00');
  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    dates.push(localDateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function BatchBellringerPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>}>
      <BatchBellringerContent />
    </Suspense>
  );
}

function BatchBellringerContent() {
  const searchParams = useSearchParams();
  const urlWeekOf = searchParams.get('week_of');
  const [weekOf, setWeekOf] = useState(urlWeekOf || getMondayOfWeek());
  const [notes, setNotes] = useState('');
  const [skipExisting, setSkipExisting] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [response, setResponse] = useState<BatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  // Per-day journal type selections (4 types per day)
  const [dayTypes, setDayTypes] = useState<string[][]>(DEFAULT_DAY_TYPES);
  const [typesLoaded, setTypesLoaded] = useState(false);
  const [typesSaved, setTypesSaved] = useState(false);

  // Load saved preferences
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(settings => {
        if (settings.bellringer_batch_types) {
          try {
            const saved = JSON.parse(settings.bellringer_batch_types);
            if (Array.isArray(saved) && saved.length === 5) {
              setDayTypes(saved);
            }
          } catch { /* use defaults */ }
        }
        setTypesLoaded(true);
      })
      .catch(() => setTypesLoaded(true));
  }, []);

  // Save preferences
  async function saveTypes(updated: string[][]) {
    setDayTypes(updated);
    setTypesSaved(false);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bellringer_batch_types: JSON.stringify(updated) }),
      });
      setTypesSaved(true);
      setTimeout(() => setTypesSaved(false), 2000);
    } catch { /* silent */ }
  }

  function updateDayType(dayIndex: number, slotIndex: number, value: string) {
    const updated = dayTypes.map((day, i) =>
      i === dayIndex ? day.map((t, j) => j === slotIndex ? value : t) : [...day]
    );
    saveTypes(updated);
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    setResponse(null);
    setProgress('Generating bellringers for the week... This may take 30-60 seconds.');

    // Build per-date type map, filtering out empty (random) values
    const dates = getWeekDates(weekOf);
    const dayTypesMap: Record<string, string[]> = {};
    dates.forEach((dateStr, i) => {
      const types = dayTypes[i].filter(t => t !== '');
      if (types.length > 0) {
        dayTypesMap[dateStr] = types;
      }
    });

    try {
      const res = await fetch('/api/bellringers/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_of: weekOf,
          notes: notes.trim() || undefined,
          skip_existing: skipExisting,
          day_types: dayTypesMap,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Batch generation failed');
      } else {
        setResponse(data);
      }
    } catch {
      setError('Failed to connect to server');
    }

    setGenerating(false);
    setProgress('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/bellringer/edit/${nextSchoolDay()}`}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-hover transition-colors"
            title="Back to Bellringer Generator">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Batch Bellringer Generator</h1>
            <p className="text-sm text-text-muted mt-1">
              Generate all 5 weekday bellringers at once
            </p>
          </div>
        </div>
      </div>

      {/* Config */}
      <div className="rounded-xl bg-bg-card border border-border p-5 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Week of (Monday)</label>
          <input
            type="date"
            value={weekOf}
            onChange={e => setWeekOf(e.target.value)}
            className="px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">Theme / Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g., Romeo & Juliet theme this week..."
            className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={skipExisting}
            onChange={e => setSkipExisting(e.target.checked)}
            className="w-4 h-4 rounded border-border accent-accent"
          />
          <span className="text-sm text-text-secondary">Skip days that already have bellringers</span>
        </label>
      </div>

      {/* Per-day type config */}
      {typesLoaded && (
        <div className="rounded-xl bg-bg-card border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Journal Types per Day</h2>
              <p className="text-xs text-text-muted mt-0.5">Pick 4 prompt types for each day — saved automatically</p>
            </div>
            {typesSaved && (
              <span className="text-xs text-accent-green">Saved</span>
            )}
          </div>

          <div className="space-y-3">
            {DAY_NAMES.map((dayName, dayIdx) => (
              <div key={dayName} className="flex items-center gap-3">
                <span className="text-sm font-medium text-text-secondary w-20 shrink-0">{dayName}</span>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {[0, 1, 2, 3].map(slotIdx => (
                    <select
                      key={slotIdx}
                      value={dayTypes[dayIdx]?.[slotIdx] || ''}
                      onChange={e => updateDayType(dayIdx, slotIdx, e.target.value)}
                      className="px-2 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-xs focus:border-accent focus:outline-none min-w-0 flex-1"
                    >
                      {JOURNAL_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => saveTypes(DEFAULT_DAY_TYPES)}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Reset to defaults
          </button>
        </div>
      )}

      {/* Generate button */}
      <div className="rounded-xl bg-bg-card border border-border p-5 space-y-4">
        <button
          onClick={generate}
          disabled={generating}
          className="px-6 py-2.5 bg-accent text-bg-primary rounded-lg font-semibold hover:brightness-110 disabled:opacity-50 transition-all">
          {generating ? 'Generating...' : 'Generate All 5 Bellringers'}
        </button>

        {progress && (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-text-secondary">{progress}</p>
          </div>
        )}

        {error && <p className="text-sm text-accent-red">{error}</p>}
      </div>

      {/* Results */}
      {response && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-xl bg-bg-card border border-border p-5">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Results</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-green">{response.summary.generated}</div>
                <div className="text-xs text-text-muted uppercase">Generated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-text-muted">{response.summary.skipped}</div>
                <div className="text-xs text-text-muted uppercase">Skipped</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-red">{response.summary.failed}</div>
                <div className="text-xs text-text-muted uppercase">Failed</div>
              </div>
            </div>
          </div>

          {/* Per-day results */}
          <div className="rounded-xl bg-bg-card border border-border p-5">
            <h2 className="text-base font-semibold text-text-primary mb-3">Day-by-Day</h2>
            <div className="space-y-2">
              {response.results.map(r => (
                <div key={r.date} className="flex items-center gap-3 rounded-lg bg-bg-secondary p-3">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    r.skipped ? 'bg-text-muted' : r.success ? 'bg-accent-green' : 'bg-accent-red'
                  }`} />
                  <span className="text-sm text-text-primary font-medium flex-1">
                    {formatDate(r.date)}
                  </span>
                  {r.skipped ? (
                    <span className="text-xs text-text-muted">Already exists</span>
                  ) : r.success ? (
                    <Link href={`/bellringer/edit/${r.date}`}
                      className="text-xs text-accent hover:underline">
                      Edit
                    </Link>
                  ) : (
                    <span className="text-xs text-accent-red">{r.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
