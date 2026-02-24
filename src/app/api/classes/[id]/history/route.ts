import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // Fetch the class
    const { data: classInfo, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (classError || !classInfo) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    // Fetch all activities for this class, most recent first
    const { data: activities, error: actError } = await supabase
      .from('activities')
      .select('*')
      .eq('class_id', parseInt(id))
      .not('date', 'is', null)
      .order('date', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(limit);

    if (actError) {
      return NextResponse.json({ error: actError.message }, { status: 500 });
    }

    // Group activities by week
    const weeks: Record<string, typeof activities> = {};
    for (const act of activities || []) {
      if (!act.date) continue;
      const d = new Date(act.date + 'T12:00:00');
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(d);
      monday.setDate(d.getDate() + diff);
      const weekKey = monday.toISOString().split('T')[0];
      if (!weeks[weekKey]) weeks[weekKey] = [];
      weeks[weekKey]!.push(act);
    }

    // Compute stats
    const totalActivities = (activities || []).length;
    const doneCount = (activities || []).filter(a => a.is_done).length;
    const readyCount = (activities || []).filter(a => a.material_status === 'ready' || a.material_status === 'not_needed').length;

    // Get current unit — most recent activity title pattern
    const recentTitles = (activities || []).slice(0, 5).map(a => a.title);

    return NextResponse.json({
      class: classInfo,
      activities: activities || [],
      weeks,
      stats: {
        total: totalActivities,
        done: doneCount,
        ready: readyCount,
        recent_titles: recentTitles,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
