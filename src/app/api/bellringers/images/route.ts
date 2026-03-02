import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    // List all files in the bellringers folder
    const { data, error } = await supabase.storage
      .from('uploads')
      .list('bellringers', {
        limit: 500,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl('bellringers/placeholder');
    const baseUrl = urlData.publicUrl.replace('placeholder', '');

    const images = (data || [])
      .filter((f) => f.name && /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name))
      .map((f) => ({
        name: f.name,
        url: `${baseUrl}${f.name}`,
        created: f.created_at,
        size: f.metadata?.size || 0,
      }));

    return NextResponse.json({ images });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const storagePath = `bellringers/${name}`;

    const { error } = await supabase.storage
      .from('uploads')
      .remove([storagePath]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
