'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ConfirmProvider, useConfirm } from '@/components/ConfirmDialog';

// -- Types --

interface StandardData {
  code: string;
  description: string;
}

interface ActivityData {
  id: number;
  class_id: number;
  date: string | null;
  title: string;
  description: string | null;
  activity_type: string;
  sort_order: number;
  material_status: string;
  material_content: Record<string, unknown> | null;
  is_done: boolean;
  is_graded: boolean;
  classes: { name: string; periods: string | null; color: string | null } | null;
  standards?: StandardData[];
}

interface Comment {
  id: number;
  parent_id: number | null;
  author_role: string;
  author_name: string;
  content: string;
  created_at: string;
}

interface PlanData {
  id: number;
  week_of: string;
  class_id: number | null;
  status: string;
  announcements?: string | null;
  writers_corner?: Record<string, string> | null;
  created_at: string;
  updated_at: string | null;
}

interface PlanResponse {
  plan: PlanData;
  activities: ActivityData[];
  comments: Comment[];
  school_name: string;
  teacher_name: string;
}

// -- Helpers --

function formatWeekOf(weekOf: string): string {
  try {
    const d = new Date(weekOf + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return weekOf;
  }
}

function formatDayLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatCommentDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function groupByDate(activities: ActivityData[]): Record<string, ActivityData[]> {
  const groups: Record<string, ActivityData[]> = {};
  for (const act of activities) {
    const key = act.date || 'unscheduled';
    if (!groups[key]) groups[key] = [];
    groups[key].push(act);
  }
  return groups;
}

function groupByClass(activities: ActivityData[]): Record<string, ActivityData[]> {
  const groups: Record<string, ActivityData[]> = {};
  for (const act of activities) {
    const name = act.classes?.name || `Class ${act.class_id}`;
    if (!groups[name]) groups[name] = [];
    groups[name].push(act);
  }
  return groups;
}

function getAdjacentWeek(weekOf: string, offset: number): string {
  const d = new Date(weekOf + 'T12:00:00');
  d.setDate(d.getDate() + offset * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// -- Component --

export default function PublishedPlanPageWrapper() {
  return (
    <ConfirmProvider>
      <PublishedPlanPage />
    </ConfirmProvider>
  );
}

function PublishedPlanPage() {
  const { confirm } = useConfirm();
  const params = useParams();
  const router = useRouter();
  const token = String(params.token);

  const [data, setData] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Comment form state
  const [comments, setComments] = useState<Comment[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Threaded comment state
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  // Tooltip state for standards
  const [tooltipStandard, setTooltipStandard] = useState<string | null>(null);

  // Expanded activity ids (click to show details)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  function toggleActivity(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Adjacent plan tokens for navigation
  const [prevToken, setPrevToken] = useState<string | null>(null);
  const [nextToken, setNextToken] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/plans/${token}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Not found' }));
        setError(err.error || 'Lesson plan not found');
        setLoading(false);
        return;
      }
      const json: PlanResponse = await res.json();
      setData(json);
      setComments(json.comments);

      // Fetch all published plans to determine prev/next
      try {
        const allRes = await fetch('/api/lesson-plans?status=published');
        if (allRes.ok) {
          const allPlans = await allRes.json();
          // Sort by week_of ascending
          allPlans.sort((a: { week_of: string }, b: { week_of: string }) =>
            a.week_of.localeCompare(b.week_of)
          );
          const currentIdx = allPlans.findIndex(
            (p: { id: number }) => p.id === json.plan.id
          );
          setPrevToken(currentIdx > 0 ? allPlans[currentIdx - 1].publish_token : null);
          setNextToken(
            currentIdx >= 0 && currentIdx < allPlans.length - 1
              ? allPlans[currentIdx + 1].publish_token
              : null
          );
        }
      } catch { /* ignore */ }
    } catch {
      setError('Failed to load lesson plan');
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/plans/${token}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: authorName.trim(),
          author_role: 'reviewer',
          content: commentText.trim(),
        }),
      });
      if (res.ok) {
        const newComment: Comment = await res.json();
        setComments(prev => [...prev, newComment]);
        setCommentText('');
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  }

  async function submitReply(parentId: number) {
    if (!authorName.trim() || !replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/plans/${token}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: authorName.trim(),
          author_role: 'reviewer',
          content: replyText.trim(),
          parent_id: parentId,
        }),
      });
      if (res.ok) {
        const newComment: Comment = await res.json();
        setComments(prev => [...prev, newComment]);
        setReplyText('');
        setReplyingTo(null);
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  }

  async function updateComment(commentId: number) {
    if (!editCommentText.trim()) return;
    try {
      const res = await fetch(`/api/plans/${token}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId, content: editCommentText.trim() }),
      });
      if (res.ok) {
        const updated: Comment = await res.json();
        setComments(prev => prev.map(c => c.id === commentId ? updated : c));
        setEditingCommentId(null);
        setEditCommentText('');
      }
    } catch { /* ignore */ }
  }

  async function deleteComment(commentId: number) {
    const ok = await confirm({
      title: 'Delete Comment',
      message: 'Delete this comment? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/plans/${token}/comments?comment_id=${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId));
      }
    } catch { /* ignore */ }
  }

  // -- Render helpers --

  function renderComment(comment: Comment, isReply = false) {
    const isEditing = editingCommentId === comment.id;
    const replies = comments.filter(c => c.parent_id === comment.id);

    return (
      <div key={comment.id} className={isReply ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}>
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-800">
              {comment.author_name}
            </span>
            <span className="text-xs text-gray-400 ml-auto">
              {formatCommentDate(comment.created_at)}
            </span>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editCommentText}
                onChange={e => setEditCommentText(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-teal-500 focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => updateComment(comment.id)}
                  className="px-3 py-1 bg-teal-500 text-white rounded text-xs font-medium hover:bg-teal-600">
                  Save
                </button>
                <button onClick={() => { setEditingCommentId(null); setEditCommentText(''); }}
                  className="px-3 py-1 bg-gray-200 text-gray-600 rounded text-xs font-medium hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {comment.content}
            </p>
          )}

          {!isEditing && (
            <div className="flex gap-3 mt-2">
              {!isReply && (
                <button
                  onClick={() => { setReplyingTo(replyingTo === comment.id ? null : comment.id); setReplyText(''); }}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                  Reply
                </button>
              )}
              <button
                onClick={() => { setEditingCommentId(comment.id); setEditCommentText(comment.content); }}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium">
                Edit
              </button>
              <button
                onClick={() => deleteComment(comment.id)}
                className="text-xs text-red-400 hover:text-red-600 font-medium">
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Reply form */}
        {replyingTo === comment.id && (
          <div className="ml-8 mt-2 border-l-2 border-teal-200 pl-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitReply(comment.id); }}
                placeholder={authorName ? `Reply as ${authorName}...` : 'Enter your name above first...'}
                disabled={!authorName.trim()}
                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={() => submitReply(comment.id)}
                disabled={submitting || !replyText.trim() || !authorName.trim()}
                className="px-3 py-2 bg-teal-500 text-white rounded-lg text-xs font-semibold hover:bg-teal-600 disabled:opacity-50">
                Reply
              </button>
            </div>
          </div>
        )}

        {/* Nested replies */}
        {replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  }

  // -- Render --

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Error / not found
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Lesson Plan Not Found</h1>
          <p className="text-gray-500">{error || 'This link may have expired or is invalid.'}</p>
          <Link href="/plans" className="mt-4 inline-block text-teal-600 hover:text-teal-700 text-sm font-medium">
            &larr; Back to all plans
          </Link>
        </div>
      </div>
    );
  }

  const { plan, activities, school_name, teacher_name } = data;
  const byDate = groupByDate(activities);
  const dates = Object.keys(byDate).sort((a, b) => {
    if (a === 'unscheduled') return 1;
    if (b === 'unscheduled') return -1;
    return a.localeCompare(b);
  });

  // Top-level comments (no parent)
  const topLevelComments = comments.filter(c => !c.parent_id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 0.35in 0.4in; size: letter; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          [data-no-print] { display: none !important; }
          [data-print-header] { display: flex !important; }
          [data-print-comments] { display: block !important; }
          .min-h-screen { min-height: auto !important; background: white !important; }
          main { padding: 0 !important; max-width: none !important; }
          main > * + * { margin-top: 6px !important; }
          /* 2-column grid for day cards + comments */
          [data-day-grid] { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 6px !important; }
          [data-day-grid] > * { margin: 0 !important; }
          /* Day cards */
          main .rounded-xl { border-radius: 3px !important; box-shadow: none !important; border: 1px solid #ccc !important; break-inside: avoid; }
          /* Day header */
          main [data-day-grid] .bg-gray-50.border-b { padding: 4px 10px !important; }
          main [data-day-grid] h2 { font-size: 14px !important; }
          /* Class sections */
          main [data-day-grid] .px-5 { padding: 4px 10px !important; }
          main [data-day-grid] h3 { font-size: 12px !important; margin-bottom: 1px !important; }
          main [data-day-grid] .border-t { margin-bottom: 3px !important; }
          /* Activity rows */
          main [data-day-grid] .rounded-md { padding: 1px 5px !important; }
          main [data-day-grid] .text-sm { font-size: 12px !important; line-height: 1.35 !important; }
          main [data-day-grid] .text-xs { font-size: 10px !important; }
          /* Bullets */
          main [data-day-grid] .w-1 { width: 4px !important; height: 4px !important; }
          /* Banners compact */
          main .bg-amber-50, main .bg-purple-50 { padding: 6px 12px !important; border-radius: 3px !important; }
          main .bg-amber-50 .text-sm, main .bg-purple-50 .text-sm { font-size: 10px !important; }
          main .bg-amber-50 h3, main .bg-purple-50 h3 { font-size: 10px !important; }
          main .bg-amber-50 .text-lg, main .bg-purple-50 .text-lg { font-size: 12px !important; }
          /* Expanded details hidden in print */
          main .border-l-2.border-teal-200 { display: none !important; }
          /* Chevron hidden */
          main svg.transition-transform { display: none !important; }
          /* Graded star */
          main [data-day-grid] .text-amber-500 { font-size: 10px !important; }
          /* Print header */
          [data-print-header] { margin-bottom: 6px !important; padding-bottom: 4px !important; }
          [data-print-header] h1 { font-size: 14px !important; }
          [data-print-header] .text-xs { font-size: 12px !important; }
          [data-print-header] .text-\\[10px\\] { font-size: 10px !important; }
        }
      `}</style>

      {/* Print-only header (hidden on screen) */}
      <div data-print-header className="hidden items-center justify-between border-b border-gray-300 pb-2 mb-2" style={{ display: 'none' }}>
        <div>
          {school_name && <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{school_name}</p>}
          <h1 className="text-sm font-bold text-gray-900">Lesson Plan</h1>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-gray-700">Week of {formatWeekOf(plan.week_of)}</p>
          {teacher_name && <p className="text-[10px] text-gray-500">{teacher_name}</p>}
        </div>
      </div>

      {/* Header */}
      <header data-no-print className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-0.5">
                <Link href="/plans" className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                  &larr; All Plans
                </Link>
              </div>
              {school_name && (
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                  {school_name}
                </p>
              )}
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                Lesson Plan
              </h1>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-teal-600">
                Week of {formatWeekOf(plan.week_of)}
              </p>
              {teacher_name && (
                <p className="text-xs text-gray-500">{teacher_name}</p>
              )}
              {/* Week navigation + Print */}
              <div className="flex items-center justify-end gap-2 mt-1">
                <button
                  onClick={() => window.print()}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m0 0a48.062 48.062 0 0110.5 0m-10.5 0V5.625c0-.621.504-1.125 1.125-1.125h8.25c.621 0 1.125.504 1.125 1.125v3.026" />
                  </svg>
                  Print
                </button>
                <span className="text-xs text-gray-300">|</span>
                {prevToken ? (
                  <button
                    onClick={() => router.push(`/plans/${prevToken}`)}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                    &larr; Prev
                  </button>
                ) : (
                  <span className="text-xs text-gray-300 cursor-default">
                    &larr; Prev
                  </span>
                )}
                <span className="text-xs text-gray-300">|</span>
                {nextToken ? (
                  <button
                    onClick={() => router.push(`/plans/${nextToken}`)}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                    Next &rarr;
                  </button>
                ) : (
                  <span className="text-xs text-gray-300 cursor-default">
                    Next &rarr;
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-6">

        {/* Announcements banner */}
        {plan.announcements && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-amber-500 text-lg shrink-0">&#128226;</span>
              <div>
                <h3 className="text-sm font-semibold text-amber-800 mb-0.5">Announcements</h3>
                <p className="text-sm text-amber-700">{plan.announcements}</p>
              </div>
            </div>
          </div>
        )}

        {/* Writers Corner banner */}
        {plan.writers_corner && Object.values(plan.writers_corner).some(v => v?.trim()) && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-purple-500 text-lg shrink-0">&#9997;</span>
              <div>
                <h3 className="text-sm font-semibold text-purple-800 mb-1">Writers Corner</h3>
                <div className="space-y-0.5">
                  {Object.entries(plan.writers_corner).map(([classId, names]) => {
                    if (!names?.trim()) return null;
                    const act = activities.find(a => String(a.class_id) === classId);
                    const className = act?.classes?.name || `Class ${classId}`;
                    return (
                      <p key={classId} className="text-sm text-purple-700">
                        <span className="font-medium">{className}:</span> {names}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Day Cards */}
        {dates.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 flex flex-col items-center">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600">No Activities Yet</p>
            <p className="text-xs text-gray-400 mt-1">Activities will appear here once added to this plan.</p>
          </div>
        ) : (
          <div data-day-grid className="space-y-6">
          {dates.map(date => {
            const dayActivities = byDate[date];
            const dayLabel = date === 'unscheduled' ? 'Unscheduled' : formatDayLabel(date);
            const byClass = groupByClass(dayActivities);

            return (
              <div key={date} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Day header */}
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-sm font-bold text-gray-800">{dayLabel}</h2>
                </div>

                <div>
                  {Object.entries(byClass).map(([className, classActs], classIdx) => {
                    return (
                      <div key={className} className="px-5 py-2.5">
                        {/* Divider between classes (skip first) */}
                        {classIdx > 0 && <div className="border-t border-gray-200 -mx-5 mb-2.5" />}
                        {/* Class header */}
                        <div className="flex items-baseline gap-2 mb-1">
                          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">{className}</h3>
                          {classActs[0]?.classes?.periods && (
                            <span className="text-xs text-gray-400">
                              {classActs[0].classes.periods}
                            </span>
                          )}
                        </div>

                        {/* Activity list */}
                        <div className="space-y-0.5">
                          {classActs.map(act => {
                            const isExpanded = expandedIds.has(act.id);
                            const hasDetails = act.description || (act.standards && act.standards.length > 0);

                            return (
                              <div key={act.id}>
                                {/* Title row — always visible */}
                                <div
                                  className={`flex items-center gap-2 rounded-md px-2 py-1 cursor-pointer transition-colors ${
                                    isExpanded ? 'bg-teal-50' : 'hover:bg-gray-50'
                                  }`}
                                  onClick={() => toggleActivity(act.id)}>
                                  <span className="w-1 h-1 rounded-full shrink-0 bg-gray-400" />
                                  <span className="text-sm text-gray-900 flex-1 min-w-0">
                                    {act.title}
                                  </span>
                                  {act.is_graded && (
                                    <span className="text-amber-500 text-xs shrink-0" title="Graded">&#9733;</span>
                                  )}
                                  {hasDetails && (
                                    <svg
                                      className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                  )}
                                </div>

                                {/* Expanded details */}
                                {isExpanded && (
                                  <div className="ml-5 pl-2 border-l-2 border-teal-200 py-1 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                                        {act.activity_type.charAt(0).toUpperCase() + act.activity_type.slice(1)}
                                      </span>
                                      {act.standards && act.standards.length > 0 && act.standards.map(std => (
                                        <span
                                          key={std.code}
                                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 cursor-help relative"
                                          onMouseEnter={() => setTooltipStandard(std.code)}
                                          onMouseLeave={() => setTooltipStandard(null)}
                                          title={std.description}
                                        >
                                          {std.code}
                                          {tooltipStandard === std.code && (
                                            <span className="absolute left-0 top-full mt-1 z-20 w-64 p-2 bg-gray-800 text-white text-[10px] rounded-lg shadow-lg leading-relaxed">
                                              {std.description}
                                            </span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                    {act.description && (
                                      <p className="text-xs text-gray-500 leading-relaxed">
                                        {act.description}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {/* Print-only comments cell — sits next to Friday in the grid */}
          <div data-print-comments className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hidden">
            <div className="px-5 py-2 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-bold text-gray-800">Comments</h2>
            </div>
            <div className="px-5 py-2.5">
              {topLevelComments.length > 0 ? (
                <div className="space-y-1.5">
                  {topLevelComments.map(c => (
                    <div key={c.id}>
                      <p className="text-xs text-gray-700">
                        <span className="font-semibold">{c.author_name}:</span> {c.content}
                      </p>
                      {comments.filter(r => r.parent_id === c.id).map(r => (
                        <p key={r.id} className="text-xs text-gray-500 ml-3 mt-0.5">
                          <span className="font-semibold">{r.author_name}:</span> {r.content}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No comments.</p>
              )}
            </div>
          </div>
          </div>
        )}

        {/* Comments Section (screen only) */}
        <div data-no-print className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-800">
              Comments
              {comments.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-400">
                  ({comments.length})
                </span>
              )}
            </h2>
          </div>

          <div className="p-5 space-y-4">
            {/* Existing comments (threaded) */}
            {topLevelComments.length > 0 ? (
              <div className="space-y-3">
                {topLevelComments.map(comment => renderComment(comment))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No comments yet.</p>
            )}

            {/* Add comment form */}
            <form onSubmit={submitComment} className="border-t border-gray-200 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Add a Comment</h3>

              <div>
                <label htmlFor="author_name" className="block text-xs font-medium text-gray-500 mb-1">
                  Your Name
                </label>
                <input
                  id="author_name"
                  type="text"
                  value={authorName}
                  onChange={e => setAuthorName(e.target.value)}
                  placeholder="Name"
                  required
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="comment_text" className="block text-xs font-medium text-gray-500 mb-1">
                  Comment
                </label>
                <textarea
                  id="comment_text"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Write your feedback..."
                  required
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !authorName.trim() || !commentText.trim()}
                  className="px-5 py-2 bg-teal-500 text-white rounded-lg font-semibold text-sm hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <footer data-no-print className="text-center py-6">
          <p className="text-xs text-gray-400">
            Published lesson plan &middot; {teacher_name || 'Teacher Dashboard'}
          </p>
        </footer>
      </main>
    </div>
  );
}
