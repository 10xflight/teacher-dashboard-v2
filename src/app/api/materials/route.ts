import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const classId = searchParams.get('class_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const search = searchParams.get('search');

    let query = supabase
      .from('activities')
      .select('id, title, date, class_id, activity_type, material_status, material_content, classes(name, color)')
      .eq('material_status', 'ready')
      .not('material_content', 'is', null)
      .order('date', { ascending: false });

    if (type) {
      query = query.filter('material_content->>material_type', 'eq', type);
    }

    if (classId) {
      query = query.eq('class_id', parseInt(classId));
    }

    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
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
