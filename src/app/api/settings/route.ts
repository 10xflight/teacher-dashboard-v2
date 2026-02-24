import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert rows into a key-value object
    const settings: Record<string, string> = {};
    for (const row of data ?? []) {
      settings[row.key] = row.value;
    }

    return NextResponse.json(settings);
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

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Body must be a key-value object' },
        { status: 400 }
      );
    }

    const entries = Object.entries(body);
    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'No settings provided' },
        { status: 400 }
      );
    }

    // Upsert each setting
    const upsertRows = entries.map(([key, value]) => ({
      key,
      value: String(value),
    }));

    const { error } = await supabase
      .from('settings')
      .upsert(upsertRows, { onConflict: 'key' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return the updated settings
    const { data: updated, error: fetchError } = await supabase
      .from('settings')
      .select('key, value');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const settings: Record<string, string> = {};
    for (const row of updated ?? []) {
      settings[row.key] = row.value;
    }

    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
