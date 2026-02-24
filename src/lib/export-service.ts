import { supabase } from '@/lib/db';

interface ActivityRow {
  id: number;
  class_id: number;
  date: string | null;
  title: string;
  description: string | null;
  activity_type: string;
  sort_order: number;
  material_status: string;
  is_done: boolean;
  is_graded: boolean;
  classes: { name: string; periods: string | null; color: string | null } | null;
}

interface LessonPlanRow {
  id: number;
  week_of: string;
  status: string;
  raw_input: string | null;
}

/**
 * Generate a clean, printable HTML document for a lesson plan with all
 * activities organized by day and class.
 */
export async function exportLessonPlanHTML(lessonPlanId: number): Promise<string> {
  // Fetch the lesson plan
  const { data: plan, error: planError } = await supabase
    .from('lesson_plans')
    .select('id, week_of, status, raw_input')
    .eq('id', lessonPlanId)
    .single();

  if (planError || !plan) {
    throw new Error(planError?.message || 'Lesson plan not found');
  }

  // Fetch settings for school/teacher name
  const { data: settingsRows } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['school_name', 'teacher_name']);

  const settings: Record<string, string> = {};
  for (const row of settingsRows ?? []) {
    settings[row.key] = row.value;
  }

  // Fetch activities linked to this lesson plan
  const { data: activities, error: actError } = await supabase
    .from('activities')
    .select('id, class_id, date, title, description, activity_type, sort_order, material_status, is_done, is_graded, classes(name, periods, color)')
    .eq('lesson_plan_id', lessonPlanId)
    .order('date', { ascending: true })
    .order('sort_order', { ascending: true });

  if (actError) {
    throw new Error(actError.message);
  }

  const typedActivities = (activities ?? []) as unknown as ActivityRow[];
  const typedPlan = plan as unknown as LessonPlanRow;

  return buildHTML(typedPlan, typedActivities, settings);
}

/**
 * Build the complete HTML document string.
 */
function buildHTML(
  plan: LessonPlanRow,
  activities: ActivityRow[],
  settings: Record<string, string>
): string {
  const schoolName = settings.school_name || '';
  const teacherName = settings.teacher_name || '';
  const weekDisplay = formatWeekDisplay(plan.week_of);

  // Group activities by date, then by class within each date
  const byDate = groupByDate(activities);
  const dates = Object.keys(byDate).sort();

  let daysHtml = '';

  for (const date of dates) {
    const dayActivities = byDate[date];
    const dayLabel = date === 'unscheduled' ? 'Unscheduled' : formatDayLabel(date);

    // Group by class within this day
    const byClass = groupByClass(dayActivities);

    let classesHtml = '';
    for (const [className, classActs] of Object.entries(byClass)) {
      const classColor = classActs[0]?.classes?.color || '#4ECDC4';
      let actRows = '';

      for (const act of classActs) {
        const typeBadge = getTypeBadge(act.activity_type);
        const materialDot = getMaterialDot(act.material_status);
        const gradedStar = act.is_graded ? '<span style="color:#f59e0b;margin-left:4px;">&#9733;</span>' : '';

        actRows += `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
              ${materialDot}
              <span style="font-size:14px;color:#1f2937;">${escapeHtml(act.title)}</span>
              ${gradedStar}
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">
              ${typeBadge}
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">
              ${act.description ? escapeHtml(act.description) : ''}
            </td>
          </tr>`;
      }

      classesHtml += `
        <div style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${classColor};"></span>
            <h3 style="margin:0;font-size:15px;font-weight:600;color:#374151;">${escapeHtml(className)}</h3>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Activity</th>
                <th style="padding:8px 12px;text-align:center;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;width:100px;">Type</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
              </tr>
            </thead>
            <tbody>${actRows}</tbody>
          </table>
        </div>`;
    }

    daysHtml += `
      <div style="margin-bottom:28px;page-break-inside:avoid;">
        <h2 style="margin:0 0 12px;font-size:17px;font-weight:700;color:#1a1a2e;border-bottom:2px solid #4ECDC4;padding-bottom:6px;">
          ${escapeHtml(dayLabel)}
        </h2>
        ${classesHtml}
      </div>`;
  }

  if (dates.length === 0) {
    daysHtml = '<p style="color:#9ca3af;font-size:14px;">No activities found for this lesson plan.</p>';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lesson Plan - Week of ${escapeHtml(weekDisplay)}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none !important; }
      @page { margin: 0.75in; }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      color: #1f2937;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div style="max-width:800px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #e5e7eb;">
      ${schoolName ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(schoolName)}</p>` : ''}
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1a1a2e;">Lesson Plan</h1>
      <p style="margin:0;font-size:16px;color:#4b5563;">Week of ${escapeHtml(weekDisplay)}</p>
      ${teacherName ? `<p style="margin:8px 0 0;font-size:14px;color:#6b7280;">${escapeHtml(teacherName)}</p>` : ''}
    </div>

    ${daysHtml}

    <div class="no-print" style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;">
      <button onclick="window.print()" style="padding:10px 24px;background:#4ECDC4;color:#1a1a2e;border:none;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;">
        Print / Save as PDF
      </button>
    </div>
  </div>
</body>
</html>`;
}

// -- Helpers --

function groupByDate(activities: ActivityRow[]): Record<string, ActivityRow[]> {
  const groups: Record<string, ActivityRow[]> = {};
  for (const act of activities) {
    const key = act.date || 'unscheduled';
    if (!groups[key]) groups[key] = [];
    groups[key].push(act);
  }
  return groups;
}

function groupByClass(activities: ActivityRow[]): Record<string, ActivityRow[]> {
  const groups: Record<string, ActivityRow[]> = {};
  for (const act of activities) {
    const name = act.classes?.name || `Class ${act.class_id}`;
    if (!groups[name]) groups[name] = [];
    groups[name].push(act);
  }
  return groups;
}

function formatWeekDisplay(weekOf: string): string {
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

function getTypeBadge(activityType: string): string {
  const colors: Record<string, { bg: string; text: string }> = {
    lesson: { bg: '#dbeafe', text: '#1e40af' },
    assessment: { bg: '#fce7f3', text: '#9d174d' },
    homework: { bg: '#fef3c7', text: '#92400e' },
    project: { bg: '#d1fae5', text: '#065f46' },
    review: { bg: '#ede9fe', text: '#5b21b6' },
    lab: { bg: '#cffafe', text: '#155e75' },
    discussion: { bg: '#fff7ed', text: '#9a3412' },
  };
  const style = colors[activityType] || { bg: '#f3f4f6', text: '#374151' };
  const label = activityType.charAt(0).toUpperCase() + activityType.slice(1);
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${style.bg};color:${style.text};">${label}</span>`;
}

function getMaterialDot(status: string): string {
  const color = status === 'ready' || status === 'not_needed' ? '#4CAF50' : '#f59e0b';
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle;"></span>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
