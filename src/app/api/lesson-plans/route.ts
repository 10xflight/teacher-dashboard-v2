import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const list = searchParams.get('list');
    const week_of = searchParams.get('week_of');
    const status = searchParams.get('status');

    // Compact listing mode for chat history sidebar
    if (list === 'true') {
      const all = searchParams.get('all') === 'true';
      let listQuery = supabase
        .from('lesson_plans')
        .select('id, week_of, status, brainstorm_history, created_at')
        .order('week_of', { ascending: false });

      if (!all) {
        listQuery = listQuery.limit(20);
      }

      const { data, error } = await listQuery;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // If all=true, also fetch activity counts per plan
      if (all && data && data.length > 0) {
        const planIds = data.map(p => p.id);
        const { data: actCounts } = await supabase
          .from('activities')
          .select('lesson_plan_id')
          .in('lesson_plan_id', planIds);

        // Count activities per plan
        const countMap: Record<number, number> = {};
        if (actCounts) {
          for (const a of actCounts) {
            if (a.lesson_plan_id) {
              countMap[a.lesson_plan_id] = (countMap[a.lesson_plan_id] || 0) + 1;
            }
          }
        }

        const detailed = data.map(p => ({
          id: p.id,
          week_of: p.week_of,
          status: p.status,
          message_count: Array.isArray(p.brainstorm_history) ? p.brainstorm_history.length : 0,
          activity_count: countMap[p.id] || 0,
          created_at: p.created_at,
        }));

        return NextResponse.json(detailed);
      }

      const compact = (data ?? []).map(p => ({
        id: p.id,
        week_of: p.week_of,
        status: p.status,
        message_count: Array.isArray(p.brainstorm_history) ? p.brainstorm_history.length : 0,
        created_at: p.created_at,
      }));

      return NextResponse.json(compact);
    }

    let query = supabase
      .from('lesson_plans')
      .select('*')
      .order('created_at', { ascending: false });

    if (week_of) {
      query = query.eq('week_of', week_of);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { week_of } = body;

    if (!week_of) {
      return NextResponse.json({ error: 'week_of is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('lesson_plans')
      .insert({
        week_of,
        status: 'draft',
        brainstorm_history: [],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
