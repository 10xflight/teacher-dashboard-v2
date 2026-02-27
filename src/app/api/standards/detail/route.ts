import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'code parameter is required' }, { status: 400 });
    }

    // Fetch the standard
    const { data: standard, error: stdError } = await supabase
      .from('standards')
      .select('id, code, description, strand, subject, grade_band')
      .eq('code', code)
      .single();

    if (stdError || !standard) {
      return NextResponse.json({ error: 'Standard not found' }, { status: 404 });
    }

    // Fetch all activity_standards for this standard, joined with activity + class info
    const { data: tags, error: tagError } = await supabase
      .from('activity_standards')
      .select('activity_id, activities(id, title, date, class_id, lesson_plan_id, classes(name))')
      .eq('standard_id', standard.id)
      .order('activity_id', { ascending: false });

    if (tagError) {
      return NextResponse.json({ error: tagError.message }, { status: 500 });
    }

    const activities = (tags ?? [])
      .map(tag => {
        const act = tag.activities as unknown as {
          id: number;
          title: string;
          date: string | null;
          class_id: number;
          lesson_plan_id: number | null;
          classes: { name: string } | { name: string }[] | null;
        } | null;
        if (!act) return null;
        const cls = Array.isArray(act.classes) ? act.classes[0] : act.classes;
        return {
          id: act.id,
          title: act.title,
          date: act.date,
          className: cls?.name || 'Unknown',
          lesson_plan_id: act.lesson_plan_id,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Sort by date descending, nulls last
        if (!a!.date && !b!.date) return 0;
        if (!a!.date) return 1;
        if (!b!.date) return -1;
        return b!.date.localeCompare(a!.date);
      });

    return NextResponse.json({
      ...standard,
      hit_count: activities.length,
      activities,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
