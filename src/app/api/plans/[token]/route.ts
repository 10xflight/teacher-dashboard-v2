import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Fetch the lesson plan by publish_token
    const { data: plan, error: planError } = await supabase
      .from('lesson_plans')
      .select('*')
      .eq('publish_token', token)
      .eq('status', 'published')
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Published lesson plan not found' },
        { status: 404 }
      );
    }

    // Fetch activities linked to this lesson plan
    const { data: activities } = await supabase
      .from('activities')
      .select('id, class_id, date, title, description, activity_type, sort_order, material_status, material_content, is_done, is_graded, classes(name, periods, color)')
      .eq('lesson_plan_id', plan.id)
      .order('date', { ascending: true })
      .order('sort_order', { ascending: true });

    // Fetch standards for all activities
    const activityIds = (activities ?? []).map((a: Record<string, unknown>) => a.id as number);
    let standardsMap: Record<number, { code: string; description: string }[]> = {};
    if (activityIds.length > 0) {
      const { data: activityStandards } = await supabase
        .from('activity_standards')
        .select('activity_id, standards(code, description)')
        .in('activity_id', activityIds);

      if (activityStandards) {
        for (const as_ of activityStandards) {
          const aid = as_.activity_id as number;
          if (!standardsMap[aid]) standardsMap[aid] = [];
          const std = as_.standards as unknown as { code: string; description: string } | null;
          if (std) standardsMap[aid].push(std);
        }
      }
    }

    // Merge standards into activities
    const activitiesWithStandards = (activities ?? []).map((act: Record<string, unknown>) => ({
      ...act,
      standards: standardsMap[act.id as number] || [],
    }));

    // Fetch comments
    const { data: comments } = await supabase
      .from('lesson_plan_comments')
      .select('id, parent_id, author_role, author_name, content, created_at')
      .eq('lesson_plan_id', plan.id)
      .order('created_at', { ascending: true });

    // Fetch settings for school/teacher info
    const { data: settingsRows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['school_name', 'teacher_name']);

    const settings: Record<string, string> = {};
    for (const row of settingsRows ?? []) {
      settings[row.key] = row.value;
    }

    return NextResponse.json({
      plan,
      activities: activitiesWithStandards,
      comments: comments ?? [],
      school_name: settings.school_name || '',
      teacher_name: settings.teacher_name || '',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
