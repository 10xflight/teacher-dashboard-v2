import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { generateMaterial, MaterialType } from '@/lib/material-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { activity_id, material_type, teacher_notes } = body;

    if (!activity_id || !material_type) {
      return NextResponse.json({ error: 'activity_id and material_type are required' }, { status: 400 });
    }

    // Fetch the activity with its class info
    const { data: activity, error: actError } = await supabase
      .from('activities')
      .select('*, classes(name, periods, color)')
      .eq('id', activity_id)
      .single();

    if (actError || !activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    const className = activity.classes?.name || 'Unknown Class';
    const gradeLevel = className.toLowerCase().includes('french') ? 'French 1'
      : className.includes('9') || className.includes('1') ? '9th'
      : '10th';

    const { result, error } = await generateMaterial({
      class_name: className,
      grade_level: gradeLevel,
      activity_title: activity.title,
      description: activity.description || undefined,
      material_type: material_type as MaterialType,
      teacher_notes: teacher_notes || undefined,
    });

    if (error || !result) {
      return NextResponse.json({ error: error || 'Generation failed' }, { status: 500 });
    }

    // Save material content to the activity
    const { error: updateError } = await supabase
      .from('activities')
      .update({
        material_content: result,
        material_status: 'ready',
      })
      .eq('id', activity_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      material: result,
      activity_id,
      material_type,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
