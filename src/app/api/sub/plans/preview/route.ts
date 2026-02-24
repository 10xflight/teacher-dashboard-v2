import { NextRequest, NextResponse } from 'next/server';
import { generateSubDashSnapshot } from '@/lib/subdash-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, custom_notes = null, media_ids = [] } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Valid date (YYYY-MM-DD) is required' }, { status: 400 });
    }

    const origin = request.headers.get('origin') || new URL(request.url).origin;

    const { data: snapshot, error } = await generateSubDashSnapshot(
      date,
      custom_notes,
      media_ids,
      origin
    );

    if (error || !snapshot) {
      return NextResponse.json({ error: error || 'Failed to generate preview' }, { status: 500 });
    }

    return NextResponse.json(snapshot);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
