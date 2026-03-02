import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateBellringer } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const { url, date, slot } = await request.json();

    if (!url || !date || slot === undefined) {
      return NextResponse.json(
        { error: 'url, date, and slot are required' },
        { status: 400 }
      );
    }

    // Validate domain — only allow pixabay
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('pixabay.com')) {
      return NextResponse.json(
        { error: 'Only Pixabay image URLs are allowed' },
        { status: 400 }
      );
    }

    // Download the image
    const imageRes = await fetch(url);
    if (!imageRes.ok) {
      return NextResponse.json(
        { error: `Failed to download image (${imageRes.status})` },
        { status: 502 }
      );
    }

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await imageRes.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage — match upload-image route pattern exactly
    const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg';
    const filename = `bellringer_${date}_slot${slot}_${Date.now()}.${ext}`;
    const storagePath = `bellringers/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(storagePath, fileBytes, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData.publicUrl;

    // Upsert bellringer_prompts.image_path
    const { id: bellringerId } = await getOrCreateBellringer(
      date,
      supabase,
      user.id
    );

    const { error: upsertError } = await supabase
      .from('bellringer_prompts')
      .upsert(
        {
          bellringer_id: bellringerId,
          slot,
          image_path: publicUrl,
        },
        { onConflict: 'bellringer_id,slot' }
      );

    if (upsertError) throw upsertError;

    return NextResponse.json({ path: publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
