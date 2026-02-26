import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const class_id = searchParams.get('class_id');

    let query = supabase
      .from('activities')
      .select('*, classes(name, periods, color), activity_standards(standard_id, tagged_by, standards(code, description, strand))')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (date) {
      query = query.eq('date', date);
    }
    if (class_id) {
      query = query.eq('class_id', parseInt(class_id));
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
    const { class_id, date, title, description, activity_type, lesson_plan_id, material_status, sort_order } = body;

    if (!class_id || !title?.trim()) {
      return NextResponse.json({ error: 'class_id and title are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('activities')
      .insert({
        class_id,
        date: date || null,
        title: title.trim(),
        description: description || null,
        activity_type: activity_type || 'lesson',
        lesson_plan_id: lesson_plan_id || null,
        material_status: material_status || 'not_needed',
        sort_order: sort_order ?? 0,
      })
      .select('*, classes(name, periods, color)')
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
