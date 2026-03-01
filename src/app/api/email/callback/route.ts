import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { exchangeCodeForTokens, getUserProfile, storeTokens } from '@/lib/ms-graph';

export async function GET(request: NextRequest) {
  // Auth check: the user should have a valid session even though Microsoft redirects here.
  // If not authenticated, redirect to login (the OAuth flow requires a logged-in user).
  const auth = await requireAuth();
  if (auth instanceof NextResponse) {
    // Instead of returning a JSON 401, redirect to settings with an error
    return NextResponse.redirect(
      new URL('/settings?email=error&msg=Not+authenticated.+Please+log+in+and+try+again.', request.nextUrl.origin),
    );
  }
  try {
    const code = request.nextUrl.searchParams.get('code');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      const desc = request.nextUrl.searchParams.get('error_description') || error;
      return NextResponse.redirect(
        new URL(`/settings?email=error&msg=${encodeURIComponent(desc)}`, request.nextUrl.origin),
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?email=error&msg=No+authorization+code+received', request.nextUrl.origin),
      );
    }

    // Read Azure credentials from env vars
    const clientId = process.env.MS_CLIENT_ID;
    const clientSecret = process.env.MS_CLIENT_SECRET;
    const tenantId = process.env.MS_TENANT_ID;

    if (!clientId || !clientSecret || !tenantId) {
      return NextResponse.redirect(
        new URL('/settings?email=error&msg=Azure+credentials+not+set+in+.env.local', request.nextUrl.origin),
      );
    }

    const redirectUri = `${request.nextUrl.origin}/api/email/callback`;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(tenantId, clientId, clientSecret, code, redirectUri);

    // Get user profile to store email address
    const profile = await getUserProfile(tokens.access_token);

    // Store everything
    await storeTokens(
      tokens.access_token,
      tokens.refresh_token,
      tokens.expires_in,
      profile.mail,
    );

    return NextResponse.redirect(
      new URL('/settings?email=connected', request.nextUrl.origin),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/settings?email=error&msg=${encodeURIComponent(msg)}`, request.nextUrl.origin),
    );
  }
}
