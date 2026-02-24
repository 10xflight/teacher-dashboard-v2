import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    // Fetch incomplete tasks ordered by due_date (nulls last), then created_at descending
    const { data: todo, error: todoError } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_done', false)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (todoError) {
      return NextResponse.json({ error: todoError.message }, { status: 500 });
    }

    // Fetch completed tasks, most recently completed first, limit 10
    const { data: done, error: doneError } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_done', true)
      .order('completed_at', { ascending: false })
      .limit(10);

    if (doneError) {
      return NextResponse.json({ error: doneError.message }, { status: 500 });
    }

    return NextResponse.json({ todo: todo ?? [], done: done ?? [] });
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
    const { text, due_date } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const insertData: Record<string, unknown> = {
      text: text.trim(),
      is_done: false,
    };

    if (due_date) {
      insertData.due_date = due_date;
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert(insertData)
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
