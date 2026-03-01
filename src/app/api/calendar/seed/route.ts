import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import calendarData from '@/data/calendar-seed.json';

export async function POST() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    // Get existing events to avoid duplicates
    const { data: existing } = await supabase
      .from('calendar_events')
      .select('date, title');

    const existingSet = new Set(
      (existing ?? []).map((e: { date: string; title: string }) => `${e.date}::${e.title}`)
    );

    const events = calendarData
      .map((e: { date: string; event_type: string; title: string; notes: string }) => ({
        date: e.date,
        event_type: e.event_type,
        title: e.title,
        notes: e.notes || null,
        user_id: user.id,
      }))
      .filter(e => !existingSet.has(`${e.date}::${e.title}`));

    if (events.length === 0) {
      return NextResponse.json({
        message: 'All school calendar events are already imported.',
        seeded: 0,
      });
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .insert(events)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `Imported ${data?.length || 0} school calendar events`,
      seeded: data?.length || 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
