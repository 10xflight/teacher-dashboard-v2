import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('class_id');
    const sort = searchParams.get('sort') || 'due_date';
    const dir = searchParams.get('dir') || 'asc';
    const ascending = dir === 'asc';
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    // Build query for incomplete tasks
    let todoQuery = supabase
      .from('tasks')
      .select('*')
      .eq('is_done', false);

    if (classId) {
      if (classId === 'null') {
        todoQuery = todoQuery.is('class_id', null);
      } else {
        todoQuery = todoQuery.eq('class_id', classId);
      }
    }

    if (start && end) {
      todoQuery = todoQuery.gte('due_date', start).lte('due_date', end);
    }

    if (sort === 'created_date') {
      todoQuery = todoQuery.order('created_date', { ascending, nullsFirst: false });
    } else {
      todoQuery = todoQuery.order('due_date', { ascending, nullsFirst: false });
    }
    todoQuery = todoQuery.order('created_at', { ascending: false });

    const { data: todo, error: todoError } = await todoQuery;

    if (todoError) {
      return NextResponse.json({ error: todoError.message }, { status: 500 });
    }

    // Fetch completed tasks
    let doneQuery = supabase
      .from('tasks')
      .select('*')
      .eq('is_done', true);

    if (classId) {
      if (classId === 'null') {
        doneQuery = doneQuery.is('class_id', null);
      } else {
        doneQuery = doneQuery.eq('class_id', classId);
      }
    }

    doneQuery = doneQuery.order('completed_at', { ascending: false }).limit(10);

    const { data: done, error: doneError } = await doneQuery;

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
    const { text, due_date, class_id } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const now = new Date();
    const createdDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const insertData: Record<string, unknown> = {
      text: text.trim(),
      is_done: false,
      created_date: createdDate,
    };

    if (due_date) {
      insertData.due_date = due_date;
    }

    if (class_id !== undefined) {
      insertData.class_id = class_id;
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
