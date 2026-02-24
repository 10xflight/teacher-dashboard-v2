import { NextRequest, NextResponse } from 'next/server';
import { supabase, getOrCreateBellringer } from '@/lib/db';
import { generateSinglePrompt } from '@/lib/bellringer-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, slot, prompt_type, notes } = body;

    if (!date || slot === undefined || slot === null) {
      return NextResponse.json({ error: 'date and slot are required' }, { status: 400 });
    }

    // Generate a single prompt via AI
    const { result, error: genError } = await generateSinglePrompt(prompt_type, notes || '');
    if (genError || !result) {
      return NextResponse.json({ error: genError || 'Generation failed' }, { status: 500 });
    }

    // Get or create bellringer
    const { id: bellringerId } = await getOrCreateBellringer(date);

    // Upsert into bellringer_prompts at the given slot
    const { data: prompt, error: upsertError } = await supabase
      .from('bellringer_prompts')
      .upsert(
        {
          bellringer_id: bellringerId,
          slot: slot,
          journal_type: result.journal_type as string || null,
          journal_prompt: result.journal_prompt as string || null,
          journal_subprompt: result.journal_subprompt as string || 'WRITE A PARAGRAPH IN YOUR JOURNAL!',
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
