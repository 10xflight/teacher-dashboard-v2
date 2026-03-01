import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { buildAuthUrl } from '@/lib/ms-graph';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const clientId = process.env.MS_CLIENT_ID;
    const tenantId = process.env.MS_TENANT_ID;

    if (!clientId || !tenantId) {
      return NextResponse.json(
        { error: 'Azure credentials not configured. Set MS_CLIENT_ID and MS_TENANT_ID in .env.local.' },
        { status: 400 },
      );
    }

    // Build redirect URI from the current request origin
    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/email/callback`;

    const authUrl = buildAuthUrl(tenantId, clientId, redirectUri);

    return NextResponse.redirect(authUrl);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
