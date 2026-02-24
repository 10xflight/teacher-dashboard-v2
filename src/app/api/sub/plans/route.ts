import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { generateSubDashSnapshot } from '@/lib/subdash-generator';
import { randomUUID } from 'crypto';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('subdash_plans')
      .select('id, date, share_token, custom_notes, sub_name, sub_contact, status, mode, created_at, updated_at')
      .order('created_at', { ascending: false });

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
    const body = await request.json();
    const {
      date,
      custom_notes = null,
      sub_name = null,
      sub_contact = null,
      mode = 'planned',
      media_ids = [],
    } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Valid date (YYYY-MM-DD) is required' }, { status: 400 });
    }

    const origin = request.headers.get('origin') || new URL(request.url).origin;

    const { data: snapshot, error: genError } = await generateSubDashSnapshot(
      date,
      custom_notes,
      media_ids,
      origin
    );

    if (genError || !snapshot) {
      return NextResponse.json({ error: genError || 'Failed to generate snapshot' }, { status: 500 });
    }

    // Set sub info on snapshot
    snapshot.sub_name = sub_name;
    snapshot.sub_contact = sub_contact;

    const shareToken = randomUUID();
    const status = mode === 'emergency' ? 'shared' : 'draft';

    const { data: plan, error: insertError } = await supabase
      .from('subdash_plans')
      .insert({
        date,
        share_token: shareToken,
        custom_notes,
        sub_name,
        sub_contact,
        status,
        mode,
        snapshot,
      })
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Insert junction rows for media
    if (media_ids.length > 0) {
      const junctionRows = media_ids.map((mediaId: number) => ({
        subdash_plan_id: plan.id,
        media_library_id: mediaId,
      }));

      await supabase.from('subdash_media').insert(junctionRows);
    }

    const shareUrl = `${origin}/subdash/${shareToken}`;

    return NextResponse.json({ ...plan, share_url: shareUrl }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
