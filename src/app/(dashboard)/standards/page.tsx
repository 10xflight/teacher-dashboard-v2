'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ChevronUp, ChevronDown, Upload, RefreshCw, X, Trash2 } from 'lucide-react';

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

interface ParsedStandard {
  code: string;
  description: string;
  strand?: string;
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

  // Auto-seed state
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');
  const autoSeededRef = useRef(false);

  // Clear standards state
  const [clearConfirmStep, setClearConfirmStep] = useState<0 | 1 | 2>(0); // 0=idle, 1=first confirm, 2=clearing
  const [clearMessage, setClearMessage] = useState('');

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploadGradeBand, setUploadGradeBand] = useState('');
  const [uploadParsing, setUploadParsing] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<ParsedStandard[] | null>(null);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; updated: number } | null>(null);

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

      return result;
    } catch {
      setError('Network error loading coverage data');
    }
    setLoading(false);
    return null;
  }, [selectedClassId]);

  // Auto-seed if all classes have 0 standards
  useEffect(() => {
    async function init() {
      const result = await loadCoverage();
      if (
        result &&
        result.classes.length > 0 &&
        result.classes.every(c => c.total_standards === 0) &&
        !autoSeededRef.current
      ) {
        autoSeededRef.current = true;
        await seedStandards();
        await loadCoverage();
      }
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ──────────────── Seed Standards ────────────────

  async function seedStandards() {
    setSeeding(true);
    setSeedMessage('');
    try {
      const res = await fetch('/api/standards/seed', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSeedMessage(`Seeded ${data.count} standards (${data.inserted} new, ${data.updated} updated)`);
        await loadCoverage();
      } else {
        const err = await res.json();
        setSeedMessage(`Error: ${err.error}`);
      }
    } catch {
      setSeedMessage('Network error while seeding.');
    }
    setSeeding(false);
    setTimeout(() => setSeedMessage(''), 5000);
  }

  // ──────────────── Clear Standards ────────────────

  async function clearStandards() {
    setClearConfirmStep(2);
    setClearMessage('');
    try {
      // Delete all activity_standards joins first, then all standards
      const res = await fetch('/api/standards', { method: 'DELETE' });
      if (res.ok) {
        setClearMessage('All standards and tags cleared');
        await loadCoverage();
      } else {
        const err = await res.json();
        setClearMessage(`Error: ${err.error}`);
      }
    } catch {
      setClearMessage('Network error while clearing.');
    }
    setClearConfirmStep(0);
    setTimeout(() => setClearMessage(''), 5000);
  }

  // ──────────────── Upload Standards ────────────────

  async function parseUploadText() {
    if (!uploadText.trim() || !uploadSubject.trim() || !uploadGradeBand.trim()) return;
    setUploadParsing(true);
    setUploadPreview(null);
    setUploadResult(null);

    try {
      const res = await fetch('/api/standards/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: uploadText.trim(),
          subject: uploadSubject.trim(),
          grade_band: uploadGradeBand.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setUploadPreview(data.standards || []);
        setUploadResult({ inserted: data.inserted, updated: data.updated });
        // Reload coverage data
        await loadCoverage();
      } else {
        const err = await res.json();
        alert(`Upload failed: ${err.error}`);
      }
    } catch {
      alert('Network error while uploading.');
    }

    setUploadParsing(false);
  }

  function closeUploadModal() {
    setUploadOpen(false);
    setUploadText('');
    setUploadSubject('');
    setUploadGradeBand('');
    setUploadPreview(null);
    setUploadResult(null);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadText(reader.result as string);
    };
    reader.readAsText(file);
  }

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
    return sortDir === 'asc' ? <ChevronUp size={12} className="inline ml-0.5" /> : <ChevronDown size={12} className="inline ml-0.5" />;
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
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Standards Coverage</h1>
          <p className="text-sm text-text-muted mt-1">
            Track which standards have been addressed across your classes
          </p>
        </div>

        {/* Manage Standards buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {seedMessage && (
            <span className="text-xs text-text-muted">{seedMessage}</span>
          )}
          {clearMessage && (
            <span className="text-xs text-text-muted">{clearMessage}</span>
          )}
          <button
            onClick={seedStandards}
            disabled={seeding}
            className="px-3 py-1.5 bg-bg-input border border-border text-text-secondary rounded-lg text-xs font-medium hover:border-accent hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={seeding ? 'animate-spin' : ''} />
            {seeding ? 'Seeding...' : 'Re-seed OK Standards'}
          </button>
          <button
            onClick={() => setUploadOpen(true)}
            className="px-3 py-1.5 bg-accent/10 border border-accent/30 text-accent rounded-lg text-xs font-medium hover:bg-accent/20 transition-colors flex items-center gap-1.5"
          >
            <Upload size={12} />
            Upload Standards
          </button>
          <button
            onClick={() => setClearConfirmStep(1)}
            className="px-3 py-1.5 bg-accent-red/10 border border-accent-red/30 text-accent-red rounded-lg text-xs font-medium hover:bg-accent-red/20 transition-colors flex items-center gap-1.5"
          >
            <Trash2 size={12} />
            Clear Standards
          </button>
        </div>
      </div>

      {/* Sticky class selector + summary */}
      <div className="sticky -top-4 md:-top-6 lg:-top-8 z-20 bg-bg-card border-b border-border -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8 pb-3 space-y-3">
        {/* Per-Class Tiles */}
        <div className="flex items-center gap-2 flex-wrap">
          {data.classes.map((cls) => {
            const isSelected = cls.id === selectedClassId;
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-bg-secondary hover:border-accent/50'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: cls.color || '#4ECDC4' }}
                />
                <span className={`text-xs font-semibold truncate ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
                  {cls.name}
                </span>
                <span className="text-xs text-text-muted">
                  {cls.covered_standards}/{cls.total_standards}
                </span>
                <div className="w-12 h-1.5 bg-bg-input rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${cls.coverage_pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Compact coverage summary */}
        {selectedClass && (
          <div className="flex items-center gap-4 text-xs text-text-secondary">
            <span className="text-text-muted">{selectedClass.total_standards} total</span>
            <span>{selectedClass.covered_standards} addressed</span>
            {totalStale > 0 && (
              <span className="text-accent-yellow">{totalStale} stale (4+ wks)</span>
            )}
            <span>{totalNeverHit} remaining</span>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-bg-input rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${selectedClass.coverage_pct}%` }}
                />
              </div>
              <span className="font-bold text-text-primary">
                {selectedClass.coverage_pct}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Coverage Table */}
      {selectedClass && (
        <div className="rounded-xl bg-bg-card border border-border overflow-hidden mt-6">
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

      {/* Clear Standards Confirmation Modal */}
      {clearConfirmStep === 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-card border border-border rounded-xl w-full max-w-md mx-4 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-text-primary">Clear All Standards?</h3>
            <p className="text-sm text-text-secondary">
              This will delete <strong>all standards</strong> from the database and remove all activity-to-standard tags. Every activity will lose its standard associations and coverage will reset to 0%.
            </p>
            <p className="text-sm text-accent-red font-medium">
              This cannot be undone. You will need to re-seed or re-upload standards and re-tag all activities.
            </p>
            <div className="flex items-center gap-3 justify-end pt-2">
              <button
                onClick={() => setClearConfirmStep(0)}
                className="px-4 py-2 bg-bg-input border border-border text-text-secondary rounded-lg text-sm font-medium hover:border-accent hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={clearStandards}
                className="px-4 py-2 bg-accent-red text-white rounded-lg text-sm font-semibold hover:brightness-110"
              >
                Yes, Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Standards Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-card border border-border rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto mx-4 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">Upload Standards</h3>
              <button
                onClick={closeUploadModal}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-4">
              {/* Subject & Grade Band */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Subject</label>
                  <input
                    type="text"
                    value={uploadSubject}
                    onChange={e => setUploadSubject(e.target.value)}
                    placeholder="e.g., English, French, Math"
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Grade Band</label>
                  <input
                    type="text"
                    value={uploadGradeBand}
                    onChange={e => setUploadGradeBand(e.target.value)}
                    placeholder="e.g., 9, 10, 1"
                    className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Text input or file */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Paste standards text or upload a file
                </label>
                <textarea
                  value={uploadText}
                  onChange={e => setUploadText(e.target.value)}
                  rows={8}
                  placeholder="Paste standards from a document, PDF, or spreadsheet here..."
                  className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none resize-y font-mono"
                />
                <div className="mt-2">
                  <label className="px-3 py-1.5 bg-bg-input border border-border text-text-secondary rounded-lg text-xs font-medium hover:border-accent hover:text-text-primary transition-colors cursor-pointer inline-flex items-center gap-1.5">
                    <Upload size={12} />
                    Choose File
                    <input
                      type="file"
                      accept=".txt,.csv,.json,.tsv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Parse button */}
              <button
                onClick={parseUploadText}
                disabled={uploadParsing || !uploadText.trim() || !uploadSubject.trim() || !uploadGradeBand.trim()}
                className="w-full py-2.5 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploadParsing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-bg-primary border-t-transparent rounded-full animate-spin" />
                    Parsing with AI...
                  </>
                ) : (
                  'Parse & Upload Standards'
                )}
              </button>

              {/* Result message */}
              {uploadResult && (
                <div className="rounded-lg bg-accent-green/10 border border-accent-green/30 px-4 py-3">
                  <p className="text-sm font-medium text-accent-green">
                    Successfully processed {(uploadResult.inserted + uploadResult.updated)} standards
                  </p>
                  <p className="text-xs text-accent-green/80 mt-0.5">
                    {uploadResult.inserted} new, {uploadResult.updated} updated
                  </p>
                </div>
              )}

              {/* Preview table */}
              {uploadPreview && uploadPreview.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    Parsed Standards ({uploadPreview.length})
                  </h4>
                  <div className="max-h-[200px] overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-bg-secondary/50">
                          <th className="px-3 py-2 text-left font-semibold text-text-muted">Code</th>
                          <th className="px-3 py-2 text-left font-semibold text-text-muted">Description</th>
                          <th className="px-3 py-2 text-left font-semibold text-text-muted">Strand</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {uploadPreview.map((std, i) => (
                          <tr key={i} className="hover:bg-bg-secondary/30">
                            <td className="px-3 py-2 font-mono font-semibold text-text-primary whitespace-nowrap">
                              {std.code}
                            </td>
                            <td className="px-3 py-2 text-text-secondary line-clamp-2">
                              {std.description}
                            </td>
                            <td className="px-3 py-2 text-text-muted whitespace-nowrap">
                              {std.strand || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
