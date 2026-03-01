import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateBellringer } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const body = await request.json();
    const { date, slot } = body;

    if (!date || slot === undefined || slot === null) {
      return NextResponse.json({ error: 'date and slot are required' }, { status: 400 });
    }

    // Get or create bellringer
    const { id: bellringerId } = await getOrCreateBellringer(date, supabase, user.id);

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
