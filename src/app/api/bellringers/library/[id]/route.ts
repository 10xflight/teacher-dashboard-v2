import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const promptId = parseInt(id, 10);

    if (isNaN(promptId)) {
      return NextResponse.json({ error: 'Invalid prompt id' }, { status: 400 });
    }

    const body = await request.json();
    const { journal_type, journal_prompt, journal_subprompt } = body;

    const updateData: Record<string, unknown> = {};
    if (journal_type !== undefined) updateData.journal_type = journal_type;
    if (journal_prompt !== undefined) updateData.journal_prompt = journal_prompt;
    if (journal_subprompt !== undefined) updateData.journal_subprompt = journal_subprompt;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: prompt, error } = await supabase
      .from('bellringer_prompts')
      .update(updateData)
      .eq('id', promptId)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ prompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const promptId = parseInt(id, 10);

    if (isNaN(promptId)) {
      return NextResponse.json({ error: 'Invalid prompt id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('bellringer_prompts')
      .delete()
      .eq('id', promptId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
