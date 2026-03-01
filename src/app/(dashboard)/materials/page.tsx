'use client';

import { useState, useEffect, useCallback } from 'react';
import MaterialGeneratorPanel from '@/components/MaterialGeneratorPanel';
import { exportToDocx } from '@/lib/material-exporter';
import { MaterialsSkeleton } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ClassInfo {
  id: number;
  name: string;
  color: string | null;
}

interface MaterialItem {
  id: number;
  title: string;
  date: string | null;
  class_id: number;
  activity_type: string;
  material_status: string;
  material_content: Record<string, unknown>;
  classes: { name: string; color: string | null } | null;
}

const TYPE_LABELS: Record<string, string> = {
  quiz: 'Quiz',
  vocabulary_test: 'Vocab Test',
  grammar_test: 'Grammar Test',
  sentence_dressup: 'Sentence Dressup',
  worksheet: 'Worksheet',
  discussion_questions: 'Discussion Qs',
  writing_prompt: 'Writing Prompt',
  reading_guide: 'Reading Guide',
  jeopardy: 'Jeopardy',
  dice_game: 'Dice Game',
  card_match: 'Card Match',
  relay_race: 'Relay Race',
  buzzer_quiz: 'Buzzer Quiz',
  guess_who: 'Guess Who',
  four_corners: 'Four Corners',
  vocab_bingo: 'Vocab Bingo',
  flashcard_set: 'Flashcards',
  conjugation_drill: 'Conjugation',
  dialogue_builder: 'Dialogue',
  cultural_activity: 'Cultural',
};

