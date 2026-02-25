'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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

export default function PublishedPlanPage() {
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
    if (!confirm('Delete this comment?')) return;
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
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
              {/* Week navigation */}
              <div className="flex items-center justify-end gap-2 mt-1">
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
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No activities found for this lesson plan.</p>
          </div>
        ) : (
          dates.map(date => {
            const dayActivities = byDate[date];
            const dayLabel = date === 'unscheduled' ? 'Unscheduled' : formatDayLabel(date);
            const byClass = groupByClass(dayActivities);

            return (
              <div key={date} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Day header */}
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-base font-bold text-gray-800">{dayLabel}</h2>
                </div>

                <div>
                  {Object.entries(byClass).map(([className, classActs], classIdx) => {
                    return (
                      <div key={className} className="px-5 py-4">
                        {/* Divider between classes (skip first) */}
                        {classIdx > 0 && <div className="border-t border-gray-200 -mx-5 mb-4" />}
                        {/* Class header */}
                        <div className="flex items-baseline gap-2 mb-3">
                          <h3 className="text-base font-bold uppercase tracking-wide text-gray-700">{className}</h3>
                          {classActs[0]?.classes?.periods && (
                            <span className="text-xs text-gray-400">
                              {classActs[0].classes.periods}
                            </span>
                          )}
                        </div>

                        {/* Activity list */}
                        <div className="space-y-2">
                          {classActs.map(act => {
                            return (
                              <div key={act.id} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                                {/* Bullet */}
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-gray-400" />

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-900">
                                      {act.title}
                                    </span>
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                                      {act.activity_type.charAt(0).toUpperCase() + act.activity_type.slice(1)}
                                    </span>
                                    {act.is_graded && (
                                      <span className="text-amber-500 text-xs" title="Graded">&#9733;</span>
                                    )}
                                    {/* Standard badges */}
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
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                      {act.description}
                                    </p>
                                  )}
                                </div>
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
          })
        )}

        {/* Comments Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
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
        <footer className="text-center py-6">
          <p className="text-xs text-gray-400">
            Published lesson plan &middot; {teacher_name || 'Teacher Dashboard'}
          </p>
        </footer>
      </main>
    </div>
  );
}
