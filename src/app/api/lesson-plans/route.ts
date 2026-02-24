import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week_of = searchParams.get('week_of');
    const status = searchParams.get('status');

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
