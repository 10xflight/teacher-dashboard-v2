import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { data, error } = await supabase
      .from('classroom_profiles')
      .select('key, value');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const profile: Record<string, string> = {};
    for (const row of data ?? []) {
      profile[row.key] = row.value;
    }

    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

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
        { error: 'No profile data provided' },
        { status: 400 }
      );
    }

    const upsertRows = entries.map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      user_id: user.id,
    }));

    const { error } = await supabase
      .from('classroom_profiles')
      .upsert(upsertRows, { onConflict: 'key,user_id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: updated, error: fetchError } = await supabase
      .from('classroom_profiles')
      .select('key, value');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const profile: Record<string, string> = {};
    for (const row of updated ?? []) {
      profile[row.key] = row.value;
    }

    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
