import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { date } = await params;

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Fetch calendar events for this date
    const { data: events, error: eventsError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('date', date)
      .order('id', { ascending: true });

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    // Fetch tasks due on this date
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('due_date', date)
      .order('created_at', { ascending: false });

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }

    // Fetch unscheduled tasks (no due_date, not done)
    const { data: unscheduledTasks, error: unscheduledError } = await supabase
      .from('tasks')
      .select('*')
      .is('due_date', null)
      .eq('is_done', false)
      .order('created_at', { ascending: false });

    if (unscheduledError) {
      return NextResponse.json({ error: unscheduledError.message }, { status: 500 });
    }

    // Fetch activities for this date, grouped by class
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('*, classes(name, periods, color)')
      .eq('date', date)
      .order('class_id', { ascending: true })
      .order('sort_order', { ascending: true });

    if (activitiesError) {
      return NextResponse.json({ error: activitiesError.message }, { status: 500 });
    }

    // Fetch bellringer for this date
    const { data: bellringer, error: bellringerError } = await supabase
      .from('bellringers')
      .select('*')
      .eq('date', date)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bellringerError) {
      return NextResponse.json({ error: bellringerError.message }, { status: 500 });
    }

    // If bellringer exists, fetch its prompts
    let bellringerWithPrompts = bellringer;
    if (bellringer) {
      const { data: prompts, error: promptsError } = await supabase
        .from('bellringer_prompts')
        .select('*')
        .eq('bellringer_id', bellringer.id)
        .order('slot', { ascending: true });

      if (promptsError) {
        return NextResponse.json({ error: promptsError.message }, { status: 500 });
      }

      bellringerWithPrompts = { ...bellringer, prompts: prompts ?? [] };
    }

    return NextResponse.json({
      date,
      events: events ?? [],
      tasks: tasks ?? [],
      unscheduled_tasks: unscheduledTasks ?? [],
      bellringer: bellringerWithPrompts ?? null,
      activities: activities ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
