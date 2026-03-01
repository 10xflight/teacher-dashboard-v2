import { NextRequest, NextResponse } from 'next/server';
import { loadPrompts } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { date } = await params;

    const { data: bellringer, error } = await supabase
      .from('bellringers')
      .select('*')
      .eq('date', date)
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (error || !bellringer) {
      return NextResponse.json({ bellringer: null, prompts: [] });
    }

    const prompts = await loadPrompts(bellringer.id, supabase);

    return NextResponse.json({ bellringer, prompts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { date } = await params;

    // Find the bellringer for this date
    const { data: bellringer } = await supabase
      .from('bellringers')
      .select('id')
      .eq('date', date)
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (!bellringer) {
      return NextResponse.json({ error: 'No bellringer found for this date' }, { status: 404 });
    }

    // Delete prompts first (foreign key)
    await supabase
      .from('bellringer_prompts')
      .delete()
      .eq('bellringer_id', bellringer.id);

    // Delete the bellringer
    const { error } = await supabase
      .from('bellringers')
      .delete()
      .eq('id', bellringer.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
