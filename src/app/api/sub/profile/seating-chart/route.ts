import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: 'image is required' }, { status: 400 });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = imageFile.type || 'image/png';
    const ext = mimeType.split('/')[1] || 'png';
    const filename = `seating_chart_${Date.now()}.${ext}`;
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

    const publicUrl = publicUrlData.publicUrl;

    // Get existing seating chart URLs
    const { data: existing } = await supabase
      .from('classroom_profiles')
      .select('value')
      .eq('key', 'seating_chart_urls')
      .maybeSingle();

    let urls: string[] = [];
    if (existing?.value) {
      try { urls = JSON.parse(existing.value); } catch { urls = []; }
    }
    urls.push(publicUrl);

    await supabase
      .from('classroom_profiles')
      .upsert({ key: 'seating_chart_urls', value: JSON.stringify(urls), user_id: user.id }, { onConflict: 'key,user_id' });

    return NextResponse.json({ url: publicUrl, urls });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    // Get existing seating chart URLs
    const { data: existing } = await supabase
      .from('classroom_profiles')
      .select('value')
      .eq('key', 'seating_chart_urls')
      .maybeSingle();

    let urls: string[] = [];
    if (existing?.value) {
      try { urls = JSON.parse(existing.value); } catch { urls = []; }
    }

    urls = urls.filter(u => u !== url);

    await supabase
      .from('classroom_profiles')
      .upsert({ key: 'seating_chart_urls', value: JSON.stringify(urls), user_id: user.id }, { onConflict: 'key,user_id' });

    // Try to remove from storage
    try {
      const path = url.split('/uploads/')[1];
      if (path) {
        await supabase.storage.from('uploads').remove([path]);
      }
    } catch { /* ignore storage cleanup errors */ }

    return NextResponse.json({ urls });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
