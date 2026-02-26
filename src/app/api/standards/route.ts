import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');

    // Fetch standards with a count of tagged activities
    let query = supabase
      .from('standards')
      .select('*, activity_standards(count)')
      .order('subject', { ascending: true })
      .order('grade_band', { ascending: true })
      .order('code', { ascending: true });

    if (subject) {
      query = query.ilike('subject', subject);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten the count from Supabase's nested aggregate format
    const standards = (data ?? []).map((row) => {
      const countArr = row.activity_standards as { count: number }[] | undefined;
      const activityCount = countArr?.[0]?.count ?? 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { activity_standards, ...rest } = row;
      return { ...rest, activity_count: activityCount };
    });

    return NextResponse.json(standards);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    // 1. Delete all activity_standards tags
    const { error: tagError } = await supabase
      .from('activity_standards')
      .delete()
      .neq('standard_id', 0);

    if (tagError) {
      return NextResponse.json({ error: tagError.message }, { status: 500 });
    }

    // 2. Delete all standards
    const { error: stdError } = await supabase
      .from('standards')
      .delete()
      .neq('id', 0);

    if (stdError) {
      return NextResponse.json({ error: stdError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
