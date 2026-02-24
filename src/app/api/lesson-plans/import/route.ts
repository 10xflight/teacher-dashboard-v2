import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { importLessonPlanDocx } from '@/lib/lesson-plan-importer';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const weekOf = formData.get('week_of') as string | null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'A .docx file is required' },
        { status: 400 }
      );
    }

    if (!weekOf) {
      return NextResponse.json(
        { error: 'week_of is required (YYYY-MM-DD format)' },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = (file as File).name || '';
    if (!fileName.endsWith('.docx') && !file.type.includes('wordprocessingml')) {
      return NextResponse.json(
        { error: 'Only .docx files are supported' },
        { status: 400 }
      );
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the docx file with Gemini
    const { result, error: parseError } = await importLessonPlanDocx(buffer, weekOf);

    if (parseError || !result) {
      return NextResponse.json(
        { error: parseError || 'Failed to parse lesson plan document' },
        { status: 500 }
      );
    }

    // Fetch existing classes for name matching
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id, name')
      .order('id', { ascending: true });

    if (classError) {
      return NextResponse.json(
        { error: `Failed to fetch classes: ${classError.message}` },
        { status: 500 }
      );
    }

    if (!classes || classes.length === 0) {
      return NextResponse.json(
        { error: 'No classes found. Create classes in Settings first.' },
        { status: 400 }
      );
    }

    // Create a lesson plan row
    const { data: lessonPlan, error: planError } = await supabase
      .from('lesson_plans')
      .insert({
        week_of: weekOf,
        status: 'imported',
        raw_input: `Imported from: ${fileName}`,
        brainstorm_history: [],
      })
      .select()
      .single();

    if (planError || !lessonPlan) {
      return NextResponse.json(
        { error: `Failed to create lesson plan: ${planError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Match class names from parsed data to existing classes and create activities
    const allActivities: Record<string, unknown>[] = [];
    for (const day of result.days) {
      for (let i = 0; i < day.activities.length; i++) {
        const act = day.activities[i];
        const matchedClass = matchClassName(act.class_name, classes);

        if (!matchedClass) {
          // Skip activities where we can't match a class
          continue;
        }

        allActivities.push({
          class_id: matchedClass.id,
          lesson_plan_id: lessonPlan.id,
          date: day.date || null,
          title: act.title,
          description: act.description || null,
          activity_type: act.activity_type || 'lesson',
          material_status: 'not_needed',
          sort_order: i,
        });
      }
    }

    let createdActivities: Record<string, unknown>[] = [];
    if (allActivities.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('activities')
        .insert(allActivities)
        .select('*, classes(name, periods, color)');

      if (insertError) {
        return NextResponse.json(
          { error: `Failed to create activities: ${insertError.message}` },
          { status: 500 }
        );
      }

      createdActivities = inserted || [];
    }

    return NextResponse.json({
      lesson_plan_id: lessonPlan.id,
      activities_created: createdActivities.length,
      days: result.days,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Fuzzy-match a class name from the parsed document to an existing class in the DB.
 * Handles variations like "English 1", "Eng-1", "English-1", "French", "French-1", etc.
 */
function matchClassName(
  parsedName: string,
  classes: { id: number; name: string }[]
): { id: number; name: string } | null {
  if (!parsedName) return null;
  const lower = parsedName.toLowerCase().trim();

  // Try exact match first
  const exact = classes.find(c => c.name.toLowerCase() === lower);
  if (exact) return exact;

  // Try contains match
  const contains = classes.find(c => lower.includes(c.name.toLowerCase()));
  if (contains) return contains;

  // Try reverse contains (class name contains parsed name)
  const reverseContains = classes.find(c => c.name.toLowerCase().includes(lower));
  if (reverseContains) return reverseContains;

  // Try keyword matching
  if (lower.includes('french') || lower.includes('fran')) {
    const french = classes.find(c => c.name.toLowerCase().includes('french'));
    if (french) return french;
  }

  if (lower.includes('english') || lower.includes('eng')) {
    // Try to differentiate English-1 vs English-2
    const numMatch = lower.match(/(\d+)/);
    if (numMatch) {
      const num = numMatch[1];
      const specific = classes.find(c =>
        c.name.toLowerCase().includes('english') && c.name.includes(num)
      );
      if (specific) return specific;
    }
    // Fall back to first English class
    const english = classes.find(c => c.name.toLowerCase().includes('english'));
    if (english) return english;
  }

  // Last resort: try matching by period numbers mentioned
  if (lower.includes('1st') || lower.includes('3rd') || lower.includes('5th')) {
    const eng2 = classes.find(c => c.name.toLowerCase().includes('english-2'));
    if (eng2) return eng2;
  }
  if (lower.includes('4th') || lower.includes('6th')) {
    const eng1 = classes.find(c => c.name.toLowerCase().includes('english-1'));
    if (eng1) return eng1;
  }

  // No match found
  return null;
}
