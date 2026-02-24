'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface LessonPlan {
  id: number;
  week_of: string;
  publish_token: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

interface CommentCount {
  lesson_plan_id: number;
  count: number;
}

function formatWeekLabel(weekOf: string): string {
  try {
    const d = new Date(weekOf + 'T12:00:00');
    const fri = new Date(d);
    fri.setDate(d.getDate() + 4);
    const mStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fStr = fri.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${mStr} - ${fStr}`;
  } catch {
    return weekOf;
  }
}

function formatPublishedDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export const dynamic = 'force-dynamic';

export default function PrincipalPortalPage() {
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('');
  const [teacherName, setTeacherName] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [plansRes, settingsRes] = await Promise.all([
          fetch('/api/lesson-plans?status=published'),
          fetch('/api/settings'),
        ]);

        if (plansRes.ok) {
          const data = await plansRes.json();
          // Sort by week_of descending
          data.sort((a: LessonPlan, b: LessonPlan) => b.week_of.localeCompare(a.week_of));
          setPlans(data);
        }

        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings.school_name) setSchoolName(settings.school_name);
          if (settings.teacher_name) setTeacherName(settings.teacher_name);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
          <div className="text-center">
            {schoolName && (
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                {schoolName}
              </p>
            )}
            <h1 className="text-2xl font-bold text-gray-900">Lesson Plans</h1>
            {teacherName && (
              <p className="text-sm text-gray-500 mt-1">{teacherName}</p>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">No Published Plans Yet</h2>
            <p className="text-sm text-gray-500">Published lesson plans will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => (
              <Link
                key={plan.id}
                href={plan.publish_token ? `/plans/${plan.publish_token}` : '#'}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-teal-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 group-hover:text-teal-600 transition-colors">
                      Week of {formatWeekLabel(plan.week_of)}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Published {formatPublishedDate(plan.updated_at || plan.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      Published
                    </span>
                    <svg className="w-5 h-5 text-gray-300 group-hover:text-teal-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8">
        <p className="text-xs text-gray-400">
          {teacherName || 'Teacher Dashboard'} &middot; Lesson Plan Portal
        </p>
      </footer>
    </div>
  );
}
