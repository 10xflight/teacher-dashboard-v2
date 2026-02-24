import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

function getNextSchoolDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().split('T')[0];
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the activity
    const { data: activity, error: fetchError } = await supabase
      .from('activities')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (fetchError || !activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    const currentDate = activity.date;
    if (!currentDate) {
      return NextResponse.json({ error: 'Activity has no date to bump from' }, { status: 400 });
    }

    const nextDay = getNextSchoolDay(currentDate);

    // Update the activity: set new date, record where it moved from
    const { data: updated, error: updateError } = await supabase
      .from('activities')
      .update({
        date: nextDay,
        moved_to_date: nextDay,
      })
      .eq('id', parseInt(id))
      .select('*, classes(name, periods, color)')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      activity: updated,
      bumped_from: currentDate,
      bumped_to: nextDay,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
