import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, url, class_id, tags } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (url !== undefined) updates.url = url;
    if (class_id !== undefined) updates.class_id = class_id || null;
    if (tags !== undefined) updates.tags = tags;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('media_library')
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

    // Fetch item first to check if it's a file
    const { data: item } = await supabase
      .from('media_library')
      .select('*')
      .eq('id', parseInt(id, 10))
      .single();

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Delete from database
    const { error } = await supabase
      .from('media_library')
      .delete()
      .eq('id', parseInt(id, 10));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Clean up storage if it's a file
    if (item.media_type === 'file' && item.file_path) {
      try {
        const path = item.file_path.split('/uploads/')[1];
        if (path) {
          await supabase.storage.from('uploads').remove([path]);
        }
      } catch { /* ignore storage cleanup errors */ }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
