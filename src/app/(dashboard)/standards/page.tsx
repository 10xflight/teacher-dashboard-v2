'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

// ──────────────── Types ────────────────

interface StandardData {
  id: number;
  code: string;
  description: string;
  strand: string | null;
  subject: string;
  grade_band: string;
  hit_count: number;
  last_hit_date: string | null;
  is_gap: boolean;
}

interface ClassCoverage {
  id: number;
  name: string;
  color: string | null;
  total_standards: number;
  covered_standards: number;
  coverage_pct: number;
  standards: StandardData[];
}

interface CoverageResponse {
  classes: ClassCoverage[];
}

type SortField = 'code' | 'last_hit' | 'count';
type SortDir = 'asc' | 'desc';

// ──────────────── Helpers ────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ──────────────── Component ────────────────

export default function StandardsCoveragePage() {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter / sort state
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'covered' | 'gap' | 'never'>('all');

  // ──────────────── Data Loading ────────────────

  const loadCoverage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/standards/coverage');
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Failed to load coverage data');
        setLoading(false);
        return;
      }
      const result: CoverageResponse = await res.json();
      setData(result);

      // Auto-select first class if none selected
      if (result.classes.length > 0 && selectedClassId === null) {
        setSelectedClassId(result.classes[0].id);
      }
    } catch {
      setError('Network error loading coverage data');
    }
    setLoading(false);
  }, [selectedClassId]);

  useEffect(() => {
    loadCoverage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ──────────────── Derived Data ────────────────

  const selectedClass = useMemo(() => {
    if (!data || selectedClassId === null) return null;
    return data.classes.find((c) => c.id === selectedClassId) ?? null;
  }, [data, selectedClassId]);

  const totalNeverHit = useMemo(() => {
    if (!selectedClass) return 0;
    return selectedClass.standards.filter((s) => s.hit_count === 0).length;
  }, [selectedClass]);

  const totalStale = useMemo(() => {
    if (!selectedClass) return 0;
    return selectedClass.standards.filter(
      (s) => s.hit_count > 0 && s.is_gap
    ).length;
  }, [selectedClass]);

  const filteredAndSorted = useMemo(() => {
    if (!selectedClass) return [];

    let list = [...selectedClass.standards];

    // Filter by status
    if (filterStatus === 'covered') {
      list = list.filter((s) => s.hit_count > 0 && !s.is_gap);
    } else if (filterStatus === 'gap') {
      list = list.filter((s) => s.is_gap);
    } else if (filterStatus === 'never') {
      list = list.filter((s) => s.hit_count === 0);
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'code':
          cmp = a.code.localeCompare(b.code);
          break;
        case 'last_hit': {
          const aDate = a.last_hit_date || '0000-00-00';
          const bDate = b.last_hit_date || '0000-00-00';
          cmp = aDate.localeCompare(bDate);
          break;
        }
        case 'count':
          cmp = a.hit_count - b.hit_count;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [selectedClass, filterStatus, sortField, sortDir]);

  // ──────────────── Sort Toggle ────────────────

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function sortIcon(field: SortField) {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  }

  // ──────────────── Status Rendering ────────────────

  function renderStatus(std: StandardData) {
    if (std.hit_count === 0) {
      // Never hit - red X
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-red/15 text-accent-red text-xs font-medium">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Never Hit
        </span>
      );
    }

    if (std.is_gap) {
      // Hit but stale (4+ weeks)
      const days = daysSince(std.last_hit_date);
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-yellow/15 text-accent-yellow text-xs font-medium">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          {days}d ago
        </span>
      );
    }

    // Covered and recent - green check
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-green/15 text-accent-green text-xs font-medium">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Covered
      </span>
    );
  }

  // ──────────────── Render ────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-accent-red/10 border border-accent-red/30 p-6 text-center">
        <p className="text-accent-red font-medium">{error}</p>
        <button
          onClick={loadCoverage}
          className="mt-3 px-4 py-2 bg-accent text-bg-primary rounded-lg text-sm font-semibold hover:brightness-110"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.classes.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Standards Coverage</h1>
          <p className="text-sm text-text-muted mt-1">
            Track which standards have been addressed across your classes
          </p>
        </div>
        <div className="rounded-xl bg-bg-card border border-border p-12 text-center">
          <p className="text-text-muted">No classes or standards found. Add classes and seed standards first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Standards Coverage</h1>
        <p className="text-sm text-text-muted mt-1">
          Track which standards have been addressed across your classes
        </p>
      </div>

      {/* Warning Banner */}
      {selectedClass && totalNeverHit > 0 && (
        <div className="rounded-xl bg-accent-red/10 border border-accent-red/30 px-5 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-accent-red shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-accent-red">
              {totalNeverHit} standard{totalNeverHit !== 1 ? 's' : ''} never addressed
            </p>
            <p className="text-xs text-accent-red/80 mt-0.5">
              {selectedClass.name} has {totalNeverHit} standard{totalNeverHit !== 1 ? 's' : ''} that {totalNeverHit !== 1 ? 'have' : 'has'} never been tagged to any activity.
              {totalStale > 0 && ` Additionally, ${totalStale} standard${totalStale !== 1 ? 's' : ''} ${totalStale !== 1 ? 'have' : 'has'} not been hit in 4+ weeks.`}
            </p>
          </div>
        </div>
      )}

      {/* Per-Class Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.classes.map((cls) => {
          const isSelected = cls.id === selectedClassId;
          return (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={`rounded-xl p-4 border text-left transition-all ${
                isSelected
                  ? 'border-accent bg-bg-card ring-1 ring-accent/30'
                  : 'border-border bg-bg-secondary hover:border-accent/50'
              }`}
            >
              {/* Class name with color dot */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: cls.color || '#4ECDC4' }}
                />
                <span className="text-sm font-semibold text-text-primary truncate">
                  {cls.name}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-bg-input rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${cls.coverage_pct}%`,
                    backgroundColor:
                      cls.coverage_pct >= 75
                        ? '#22c55e'
                        : cls.coverage_pct >= 40
                        ? '#eab308'
                        : '#ef4444',
                  }}
                />
              </div>

              {/* Coverage text */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {cls.covered_standards} of {cls.total_standards} standards covered
                </span>
                <span
                  className={`text-sm font-bold ${
                    cls.coverage_pct >= 75
                      ? 'text-accent-green'
                      : cls.coverage_pct >= 40
                      ? 'text-accent-yellow'
                      : 'text-accent-red'
                  }`}
                >
                  {cls.coverage_pct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Coverage Table */}
      {selectedClass && (
        <div className="rounded-xl bg-bg-card border border-border overflow-hidden">
          {/* Table Header / Controls */}
          <div className="px-5 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedClass.color || '#4ECDC4' }}
              />
              <h2 className="text-sm font-semibold text-text-primary">
                {selectedClass.name}
              </h2>
              <span className="text-xs text-text-muted">
                {filteredAndSorted.length} standard{filteredAndSorted.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1.5">
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'covered', label: 'Covered' },
                  { key: 'gap', label: 'Gaps' },
                  { key: 'never', label: 'Never Hit' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterStatus(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterStatus === tab.key
                      ? 'bg-accent text-bg-primary'
                      : 'bg-bg-input text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary/50">
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider cursor-pointer hover:text-accent transition-colors select-none"
                    onClick={() => toggleSort('code')}
                  >
                    Standard Code{sortIcon('code')}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Description
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider cursor-pointer hover:text-accent transition-colors select-none whitespace-nowrap"
                    onClick={() => toggleSort('last_hit')}
                  >
                    Last Hit{sortIcon('last_hit')}
                  </th>
                  <th
                    className="px-5 py-3 text-center text-xs font-semibold text-text-muted uppercase tracking-wider cursor-pointer hover:text-accent transition-colors select-none"
                    onClick={() => toggleSort('count')}
                  >
                    Count{sortIcon('count')}
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredAndSorted.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-text-muted text-sm"
                    >
                      No standards match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredAndSorted.map((std) => (
                    <tr
                      key={std.id}
                      className={`transition-colors hover:bg-bg-secondary/30 ${
                        std.hit_count === 0
                          ? 'bg-accent-red/[0.03]'
                          : std.is_gap
                          ? 'bg-accent-yellow/[0.03]'
                          : ''
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-semibold text-text-primary">
                            {std.code}
                          </span>
                          {std.strand && (
                            <span className="text-[0.65rem] text-text-muted mt-0.5">
                              {std.strand}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                          {std.description}
                        </span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span
                          className={`text-xs ${
                            std.last_hit_date
                              ? 'text-text-secondary'
                              : 'text-text-muted italic'
                          }`}
                        >
                          {formatDate(std.last_hit_date)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                            std.hit_count === 0
                              ? 'bg-bg-input text-text-muted'
                              : 'bg-accent/15 text-accent'
                          }`}
                        >
                          {std.hit_count}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {renderStatus(std)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer - Summary */}
          {selectedClass && (
            <div className="px-5 py-3 border-t border-border bg-bg-secondary/30 flex items-center justify-between text-xs text-text-muted">
              <span>
                {selectedClass.covered_standards} covered &middot;{' '}
                {totalStale} stale &middot;{' '}
                {totalNeverHit} never hit
              </span>
              <span>
                {selectedClass.total_standards} total standards
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
