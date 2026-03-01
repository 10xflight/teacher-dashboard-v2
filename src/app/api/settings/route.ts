import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

// Keys that must never be stored in the DB or returned to the client
const SECRET_KEYS = new Set([
  'gemini_api_key',
  'anthropic_api_key',
  'ms_client_id',
  'ms_client_secret',
  'ms_tenant_id',
  'resend_api_key',
]);

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const { data, error } = await supabase
      .from('settings')
      .select('key, value');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settings: Record<string, string> = {};
    for (const row of data ?? []) {
      // Never send secret keys to the client
      if (!SECRET_KEYS.has(row.key)) {
        settings[row.key] = row.value;
      }
    }

    // Append env-var status indicators (configured or not, no actual values)
    settings._env_gemini = process.env.GEMINI_API_KEY ? 'configured' : '';
    settings._env_anthropic = process.env.ANTHROPIC_API_KEY ? 'configured' : '';
    settings._env_ms_client_id = process.env.MS_CLIENT_ID ? 'configured' : '';
    settings._env_ms_client_secret = process.env.MS_CLIENT_SECRET ? 'configured' : '';
    settings._env_ms_tenant_id = process.env.MS_TENANT_ID ? 'configured' : '';
    settings._env_resend = process.env.RESEND_API_KEY ? 'configured' : '';

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

    // Filter out secret keys — they must not be saved to the DB
    const entries = Object.entries(body).filter(([key]) => !SECRET_KEYS.has(key));
    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'No settings provided' },
        { status: 400 }
      );
    }

    const upsertRows = entries.map(([key, value]) => ({
      key,
      value: String(value),
      user_id: user.id,
    }));

    const { error } = await supabase
      .from('settings')
      .upsert(upsertRows, { onConflict: 'key,user_id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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
