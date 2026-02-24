import { NextRequest, NextResponse } from 'next/server';
import { supabase, getOrCreateBellringer } from '@/lib/db';
import { generateActQuestion } from '@/lib/bellringer-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, notes } = body;

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    // Generate ACT question via AI
    const { result, error: genError } = await generateActQuestion(notes || '');
    if (genError || !result) {
      return NextResponse.json({ error: genError || 'Generation failed' }, { status: 500 });
    }

    // Get or create bellringer
    const { id: bellringerId } = await getOrCreateBellringer(date);

    // Update main bellringer row with ACT fields
    const { data: bellringer, error: updateError } = await supabase
      .from('bellringers')
      .update({
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', bellringerId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ bellringer });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
