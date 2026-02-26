import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAIConfig, getGeminiModel, generateWithRetry } from '@/lib/ai-service';
import { tagActivityWithStandards } from '@/lib/standards-tagger';

const REGEN_SYSTEM_PROMPT = `You are a creative lesson plan assistant for a high school teacher. Generate ONE alternative activity to replace an existing one.

Rules:
- Keep the same general slot (same class, same day)
- Suggest something DIFFERENT from the original activity
- Keep it practical for a high school classroom
- Do NOT suggest bellringers, journal prompts, warm-ups, or daily openers
- Keep the title concise (3-8 words)
- Keep the description to 1-2 sentences

Respond with ONLY valid JSON:
{"title": "Short activity title", "description": "Brief description", "activity_type": "lesson|game|discussion|writing|assessment|review|project|homework"}`;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const activityId = parseInt(id);

    // Fetch the activity with class info
    const { data: activity, error: actError } = await supabase
      .from('activities')
      .select('*, classes(name, periods, color)')
      .eq('id', activityId)
      .single();

    if (actError || !activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    // Fetch brainstorm history from the parent lesson plan (if any)
    let brainstormSummary = '';
    if (activity.lesson_plan_id) {
      const { data: plan } = await supabase
        .from('lesson_plans')
        .select('brainstorm_history')
        .eq('id', activity.lesson_plan_id)
        .single();

      if (plan?.brainstorm_history && Array.isArray(plan.brainstorm_history)) {
        // Summarize: take last few exchanges for context
        const history = plan.brainstorm_history as { role: string; content: string }[];
        const lastMessages = history.slice(-6);
        brainstormSummary = lastMessages
          .map(m => `${m.role === 'user' ? 'Teacher' : 'AI'}: ${m.content}`)
          .join('\n');
      }
    }

    const className = activity.classes?.name || 'Unknown Class';
    const dateStr = activity.date || 'unscheduled day';

    const userPrompt = `Generate one alternative activity for "${className}" on ${dateStr}.

Current activity being replaced:
- Title: ${activity.title}
- Description: ${activity.description || '(none)'}
- Type: ${activity.activity_type}

${brainstormSummary ? `Context from the teacher's brainstorm conversation:\n${brainstormSummary}` : ''}

Generate a DIFFERENT activity that fits this class and day. Respond with ONLY valid JSON.`;

    const aiConfig = await getAIConfig();
    const model = aiConfig.provider === 'gemini'
      ? getGeminiModel(aiConfig.geminiApiKey, aiConfig.geminiModel)
      : null;

    const result = await generateWithRetry(
      model,
      REGEN_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.9, maxOutputTokens: 500 }
    );

    const title = (result.title as string) || 'Untitled Activity';
    const description = (result.description as string) || '';
    const activityType = (result.activity_type as string) || activity.activity_type;

    // Update the activity in-place
    const { data: updated, error: updateError } = await supabase
      .from('activities')
      .update({
        title,
        description,
        activity_type: activityType,
      })
      .eq('id', activityId)
      .select('*, classes(name, periods, color)')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Re-tag with standards
    const tagResult = await tagActivityWithStandards({
      title,
      description,
      class_name: className,
    });

    if (tagResult.codes.length > 0) {
      // Clear old tags
      await supabase
        .from('activity_standards')
        .delete()
        .eq('activity_id', activityId);

      // Fetch standard IDs for the codes
      const { data: standardRows } = await supabase
        .from('standards')
        .select('id, code')
        .in('code', tagResult.codes);

      if (standardRows && standardRows.length > 0) {
        const inserts = standardRows.map(s => ({
          activity_id: activityId,
          standard_id: s.id,
          tagged_by: 'ai',
        }));
        await supabase.from('activity_standards').insert(inserts);
      }
    }

    // Fetch the final activity with standards join
    const { data: final } = await supabase
      .from('activities')
      .select('*, classes(name, periods, color), activity_standards(standard_id, tagged_by, standards(code, description, strand))')
      .eq('id', activityId)
      .single();

    return NextResponse.json(final || updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
