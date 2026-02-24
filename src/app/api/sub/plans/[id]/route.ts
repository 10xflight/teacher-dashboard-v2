import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('subdash_plans')
      .select('*')
      .eq('id', parseInt(id, 10))
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { custom_notes, sub_name, sub_contact, status } = body;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (custom_notes !== undefined) updates.custom_notes = custom_notes;
    if (sub_name !== undefined) updates.sub_name = sub_name;
    if (sub_contact !== undefined) updates.sub_contact = sub_contact;
    if (status !== undefined) updates.status = status;

    // If sharing, also update snapshot sub info
    if (status === 'shared' || sub_name !== undefined || sub_contact !== undefined) {
      const { data: existing } = await supabase
        .from('subdash_plans')
        .select('snapshot')
        .eq('id', parseInt(id, 10))
        .single();

      if (existing?.snapshot) {
        const snapshot = { ...existing.snapshot };
        if (sub_name !== undefined) snapshot.sub_name = sub_name;
        if (sub_contact !== undefined) snapshot.sub_contact = sub_contact;
        if (custom_notes !== undefined) snapshot.custom_notes = custom_notes;
        updates.snapshot = snapshot;
      }
    }

    const { data, error } = await supabase
      .from('subdash_plans')
      .update(updates)
      .eq('id', parseInt(id, 10))
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabase
      .from('subdash_plans')
      .delete()
      .eq('id', parseInt(id, 10));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
