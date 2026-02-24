import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { tagActivityWithStandards } from '@/lib/standards-tagger';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const activityId = parseInt(id);

    // Fetch the activity with its class info
    const { data: activity, error: actError } = await supabase
      .from('activities')
      .select('*, classes(name)')
      .eq('id', activityId)
      .single();

    if (actError || !activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    const className = activity.classes?.name || 'English-1';

    // Run the AI auto-tagger
    const { codes, reasoning, error: tagError } = await tagActivityWithStandards({
      title: activity.title,
      description: activity.description,
      class_name: className,
    });

    if (tagError) {
      return NextResponse.json({ error: tagError }, { status: 500 });
    }

    if (codes.length === 0) {
      return NextResponse.json({
        activity_id: activityId,
        tagged: [],
        reasoning,
      });
    }

    // Look up standard IDs from codes
    const { data: matchedStandards, error: lookupError } = await supabase
      .from('standards')
      .select('id, code, description, strand')
      .in('code', codes);

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (!matchedStandards || matchedStandards.length === 0) {
      return NextResponse.json({
        activity_id: activityId,
        tagged: [],
        reasoning,
        warning: 'AI returned standard codes but none matched the database.',
      });
    }

    // Insert activity_standards rows (upsert to avoid duplicates)
    const rows = matchedStandards.map((s) => ({
      activity_id: activityId,
      standard_id: s.id,
      tagged_by: 'ai',
    }));

    const { error: insertError } = await supabase
      .from('activity_standards')
      .upsert(rows, { onConflict: 'activity_id,standard_id', ignoreDuplicates: true });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      activity_id: activityId,
      tagged: matchedStandards.map((s) => ({
        id: s.id,
        code: s.code,
        description: s.description,
        strand: s.strand,
      })),
      reasoning,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
