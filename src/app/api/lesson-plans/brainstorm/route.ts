import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { brainstormWithAI } from '@/lib/lesson-plan-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lesson_plan_id, message } = body;

    if (!lesson_plan_id || !message?.trim()) {
      return NextResponse.json(
        { error: 'lesson_plan_id and message are required' },
        { status: 400 }
      );
    }

    // Fetch the lesson plan
    const { data: plan, error: fetchError } = await supabase
      .from('lesson_plans')
      .select('*')
      .eq('id', lesson_plan_id)
      .single();

    if (fetchError || !plan) {
      return NextResponse.json(
        { error: 'Lesson plan not found' },
        { status: 404 }
      );
    }

    // Get current brainstorm history
    const history = Array.isArray(plan.brainstorm_history)
      ? (plan.brainstorm_history as { role: string; content: string }[])
      : [];

    // Add user message
    history.push({ role: 'user', content: message.trim() });

    // Fetch classes for context
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name, periods')
      .order('id', { ascending: true });

    // Call AI
    const { response, error: aiError } = await brainstormWithAI(history, {
      classes: classes || [],
      weekOf: plan.week_of,
    });

    if (aiError) {
      return NextResponse.json({ error: aiError }, { status: 500 });
    }

    // Add AI response to history
    history.push({ role: 'assistant', content: response });

    // Save updated history back to DB
    const { error: updateError } = await supabase
      .from('lesson_plans')
      .update({
        brainstorm_history: history,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lesson_plan_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      response,
      history,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
