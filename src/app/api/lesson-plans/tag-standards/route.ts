import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { tagActivityWithStandards } from '@/lib/standards-tagger';

export async function POST(request: NextRequest) {
  try {
    const { lesson_plan_id } = await request.json();

    if (!lesson_plan_id) {
      return NextResponse.json({ error: 'lesson_plan_id is required' }, { status: 400 });
    }

    // Fetch all activities for this lesson plan
    const { data: activities, error: actError } = await supabase
      .from('activities')
      .select('id, title, description, class_id, classes(name)')
      .eq('lesson_plan_id', lesson_plan_id);

    if (actError) {
      return NextResponse.json({ error: actError.message }, { status: 500 });
    }

    if (!activities || activities.length === 0) {
      return NextResponse.json({ results: [], message: 'No activities found for this plan' });
    }

    const results: { activity_id: number; codes: string[]; reasoning: string; error: string | null }[] = [];

    // Tag each activity
    for (const act of activities) {
      const clsData = act.classes as unknown as { name: string } | { name: string }[] | null;
      const className = (Array.isArray(clsData) ? clsData[0]?.name : clsData?.name) || 'English-1';

      const { codes, reasoning, error: tagError } = await tagActivityWithStandards({
        title: act.title,
        description: act.description,
        class_name: className,
      });

      if (tagError || codes.length === 0) {
        results.push({ activity_id: act.id, codes: [], reasoning, error: tagError });
        continue;
      }

      // Look up standard IDs from codes
      const { data: matchedStandards } = await supabase
        .from('standards')
        .select('id, code, description, strand')
        .in('code', codes);

      if (matchedStandards && matchedStandards.length > 0) {
        const rows = matchedStandards.map((s) => ({
          activity_id: act.id,
          standard_id: s.id,
          tagged_by: 'ai',
        }));

        await supabase
          .from('activity_standards')
          .upsert(rows, { onConflict: 'activity_id,standard_id', ignoreDuplicates: true });
      }

      results.push({
        activity_id: act.id,
        codes: matchedStandards?.map(s => s.code) || [],
        reasoning,
        error: null,
      });
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
