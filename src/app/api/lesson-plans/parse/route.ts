import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { parseBrainstormToActivities } from '@/lib/lesson-plan-generator';
import { tagActivityWithStandards } from '@/lib/standards-tagger';

/**
 * Calculate Mon-Fri dates for a given week_of date string (YYYY-MM-DD).
 * week_of should be a Monday, but we handle any day by finding that week's Monday.
 */
function getWeekDates(weekOf: string): string[] {
  const d = new Date(weekOf + 'T12:00:00');
  // Find Monday of that week
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday → go back 6, otherwise go to Monday
  d.setDate(d.getDate() + diff);

  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const current = new Date(d);
    current.setDate(d.getDate() + i);
    dates.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
  }
  return dates;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lesson_plan_id } = body;

    if (!lesson_plan_id) {
      return NextResponse.json(
        { error: 'lesson_plan_id is required' },
        { status: 400 }
      );
    }

    // Fetch the lesson plan
    const { data: plan, error: fetchError } = await supabase
      .from('lesson_plans')
      .select('*')
      .eq('id', lesson_plan_id)
      .single();

    if (fetchError || !plan) {
      return NextResponse.json(
        { error: 'Lesson plan not found' },
        { status: 404 }
      );
    }

    const history = Array.isArray(plan.brainstorm_history)
      ? (plan.brainstorm_history as { role: string; content: string }[])
      : [];

    if (history.length === 0) {
      return NextResponse.json(
        { error: 'No brainstorm history to parse. Chat with the AI first!' },
        { status: 400 }
      );
    }

    // Fetch classes
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name')
      .order('id', { ascending: true });

    if (!classes || classes.length === 0) {
      return NextResponse.json(
        { error: 'No classes found. Create classes in Settings first.' },
        { status: 400 }
      );
    }

    // Calculate week dates
    const weekDates = getWeekDates(plan.week_of);

    // Parse brainstorm into activities
    const { result, error: parseError } = await parseBrainstormToActivities(
      history,
      classes,
      weekDates
    );

    if (parseError || !result) {
      return NextResponse.json(
        { error: parseError || 'Failed to parse brainstorm' },
        { status: 500 }
      );
    }

    // Delete existing activities for this lesson plan (re-generate replaces old ones)
    await supabase
      .from('activities')
      .delete()
      .eq('lesson_plan_id', lesson_plan_id);

    // Create activity rows in DB
    const allActivities: Record<string, unknown>[] = [];
    for (const day of result.days) {
      for (let i = 0; i < day.activities.length; i++) {
        const act = day.activities[i];
        allActivities.push({
          class_id: act.class_id,
          lesson_plan_id: lesson_plan_id,
          date: day.date,
          title: act.title,
          description: act.description || null,
          activity_type: act.activity_type || 'lesson',
          material_status: act.material_status || 'not_needed',
          sort_order: i,
        });
      }
    }

    let createdActivities: Record<string, unknown>[] = [];
    if (allActivities.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('activities')
        .insert(allActivities)
        .select('*, classes(name, periods, color)');

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }

      createdActivities = inserted || [];
    }

    // Auto-tag activities with standards
    const taggingSummary: { activity_id: number; codes: string[]; error: string | null }[] = [];
    for (const act of createdActivities) {
      const className = (act as Record<string, unknown>).classes
        ? ((act as Record<string, unknown>).classes as { name: string }).name
        : '';
      if (!className) continue;

      const tagResult = await tagActivityWithStandards({
        title: (act as Record<string, unknown>).title as string,
        description: ((act as Record<string, unknown>).description as string) || null,
        class_name: className,
      });

      const actId = (act as Record<string, unknown>).id as number;
      taggingSummary.push({ activity_id: actId, codes: tagResult.codes, error: tagResult.error });

      if (tagResult.codes.length > 0) {
        // Look up standard IDs from codes
        const { data: standardRows } = await supabase
          .from('standards')
          .select('id, code')
          .in('code', tagResult.codes);

        if (standardRows && standardRows.length > 0) {
          const upsertRows = standardRows.map(s => ({
            activity_id: actId,
            standard_id: s.id,
            tagged_by: 'ai',
          }));

          await supabase
            .from('activity_standards')
            .upsert(upsertRows, { onConflict: 'activity_id,standard_id' });
        }
      }
    }

    return NextResponse.json({
      activities: createdActivities,
      days: result.days,
      tagging: taggingSummary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
