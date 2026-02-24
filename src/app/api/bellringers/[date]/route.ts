import { NextRequest, NextResponse } from 'next/server';
import { supabase, loadPrompts } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
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

    const prompts = await loadPrompts(bellringer.id);

    return NextResponse.json({ bellringer, prompts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
