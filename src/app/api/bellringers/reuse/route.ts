import { NextRequest, NextResponse } from 'next/server';
import { supabase, getOrCreateBellringer, loadPrompts } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source_id, target_date } = body;

    if (!source_id || !target_date) {
      return NextResponse.json(
        { error: 'source_id and target_date are required' },
        { status: 400 }
      );
    }

    // Fetch the source bellringer
    const { data: source, error: fetchError } = await supabase
      .from('bellringers')
      .select('*')
      .eq('id', source_id)
      .single();

    if (fetchError || !source) {
      return NextResponse.json({ error: 'Source bellringer not found' }, { status: 404 });
    }

    // Load source prompts
    const sourcePrompts = await loadPrompts(source_id);

    // Get or create bellringer for target date
    const { id: targetId } = await getOrCreateBellringer(target_date);

    // Copy main bellringer fields to target
    const { error: updateError } = await supabase
      .from('bellringers')
      .update({
        journal_type: source.journal_type,
        journal_prompt: source.journal_prompt,
        journal_subprompt: source.journal_subprompt,
        journal_image_path: source.journal_image_path,
        act_skill_category: source.act_skill_category,
        act_skill: source.act_skill,
        act_question: source.act_question,
        act_choice_a: source.act_choice_a,
        act_choice_b: source.act_choice_b,
        act_choice_c: source.act_choice_c,
        act_choice_d: source.act_choice_d,
        act_correct_answer: source.act_correct_answer,
        act_explanation: source.act_explanation,
        act_rule: source.act_rule,
        status: 'draft',
        is_approved: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetId);

    if (updateError) throw updateError;

    // Copy all prompts to target
    for (const p of sourcePrompts) {
      const { error: upsertError } = await supabase
        .from('bellringer_prompts')
        .upsert(
          {
            bellringer_id: targetId,
            slot: p.slot,
            journal_type: p.journal_type,
            journal_prompt: p.journal_prompt,
            journal_subprompt: p.journal_subprompt,
            image_path: p.image_path,
          },
          { onConflict: 'bellringer_id,slot' }
        );

      if (upsertError) throw upsertError;
    }

    // Return the new bellringer + prompts
    const { data: bellringer } = await supabase
      .from('bellringers')
      .select('*')
      .eq('id', targetId)
      .single();

    const prompts = await loadPrompts(targetId);

    return NextResponse.json({ bellringer, prompts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
