import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { generateFullBellringer } from '@/lib/bellringer-generator';
import { localDateStr } from '@/lib/task-helpers';

function getWeekDates(mondayStr: string): string[] {
  const d = new Date(mondayStr + 'T12:00:00');
  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    dates.push(localDateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function getMondayOfWeek(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : day === 6 ? 2 : (day === 1 ? 0 : -(day - 1));
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const weekOf = body.week_of || getMondayOfWeek();
    const teacherNotes = body.notes || '';
    const skipExisting = body.skip_existing !== false;

    const dates = getWeekDates(weekOf);
    const results: Array<{ date: string; success: boolean; bellringer_id?: number; error?: string; skipped?: boolean }> = [];

    for (const dateStr of dates) {
      // Check if bellringer already exists for this date
      if (skipExisting) {
        const { data: existing } = await supabase
          .from('bellringers')
          .select('id')
          .eq('date', dateStr)
          .limit(1)
          .maybeSingle();

        if (existing) {
          results.push({ date: dateStr, success: true, bellringer_id: existing.id, skipped: true });
          continue;
        }
      }

      try {
        const { result, error } = await generateFullBellringer(teacherNotes);
        if (error || !result) {
          results.push({ date: dateStr, success: false, error: error || 'Generation failed' });
          continue;
        }

        // Create bellringer row
        const { data: bellringer, error: insertError } = await supabase
          .from('bellringers')
          .insert({
            date: dateStr,
            journal_type: result.journal_type as string || null,
            journal_prompt: result.journal_prompt as string || null,
            journal_subprompt: result.journal_subprompt as string || 'WRITE A PARAGRAPH IN YOUR JOURNAL!',
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
            status: 'draft',
            is_approved: false,
          })
          .select('id')
          .single();

        if (insertError || !bellringer) {
          results.push({ date: dateStr, success: false, error: insertError?.message || 'Insert failed' });
          continue;
        }

        // Insert prompts if available
        const prompts = result.prompts as Array<Record<string, string>> | undefined;
        if (prompts && prompts.length > 0) {
          const promptRows = prompts.map((p, i) => ({
            bellringer_id: bellringer.id,
            slot: i,
            journal_type: p.journal_type || null,
            journal_prompt: p.journal_prompt || null,
            journal_subprompt: p.journal_subprompt || 'WRITE A PARAGRAPH IN YOUR JOURNAL!',
          }));

          await supabase.from('bellringer_prompts').insert(promptRows);
        }

        results.push({ date: dateStr, success: true, bellringer_id: bellringer.id });
      } catch (e) {
        results.push({ date: dateStr, success: false, error: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    const successCount = results.filter(r => r.success && !r.skipped).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const failedCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      week_of: weekOf,
      results,
      summary: { generated: successCount, skipped: skippedCount, failed: failedCount },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
