import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { chatWithAI } from '@/lib/ai-service';

const SYSTEM_PROMPT = `You are a standards alignment advisor for a high school English and French teacher at Stratford High School in Oklahoma.

You will receive:
1. The teacher's current lesson plan activities for the week (with any existing standard tags)
2. A list of "gap" standards that have never been covered or haven't been covered in 4+ weeks

Your job is to suggest 3-5 specific, actionable modifications or additions to the existing activities that would address the gap standards. Be practical and concrete — suggest specific activities, discussion prompts, writing assignments, or warm-ups that could be added to the week.

Format your response as a readable message (not JSON). Use bullet points. For each suggestion:
- Name the gap standard code and what it covers
- Suggest a specific activity modification or addition
- Indicate which day/class it could fit into

Keep it concise and teacher-friendly. Prioritize never-hit standards over stale ones.`;

export async function POST(request: NextRequest) {
  try {
    const { lesson_plan_id } = await request.json();

    if (!lesson_plan_id) {
      return NextResponse.json({ error: 'lesson_plan_id is required' }, { status: 400 });
    }

    // Fetch the plan to get week_of
    const { data: plan, error: planError } = await supabase
      .from('lesson_plans')
      .select('id, week_of')
      .eq('id', lesson_plan_id)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
    }

    // Fetch activities with classes and existing tags
    const { data: activities, error: actError } = await supabase
      .from('activities')
      .select('id, title, description, date, activity_type, class_id, classes(name), activity_standards(standard_id, standards(code, description))')
      .eq('lesson_plan_id', lesson_plan_id);

    if (actError) {
      return NextResponse.json({ error: actError.message }, { status: 500 });
    }

    if (!activities || activities.length === 0) {
      return NextResponse.json(
        { error: 'No activities found. Generate a plan first, then try again.' },
        { status: 400 }
      );
    }

    // Fetch all classes
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name')
      .order('id', { ascending: true });

    // Fetch all standards
    const { data: allStandards } = await supabase
      .from('standards')
      .select('id, code, description, strand, subject, grade_band')
      .order('code', { ascending: true });

    // Fetch all activity_standards to compute coverage
    const { data: allActivityStandards } = await supabase
      .from('activity_standards')
      .select('standard_id, activities(date, class_id)');

    // Build coverage map
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const cutoffDate = fourWeeksAgo.toISOString().split('T')[0];

    const coverageMap: Record<string, { hit_count: number; last_hit_date: string | null }> = {};
    for (const row of allActivityStandards ?? []) {
      const activity = row.activities as unknown as { date: string | null; class_id: number } | null;
      if (!activity) continue;
      const key = `${activity.class_id}:${row.standard_id}`;
      if (!coverageMap[key]) coverageMap[key] = { hit_count: 0, last_hit_date: null };
      coverageMap[key].hit_count += 1;
      if (activity.date && (!coverageMap[key].last_hit_date || activity.date > coverageMap[key].last_hit_date!)) {
        coverageMap[key].last_hit_date = activity.date;
      }
    }

    // Build gap standards per class
    const gapLines: string[] = [];
    for (const cls of classes ?? []) {
      const classGaps: string[] = [];
      for (const std of allStandards ?? []) {
        const key = `${cls.id}:${std.id}`;
        const cov = coverageMap[key];
        const hitCount = cov?.hit_count ?? 0;
        const lastHit = cov?.last_hit_date ?? null;

        let isGap = false;
        let gapType = '';
        if (hitCount === 0) {
          isGap = true;
          gapType = 'NEVER COVERED';
        } else if (lastHit && lastHit < cutoffDate) {
          isGap = true;
          gapType = `stale (last: ${lastHit})`;
        }

        if (isGap) {
          classGaps.push(`  ${std.code} [${gapType}]: ${std.description}`);
        }
      }
      if (classGaps.length > 0) {
        gapLines.push(`${cls.name}:\n${classGaps.slice(0, 15).join('\n')}`);
        if (classGaps.length > 15) {
          gapLines.push(`  ... and ${classGaps.length - 15} more gaps`);
        }
      }
    }

    if (gapLines.length === 0) {
      return NextResponse.json({
        suggestions: 'Great news! All standards are covered within the last 4 weeks. No gaps to address right now.',
      });
    }

    // Build current activities summary
    const activityLines = activities.map(a => {
      const clsData = a.classes as unknown as { name: string } | { name: string }[] | null;
      const cls = Array.isArray(clsData) ? clsData[0]?.name || 'Unknown' : clsData?.name || 'Unknown';
      const tagsData = a.activity_standards as unknown as { standards: { code: string } | null }[] | null;
      const tags = tagsData
        ?.map(as => as.standards?.code)
        .filter(Boolean)
        .join(', ') || 'none';
      return `- [${a.date || 'no date'}] ${cls}: "${a.title}" (type: ${a.activity_type}, tags: ${tags})`;
    });

    const userPrompt = `CURRENT WEEK: ${plan.week_of}

CURRENT ACTIVITIES:
${activityLines.join('\n')}

GAP STANDARDS BY CLASS:
${gapLines.join('\n\n')}

Please suggest 3-5 specific modifications or additions to address the most critical gaps.`;

    const suggestions = await chatWithAI(
      SYSTEM_PROMPT,
      [{ role: 'user', content: userPrompt }],
      { temperature: 0.7, maxOutputTokens: 1500 },
    );

    return NextResponse.json({ suggestions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
