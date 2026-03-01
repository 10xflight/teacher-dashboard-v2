import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { clearTokens } from '@/lib/ms-graph';

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  try {
    await clearTokens();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
