'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface SubDashSnapshot {
  date: string;
  teacher_name: string;
  school_name: string;
  room_number: string;
  office_phone: string;
  sub_name: string | null;
  sub_contact: string | null;
  custom_notes: string | null;
  schedule: Array<{ period: string; time: string; class_name: string }>;
  periods: Array<{
    period: string;
    time: string;
    class_name: string;
    instructions: Array<{
      title: string;
      description: string | null;
      activity_type: string;
      material_file_path: string | null;
    }>;
  }>;
  bellringer: {
    display_url: string;
    prompts: Array<{ type: string; prompt: string }>;
    act_question: string | null;
    act_choices: string[];
    act_correct: string | null;
    act_explanation: string | null;
  } | null;
  management_notes: string;
  behavior_policy: string;
  seating_chart_urls: string[];
  emergency_contacts: string;
  standing_instructions: string;
  backup_activities: string[];
  media: Array<{ name: string; file_path: string | null; url: string | null; media_type: string }>;
  generated_at: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SubDashPublicPage() {
  const params = useParams();
  const token = String(params.token);

  const [data, setData] = useState<SubDashSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/subdash/${token}`);
      if (!res.ok) {
        setError('SubDash not found or not yet shared.');
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError('Failed to load SubDash.');
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">SubDash Not Found</h1>
          <p className="text-gray-500">{error || 'This link may have expired or is invalid.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 print:static">
        <div className="max-w-3xl mx-auto px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{data.school_name}</p>
              <h1 className="text-lg font-bold text-gray-900">{data.teacher_name}</h1>
              <p className="text-sm text-teal-600 font-medium">{formatDateShort(data.date)}</p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors print:hidden"
            >
              Print
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6 space-y-5">
        {/* Quick info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {data.room_number && <span className="text-gray-700"><span className="font-medium">Room:</span> {data.room_number}</span>}
          {data.office_phone && <span className="text-gray-700"><span className="font-medium">Office:</span> {data.office_phone}</span>}
          {data.sub_name && <span className="text-gray-700"><span className="font-medium">Sub:</span> {data.sub_name}</span>}
          {data.sub_contact && <span className="text-gray-700"><span className="font-medium">Contact:</span> {data.sub_contact}</span>}
        </div>

        {/* Schedule */}
        {data.schedule.length > 0 && (
          <Section title="Schedule" emoji="📅">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-left py-1.5 font-medium">Period</th>
                  <th className="text-left py-1.5 font-medium">Time</th>
                  <th className="text-left py-1.5 font-medium">Class</th>
                </tr>
              </thead>
              <tbody>
                {data.schedule.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 text-gray-800 font-medium">{s.period}</td>
                    <td className="py-1.5 text-gray-600">{s.time}</td>
                    <td className="py-1.5 text-gray-800">{s.class_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Bellringer */}
        {data.bellringer && (
          <Section title="Bellringer" emoji="🔔">
            {data.bellringer.display_url && (
              <a
                href={data.bellringer.display_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mb-3 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-100 transition-colors"
              >
                Open Bellringer Display &rarr;
              </a>
            )}
            {data.bellringer.prompts.length > 0 && (
              <div className="space-y-1 mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase">Journal Prompts</p>
                {data.bellringer.prompts.map((p, i) => (
                  <p key={i} className="text-sm text-gray-700">
                    <span className="font-medium capitalize">{p.type}:</span> {p.prompt}
                  </p>
                ))}
                <p className="text-sm font-bold text-teal-600 mt-2">Students should WRITE A PARAGRAPH IN THEIR JOURNAL!</p>
              </div>
            )}
            {data.bellringer.act_question && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">ACT Prep Question</p>
                <p className="text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: data.bellringer.act_question }} />
                <div className="mt-1 text-sm text-gray-600 space-y-0.5">
                  {data.bellringer.act_choices.map((c, i) => <p key={i}>{c}</p>)}
                </div>
                <p className="text-sm font-semibold text-green-600 mt-2">Answer: {data.bellringer.act_correct}</p>
                {data.bellringer.act_explanation && (
                  <p className="text-xs text-gray-500 mt-1">{data.bellringer.act_explanation}</p>
                )}
              </div>
            )}
          </Section>
        )}

        {/* Period-by-period instructions */}
        {data.periods.map((period, i) => (
          <Section key={i} title={`${period.period}: ${period.class_name}`} emoji="📋" subtitle={period.time}>
            {period.instructions.length > 0 ? (
              <ol className="list-decimal list-inside space-y-2">
                {period.instructions.map((inst, j) => (
                  <li key={j} className="text-sm text-gray-700">
                    <span className="font-medium">{inst.title}</span>
                    {inst.description && <span className="text-gray-500"> — {inst.description}</span>}
                    {inst.material_file_path && (
                      <a href={inst.material_file_path} target="_blank" rel="noopener noreferrer" className="ml-2 text-teal-600 hover:underline text-xs">📎 Download</a>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-400 italic">No specific activities planned. See backup activities below.</p>
            )}
          </Section>
        ))}

        {/* Teacher Notes */}
        {data.custom_notes && (
          <Section title="Teacher Notes" emoji="📝">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.custom_notes}</p>
          </Section>
        )}

        {/* Standing Instructions */}
        {data.standing_instructions && (
          <Section title="Standing Instructions" emoji="📌">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.standing_instructions}</p>
          </Section>
        )}

        {/* Classroom Management */}
        {(data.management_notes || data.behavior_policy || data.seating_chart_urls.length > 0) && (
          <Section title="Classroom Management" emoji="🏫">
            {data.management_notes && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Management Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.management_notes}</p>
              </div>
            )}
            {data.behavior_policy && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Behavior Policy</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.behavior_policy}</p>
              </div>
            )}
            {data.seating_chart_urls.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Seating Charts</p>
                <div className="flex flex-wrap gap-3">
                  {data.seating_chart_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`Seating chart ${i + 1}`} className="w-48 h-48 object-cover rounded-lg border border-gray-200 hover:shadow-md transition-shadow" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Resources & Files */}
        {data.media.length > 0 && (
          <Section title="Resources & Files" emoji="📁">
            <div className="space-y-2">
              {data.media.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span>{item.media_type === 'file' ? '📄' : item.media_type === 'video' ? '🎬' : '🔗'}</span>
                  {item.file_path ? (
                    <a href={item.file_path} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-600 hover:underline font-medium">
                      Download {item.name}
                    </a>
                  ) : item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-600 hover:underline font-medium">
                      {item.name} &rarr;
                    </a>
                  ) : (
                    <span className="text-sm text-gray-700">{item.name}</span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Emergency Contacts */}
        {data.emergency_contacts && (
          <Section title="Emergency Contacts" emoji="🚨">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.emergency_contacts}</p>
          </Section>
        )}

        {/* Backup Activities */}
        {data.backup_activities.length > 0 && (
          <Section title="If Tech Fails / Backup Activities" emoji="🔧">
            <ol className="list-decimal list-inside space-y-1">
              {data.backup_activities.map((a, i) => (
                <li key={i} className="text-sm text-gray-700">{a}</li>
              ))}
            </ol>
          </Section>
        )}

        {/* Footer */}
        <footer className="text-center py-6 print:py-2">
          <p className="text-xs text-gray-400">
            SubDash &middot; {data.teacher_name} &middot; Generated {new Date(data.generated_at).toLocaleDateString()}
          </p>
        </footer>
      </main>
    </div>
  );
}

function Section({
  title,
  emoji,
  subtitle,
  children,
}: {
  title: string;
  emoji: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <span>{emoji}</span>
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
        {subtitle && <span className="text-sm text-gray-400 ml-auto">{subtitle}</span>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
