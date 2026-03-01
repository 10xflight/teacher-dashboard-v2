import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getValidAccessToken, fetchRecentEmails, getMSSettings, updateLastFetch } from '@/lib/ms-graph';
import { extractAndQueueTasks } from '@/lib/email-task-extractor';
import type { ClassInfo } from '@/lib/types';

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Microsoft 365 not connected' },
        { status: 400 },
      );
    }

    // Get last fetch time
    const msSettings = await getMSSettings();
    const since = msSettings.ms_last_fetch || undefined;

    // Fetch emails from Graph API
    const rawEmails = await fetchRecentEmails(accessToken, since);

    // Get teacher info and classes for AI context
    const { data: settingsData } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['teacher_name', 'school_name']);

    const settings: Record<string, string> = {};
    for (const row of settingsData || []) {
      settings[row.key] = row.value;
    }

    const { data: classesData } = await supabase
      .from('classes')
      .select('id, name, periods, color');

    const classes = (classesData || []) as ClassInfo[];

    // Transform emails for the extractor
    const emails = rawEmails.map(e => ({
      id: e.id,
      subject: e.subject || '(no subject)',
      from: e.from?.emailAddress?.address || '',
      receivedDateTime: e.receivedDateTime,
      bodyContent: e.body?.content || '',
      bodyType: e.body?.contentType || 'text',
    }));

    // Run AI extraction
    const inserted = await extractAndQueueTasks(
      emails,
      settings.teacher_name || 'Teacher',
      settings.school_name || '',
      classes,
    );

    // Update last fetch timestamp
    await updateLastFetch();

    return NextResponse.json({
      fetched: rawEmails.length,
      extracted: inserted,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
