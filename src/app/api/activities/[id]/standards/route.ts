import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { id } = await params;
    const { standard_id } = await request.json();

    if (!standard_id) {
      return NextResponse.json({ error: 'standard_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('activity_standards')
      .upsert(
        { activity_id: parseInt(id), standard_id, tagged_by: 'manual' },
        { onConflict: 'activity_id,standard_id' }
      )
      .select('standard_id, tagged_by, standards(code, description, strand)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { id } = await params;
    const { standard_id } = await request.json();

    if (!standard_id) {
      return NextResponse.json({ error: 'standard_id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('activity_standards')
      .delete()
      .eq('activity_id', parseInt(id))
      .eq('standard_id', standard_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
