import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { sendPrincipalNotification } from '@/lib/email-service';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lesson_plan_id } = body;

    if (!lesson_plan_id) {
      return NextResponse.json(
        { error: 'lesson_plan_id is required' },
        { status: 400 }
      );
    }

    // Verify the lesson plan exists
    const { data: plan, error: fetchError } = await supabase
      .from('lesson_plans')
      .select('id, week_of, status')
      .eq('id', lesson_plan_id)
      .single();

    if (fetchError || !plan) {
      return NextResponse.json(
        { error: 'Lesson plan not found' },
        { status: 404 }
      );
    }

    // Generate a unique publish token
    const token = crypto.randomUUID();

    // Update lesson plan: set status to published, store token and timestamp
    const { error: updateError } = await supabase
      .from('lesson_plans')
      .update({
        status: 'published',
        publish_token: token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lesson_plan_id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Build the public URL for the published plan
    const origin = request.headers.get('origin')
      || request.headers.get('x-forwarded-host')
      || 'http://localhost:3000';
    const baseUrl = origin.startsWith('http') ? origin : `https://${origin}`;
    const publishUrl = `${baseUrl}/plans/${token}`;

    // Try to send email notification to principal
    let emailResult = { success: false, message: 'No principal email configured' };

    // Fetch settings for principal_email and teacher_name
    const { data: settingsRows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['principal_email', 'teacher_name']);

    const settings: Record<string, string> = {};
    for (const row of settingsRows ?? []) {
      settings[row.key] = row.value;
    }

    const principalEmail = settings.principal_email;
    const teacherName = settings.teacher_name || 'Teacher';

    if (principalEmail) {
      emailResult = await sendPrincipalNotification(
        publishUrl,
        plan.week_of,
        teacherName,
        principalEmail
      );
    }

    return NextResponse.json({
      token,
      url: publishUrl,
      email_sent: emailResult.success,
      email_message: emailResult.message,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
