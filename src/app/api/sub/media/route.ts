import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('media_library')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const name = formData.get('name') as string || file?.name || 'Untitled';
      const classId = formData.get('class_id') as string | null;
      const tagsStr = formData.get('tags') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = file.type || 'application/octet-stream';
      const ext = file.name.split('.').pop() || 'bin';
      const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storagePath = `sub-media/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(storagePath);

      const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

      const { data, error } = await supabase
        .from('media_library')
        .insert({
          name,
          file_path: publicUrlData.publicUrl,
          media_type: 'file',
          class_id: classId ? parseInt(classId, 10) : null,
          tags,
        })
        .select('*')
        .single();

      if (error) throw error;

      return NextResponse.json(data, { status: 201 });
    } else {
      // JSON body for link/video
      const body = await request.json();
      const { name, url, media_type, class_id, tags } = body;

      if (!name || !url) {
        return NextResponse.json({ error: 'name and url are required' }, { status: 400 });
      }

      if (!['link', 'video'].includes(media_type)) {
        return NextResponse.json({ error: 'media_type must be link or video' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('media_library')
        .insert({
          name,
          url,
          media_type,
          class_id: class_id || null,
          tags: tags || [],
        })
        .select('*')
        .single();

      if (error) throw error;

      return NextResponse.json(data, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
