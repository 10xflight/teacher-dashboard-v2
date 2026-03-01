import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  try {
    const { id } = await params;
    const queueId = parseInt(id);
    const body = await request.json().catch(() => ({}));

    // Fetch the queue item
    const { data: item, error: fetchError } = await supabase
      .from('email_task_queue')
      .select('*')
      .eq('id', queueId)
      .single();

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    if (item.status !== 'pending') {
      return NextResponse.json({ error: 'Item already processed' }, { status: 400 });
    }

    // Allow overriding task text, due date, and class before approval
    const taskText = body.task_text || item.task_text;
    const dueDate = body.due_date !== undefined ? body.due_date : item.suggested_due_date;
    const classId = body.class_id !== undefined ? body.class_id : item.suggested_class_id;

    // Create the real task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        text: taskText,
        due_date: dueDate || null,
        class_id: classId || null,
        is_done: false,
        user_id: user.id,
      })
      .select()
      .single();

    if (taskError) {
      return NextResponse.json({ error: taskError.message }, { status: 500 });
    }

    // Mark queue item as approved
    const { error: updateError } = await supabase
      .from('email_task_queue')
      .update({
        status: 'approved',
        created_task_id: task.id,
        task_text: taskText,
        suggested_due_date: dueDate || null,
        suggested_class_id: classId || null,
      })
      .eq('id', queueId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ task, queue_item_id: queueId }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