function getMaterialType(content: Record<string, unknown>): string {
  if (content.material_type) return content.material_type as string;
  if (content.sentences) return 'sentence_dressup';
  if (content.cards) return 'flashcard_set';
  if (content.verbs) return 'conjugation_drill';
  if (content.categories) return 'jeopardy';
  if (content.sections) return 'worksheet';
  if (content.questions) return 'quiz';
  return 'unknown';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getMaterialTitle(content: Record<string, unknown>, activityTitle: string): string {
  return (content.title as string) || activityTitle;
}

function getItemCount(content: Record<string, unknown>): string {
  if (content.questions) return `${(content.questions as any[]).length} questions`;
  if (content.sections) {
    const total = (content.sections as any[]).reduce((acc: number, s: any) => acc + (s.items?.length || 0), 0);
    return `${total} items`;
  }
  if (content.cards) return `${(content.cards as any[]).length} cards`;
  if (content.sentences) return `${(content.sentences as any[]).length} sentences`;
  if (content.categories) return `${(content.categories as any[]).length} categories`;
  if (content.verbs) return `${(content.verbs as any[]).length} verbs`;
  if (content.items) return `${(content.items as any[]).length} items`;
  return '';
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Viewer
  const [viewingActivity, setViewingActivity] = useState<MaterialItem | null>(null);

  // Export
  const [exportingId, setExportingId] = useState<number | null>(null);

  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/classes');
      if (res.ok) setClasses(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterClass) params.set('class_id', filterClass);
      if (filterSearch) params.set('search', filterSearch);

      const res = await fetch(`/api/materials?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterType, filterClass, filterSearch]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadMaterials(); }, [loadMaterials]);

  async function handleExport(item: MaterialItem, includeAnswers: boolean) {
    setExportingId(item.id);
    try {
      const matType = getMaterialType(item.material_content);
      await exportToDocx(item.material_content, matType, item.title, includeAnswers);
    } catch { /* ignore */ }
    setExportingId(null);
  }

  // Group materials by week
  function groupByWeek(items: MaterialItem[]): { label: string; weekKey: string; items: MaterialItem[] }[] {
    const groups: Map<string, { label: string; weekKey: string; items: MaterialItem[] }> = new Map();

    for (const item of items) {
      if (!item.date) {
        const key = 'no-date';
        if (!groups.has(key)) groups.set(key, { label: 'No Date', weekKey: key, items: [] });
        groups.get(key)!.items.push(item);
        continue;
      }

      // Get Monday of this item's week
      const d = new Date(item.date + 'T12:00:00');
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(d);
      monday.setDate(d.getDate() + diff);
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);

      const key = monday.toISOString().split('T')[0];
      if (!groups.has(key)) {
        const mStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const fStr = friday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        groups.set(key, { label: `${mStr} - ${fStr}`, weekKey: key, items: [] });
      }
      groups.get(key)!.items.push(item);
    }

    return Array.from(groups.values());
  }

  const grouped = groupByWeek(materials);

  // Collect unique material types from loaded data for the filter dropdown
  const usedTypes = [...new Set(materials.map(m => getMaterialType(m.material_content)))].filter(t => t !== 'unknown').sort();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Materials</h1>
          <p className="text-sm text-text-muted mt-1">
            All generated worksheets, quizzes, and activities
          </p>
        </div>
        <div className="text-sm text-text-muted">
          {materials.length} material{materials.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder="Search by title..."
            className="w-full pl-9 pr-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none placeholder:text-text-muted"
          />
        </div>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none"
        >
          <option value="">All Types</option>
          {usedTypes.map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
          ))}
        </select>

        {/* Class filter */}
        <select
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
          className="px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:border-accent focus:outline-none"
        >
          <option value="">All Classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Clear filters */}
        {(filterType || filterClass || filterSearch) && (
          <button
            onClick={() => { setFilterType(''); setFilterClass(''); setFilterSearch(''); }}
            className="px-3 py-2 text-xs font-medium text-text-muted hover:text-accent transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <MaterialsSkeleton />
      ) : materials.length === 0 ? (
        <EmptyState
          preset="materials"
          title="No Materials Yet"
          description="Generate worksheets, handouts, and other materials from the Lesson Plans page by clicking the document icon on any activity."
          action={{ label: 'Go to Lesson Plans', href: '/lesson-plans' }}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.weekKey}>
              {/* Week header */}
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Week of {group.label}
                </h3>
                <span className="text-xs text-text-muted">
                  ({group.items.length})
                </span>
              </div>

              {/* Material cards */}
              <div className="grid gap-2">
                {group.items.map(item => {
                  const matType = getMaterialType(item.material_content);
                  const matTitle = getMaterialTitle(item.material_content, item.title);
                  const count = getItemCount(item.material_content);
                  const isExporting = exportingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-card border border-border hover:border-accent/30 transition-colors group"
                    >
                      {/* Type badge */}
                      <span className="px-2 py-1 rounded-lg text-[0.6rem] font-bold uppercase tracking-wide bg-accent/10 text-accent border border-accent/20 shrink-0 w-20 text-center">
                        {TYPE_LABELS[matType] || matType}
                      </span>

                      {/* Title + meta */}
                      <button
                        onClick={() => setViewingActivity(item)}
                        className="flex-1 min-w-0 text-left hover:text-accent transition-colors"
                      >
                        <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                          {matTitle}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-text-muted">{item.classes?.name || 'Unknown'}</span>
                          {item.date && (
                            <>
                              <span className="text-text-muted">&middot;</span>
                              <span className="text-xs text-text-muted">{formatDate(item.date)}</span>
                            </>
                          )}
                          {count && (
                            <>
                              <span className="text-text-muted">&middot;</span>
                              <span className="text-xs text-text-muted">{count}</span>
                            </>
                          )}
                        </div>
                      </button>

                      {/* Quick export buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleExport(item, false)}
                          disabled={isExporting}
                          className="px-2 py-1 text-[0.6rem] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                          title="Export student version"
                        >
                          Student
                        </button>
                        <button
                          onClick={() => handleExport(item, true)}
                          disabled={isExporting}
                          className="px-2 py-1 text-[0.6rem] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                          title="Export answer key"
                        >
                          Key
                        </button>
                      </div>

                      {/* Open arrow */}
                      <button
                        onClick={() => setViewingActivity(item)}
                        className="p-1 text-text-muted hover:text-accent transition-colors shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Material viewer panel */}
      {viewingActivity && (
        <MaterialGeneratorPanel
          activity={{
            id: viewingActivity.id,
            title: viewingActivity.title,
            description: null,
            class_id: viewingActivity.class_id,
            date: viewingActivity.date ?? undefined,
            material_status: viewingActivity.material_status,
            material_content: viewingActivity.material_content,
            classes: viewingActivity.classes ? { name: viewingActivity.classes.name } : null,
          }}
          onClose={() => setViewingActivity(null)}
          onSaved={() => {
            setViewingActivity(null);
            loadMaterials();
          }}
        />
      )}
    </div>
  );
}
