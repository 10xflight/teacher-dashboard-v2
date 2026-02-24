import { NextRequest, NextResponse } from 'next/server';
import { supabase, getOrCreateBellringer } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt_id, target_date, slot } = body;

    if (!prompt_id || !target_date || slot === undefined || slot === null) {
      return NextResponse.json(
        { error: 'prompt_id, target_date, and slot are required' },
        { status: 400 }
      );
    }

    // Fetch the source prompt
    const { data: source, error: fetchError } = await supabase
      .from('bellringer_prompts')
      .select('*')
      .eq('id', prompt_id)
      .single();

    if (fetchError || !source) {
      return NextResponse.json({ error: 'Source prompt not found' }, { status: 404 });
    }

    // Get or create bellringer for target date
    const { id: targetBellringerId } = await getOrCreateBellringer(target_date);

    // Copy source prompt to target date/slot
    const { data: prompt, error: upsertError } = await supabase
      .from('bellringer_prompts')
      .upsert(
        {
          bellringer_id: targetBellringerId,
          slot: slot,
          journal_type: source.journal_type,
          journal_prompt: source.journal_prompt,
          journal_subprompt: source.journal_subprompt,
          image_path: source.image_path,
        },
        { onConflict: 'bellringer_id,slot' }
      )
      .select('*')
      .single();

    if (upsertError) throw upsertError;

    return NextResponse.json({ prompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
