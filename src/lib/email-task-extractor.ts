import { supabase } from './db';
import { generateWithRetry } from './ai-service';
import { stripHtml } from './ms-graph';
import type { ClassInfo } from './types';

// Senders to skip (automated / no-reply)
const SKIP_PATTERNS = [
  /noreply/i,
  /no-reply/i,
  /donotreply/i,
  /do-not-reply/i,
  /mailer-daemon/i,
  /postmaster/i,
  /notifications?@/i,
  /alert@/i,
  /newsletter/i,
];

function shouldSkipSender(email: string): boolean {
  return SKIP_PATTERNS.some(pattern => pattern.test(email));
}

interface EmailInput {
  id: string;
  subject: string;
  from: string;
  receivedDateTime: string;
  bodyContent: string;
  bodyType: string;
}

interface ExtractedTask {
  text: string;
  due_date: string | null;
  class_id: number | null;
  confidence: 'high' | 'medium';
}

/**
 * Extract actionable tasks from a batch of emails using AI,
 * then insert new ones into the email_task_queue table.
 * Returns the number of new queue items created.
 */
export async function extractAndQueueTasks(
  emails: EmailInput[],
  teacherName: string,
  schoolName: string,
  classes: ClassInfo[],
): Promise<number> {
  if (emails.length === 0) return 0;

  // Get existing message IDs to avoid duplicates
  const messageIds = emails.map(e => e.id);
  const { data: existing } = await supabase
    .from('email_task_queue')
    .select('email_message_id')
    .in('email_message_id', messageIds);

  const existingIds = new Set((existing || []).map(e => e.email_message_id));

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const classList = classes.map(c => `${c.id}: ${c.name}`).join(', ');

  let inserted = 0;

  for (const email of emails) {
    // Skip if already processed
    if (existingIds.has(email.id)) continue;

    // Skip automated senders
    if (shouldSkipSender(email.from)) continue;

    // Clean body text
    let bodyText = email.bodyType === 'html'
      ? stripHtml(email.bodyContent)
      : email.bodyContent;

    // Truncate to 2000 chars for AI input
    if (bodyText.length > 2000) {
      bodyText = bodyText.slice(0, 2000) + '...';
    }

    const systemPrompt = `You are a task extraction assistant for a school teacher.
Teacher: ${teacherName}
School: ${schoolName}
Classes: ${classList || 'None configured'}
Today's date: ${todayStr}

Extract actionable tasks from the email below. Only extract items that require the teacher to DO something (deadlines, submissions, meetings, paperwork, etc.). Do NOT extract informational announcements, social messages, or marketing.

Return JSON: { "tasks": [ { "text": "task description", "due_date": "YYYY-MM-DD or null", "class_id": class_number_or_null, "confidence": "high" or "medium" } ] }

Return an empty tasks array if no actionable items are found. Set confidence to "high" for explicit deadlines/requests, "medium" for implied tasks.`;

    const userPrompt = `Subject: ${email.subject}\nFrom: ${email.from}\nDate: ${email.receivedDateTime}\n\n${bodyText}`;

    try {
      const result = await generateWithRetry(
        null,
        systemPrompt,
        userPrompt,
        { temperature: 0.3, maxOutputTokens: 1024 },
        1,
      );

      const tasks = (result.tasks as ExtractedTask[]) || [];

      for (const task of tasks) {
        if (!task.text) continue;

        // Validate class_id
        const validClassId = task.class_id && classes.some(c => c.id === task.class_id)
          ? task.class_id
          : null;

        const { error } = await supabase.from('email_task_queue').insert({
          email_message_id: email.id,
          email_subject: email.subject,
          email_from: email.from,
          email_date: email.receivedDateTime,
          task_text: task.text,
          suggested_due_date: task.due_date || null,
          suggested_class_id: validClassId,
          confidence: task.confidence === 'high' ? 'high' : 'medium',
          status: 'pending',
        });

        if (!error) inserted++;
      }
    } catch (err) {
      console.error(`Failed to extract tasks from email "${email.subject}":`, err);
      // Continue with next email — don't fail the whole batch
    }
  }

  return inserted;
}
