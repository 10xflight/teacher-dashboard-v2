import { NextRequest, NextResponse } from 'next/server';
import { supabase, getOrCreateBellringer, loadPrompts } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      date,
      prompts,
      act_skill_category,
      act_skill,
      act_question,
      act_choice_a,
      act_choice_b,
      act_choice_c,
      act_choice_d,
      act_correct_answer,
      act_explanation,
      act_rule,
    } = body;

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    // Get or create bellringer
    const { id: bellringerId } = await getOrCreateBellringer(date);

    // Build update object for main row with ACT fields + first prompt backwards compat
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // ACT fields
    if (act_skill_category !== undefined) updateData.act_skill_category = act_skill_category;
    if (act_skill !== undefined) updateData.act_skill = act_skill;
    if (act_question !== undefined) updateData.act_question = act_question;
    if (act_choice_a !== undefined) updateData.act_choice_a = act_choice_a;
    if (act_choice_b !== undefined) updateData.act_choice_b = act_choice_b;
    if (act_choice_c !== undefined) updateData.act_choice_c = act_choice_c;
    if (act_choice_d !== undefined) updateData.act_choice_d = act_choice_d;
    if (act_correct_answer !== undefined) updateData.act_correct_answer = act_correct_answer;
    if (act_explanation !== undefined) updateData.act_explanation = act_explanation;
    if (act_rule !== undefined) updateData.act_rule = act_rule;

    // Backwards compat: copy first prompt to main row
    const promptsArray = prompts as Array<{
      slot: number;
      journal_type: string;
      journal_prompt: string;
      journal_subprompt: string;
    }>;

    if (promptsArray && promptsArray.length > 0) {
      const first = promptsArray.find((p) => p.slot === 0) || promptsArray[0];
      updateData.journal_type = first.journal_type;
      updateData.journal_prompt = first.journal_prompt;
      updateData.journal_subprompt = first.journal_subprompt || 'WRITE A PARAGRAPH IN YOUR JOURNAL!';
    }

    const { error: updateError } = await supabase
      .from('bellringers')
      .update(updateData)
      .eq('id', bellringerId);

    if (updateError) throw updateError;

    // Upsert each prompt
    if (promptsArray && promptsArray.length > 0) {
      for (const p of promptsArray) {
        const { error: upsertError } = await supabase
          .from('bellringer_prompts')
          .upsert(
            {
              bellringer_id: bellringerId,
              slot: p.slot,
              journal_type: p.journal_type || null,
              journal_prompt: p.journal_prompt || null,
              journal_subprompt: p.journal_subprompt || 'WRITE A PARAGRAPH IN YOUR JOURNAL!',
            },
            { onConflict: 'bellringer_id,slot' }
          );

        if (upsertError) throw upsertError;
      }
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
