import { Resend } from 'resend';
import { supabase } from '@/lib/db';

interface EmailResult {
  success: boolean;
  message: string;
  id?: string;
}

/**
 * Send a notification email to the principal when a lesson plan is published.
 */
export async function sendPrincipalNotification(
  publishUrl: string,
  weekOf: string,
  teacherName: string,
  principalEmail: string
): Promise<EmailResult> {
  // Try env var first, then settings table
  let apiKey = process.env.RESEND_API_KEY || '';

  if (!apiKey) {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'resend_api_key')
        .single();
      if (data?.value) {
        apiKey = data.value;
      }
    } catch {
      // Settings lookup failed, continue without key
    }
  }

  if (!apiKey) {
    return {
      success: false,
      message: 'Email not sent: No Resend API key configured. Set RESEND_API_KEY env var or resend_api_key in settings.',
    };
  }

  const resend = new Resend(apiKey);

  // Format the week display nicely
  const weekDisplay = formatWeekOf(weekOf);
  const subject = `Lesson Plan Published - Week of ${weekDisplay}`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Teacher Dashboard <onboarding@resend.dev>',
      to: principalEmail,
      subject,
      html: buildEmailHtml(publishUrl, weekOf, teacherName, weekDisplay),
    });

    if (error) {
      return {
        success: false,
        message: `Email failed: ${error.message}`,
      };
    }

    return {
      success: true,
      message: `Email sent to ${principalEmail}`,
      id: data?.id,
    };
  } catch (err) {
    return {
      success: false,
      message: `Email failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Format a week_of string (e.g. "2026-02-23") into a short display like "Feb 23".
 */
function formatWeekOf(weekOf: string): string {
  try {
    const d = new Date(weekOf + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return weekOf;
  }
}

/**
 * Build the HTML body for the principal notification email.
 */
function buildEmailHtml(
  publishUrl: string,
  weekOf: string,
  teacherName: string,
  weekDisplay: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <tr>
      <td style="background:#1a1a2e;padding:28px 32px;">
        <h1 style="margin:0;color:#4ECDC4;font-size:20px;font-weight:700;">Lesson Plan Published</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 16px;color:#333;font-size:16px;line-height:1.6;">
          <strong>${teacherName}</strong> has published their lesson plan for the
          <strong>week of ${weekDisplay}</strong>.
        </p>
        <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
          You can review the plan, view activities for each day, and leave comments
          using the link below.
        </p>
        <a href="${publishUrl}"
           style="display:inline-block;background:#4ECDC4;color:#1a1a2e;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          View Lesson Plan
        </a>
        <p style="margin:24px 0 0;color:#999;font-size:12px;line-height:1.5;">
          Week: ${weekOf}<br>
          This link does not require a login.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
