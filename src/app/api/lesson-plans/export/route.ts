import { NextRequest, NextResponse } from 'next/server';
import { exportLessonPlanHTML } from '@/lib/export-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lessonPlanId = searchParams.get('lesson_plan_id');

    if (!lessonPlanId) {
      return NextResponse.json(
        { error: 'lesson_plan_id query parameter is required' },
        { status: 400 }
      );
    }

    const id = parseInt(lessonPlanId, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'lesson_plan_id must be a number' },
        { status: 400 }
      );
    }

    const html = await exportLessonPlanHTML(id);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
