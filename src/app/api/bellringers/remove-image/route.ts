import { NextRequest, NextResponse } from 'next/server';
import { supabase, getOrCreateBellringer } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, slot } = body;

    if (!date || slot === undefined || slot === null) {
      return NextResponse.json({ error: 'date and slot are required' }, { status: 400 });
    }

    // Get or create bellringer
    const { id: bellringerId } = await getOrCreateBellringer(date);

    // Set image_path to null on bellringer_prompts
    const { data: prompt, error: updateError } = await supabase
      .from('bellringer_prompts')
      .update({ image_path: null })
      .eq('bellringer_id', bellringerId)
      .eq('slot', slot)
      .select('*')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, prompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
