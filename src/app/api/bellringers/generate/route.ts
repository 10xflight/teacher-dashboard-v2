import { NextRequest, NextResponse } from 'next/server';
import { supabase, getOrCreateBellringer, loadPrompts } from '@/lib/db';
import { generateFullBellringer } from '@/lib/bellringer-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, notes, promptsOnly } = body;

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    // Generate content via AI
    const { result, error: genError } = await generateFullBellringer(notes || '');
    if (genError || !result) {
      return NextResponse.json({ error: genError || 'Generation failed' }, { status: 500 });
    }

    // Get or create bellringer row
    const { id: bellringerId } = await getOrCreateBellringer(date);

    // Update main bellringer row (backwards compat for first prompt + optionally ACT)
    const updateFields: Record<string, unknown> = {
      journal_type: result.journal_type as string || null,
      journal_prompt: result.journal_prompt as string || null,
      journal_subprompt: result.journal_subprompt as string || 'WRITE A PARAGRAPH IN YOUR JOURNAL!',
      status: 'draft',
      updated_at: new Date().toISOString(),
    };

    // Only save ACT fields if not in promptsOnly mode (avoids race with separate ACT generation)
    if (!promptsOnly) {
      Object.assign(updateFields, {
        act_skill_category: result.act_skill_category as string || null,
        act_skill: result.act_skill as string || null,
        act_question: result.act_question as string || null,
        act_choice_a: result.act_choice_a as string || null,
        act_choice_b: result.act_choice_b as string || null,
        act_choice_c: result.act_choice_c as string || null,
        act_choice_d: result.act_choice_d as string || null,
        act_correct_answer: result.act_correct_answer as string || null,
        act_explanation: result.act_explanation as string || null,
        act_rule: result.act_rule as string || null,
      });
    }

    const { error: updateError } = await supabase
      .from('bellringers')
      .update(updateFields)
      .eq('id', bellringerId);

    if (updateError) throw updateError;

    // Upsert all 4 prompts into bellringer_prompts
    const prompts = (result.prompts as Array<Record<string, string>>) || [];
    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i];
      const { error: upsertError } = await supabase
        .from('bellringer_prompts')
        .upsert(
          {
            bellringer_id: bellringerId,
            slot: i,
            journal_type: p.journal_type || null,
            journal_prompt: p.journal_prompt || null,
            journal_subprompt: p.journal_subprompt || 'WRITE A PARAGRAPH IN YOUR JOURNAL!',
          },
          { onConflict: 'bellringer_id,slot' }
        );

      if (upsertError) throw upsertError;
    }

    // Return updated bellringer + prompts
    const { data: bellringer } = await supabase
      .from('bellringers')
      .select('*')
      .eq('id', bellringerId)
      .single();

    const savedPrompts = await loadPrompts(bellringerId);

    return NextResponse.json({ bellringer, prompts: savedPrompts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
