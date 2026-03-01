import { createSupabaseServer } from './supabase-server';

// ============================================================
// Settings helpers
// ============================================================

/**
 * Read MS-related settings.
 * Client credentials come from env vars; runtime tokens come from the authenticated DB.
 */
export async function getMSSettings(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  // Credentials from env vars (never stored in DB)
  if (process.env.MS_CLIENT_ID) map.ms_client_id = process.env.MS_CLIENT_ID;
  if (process.env.MS_CLIENT_SECRET) map.ms_client_secret = process.env.MS_CLIENT_SECRET;
  if (process.env.MS_TENANT_ID) map.ms_tenant_id = process.env.MS_TENANT_ID;

  // Runtime tokens from authenticated DB
  try {
    const supabase = await createSupabaseServer();
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .like('key', 'ms_%');

    for (const row of data || []) {
      // Don't overwrite env-sourced credentials with (empty) DB values
      if (!map[row.key]) {
        map[row.key] = row.value;
      }
    }
  } catch {
    // If cookies aren't available, return what we have from env
  }

  return map;
}

/** Upsert one or more MS settings (tokens only — credentials live in env). */
async function saveMSSettings(settings: Record<string, string>) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value,
    ...(userId ? { user_id: userId } : {}),
  }));
  await supabase.from('settings').upsert(rows, { onConflict: 'key,user_id' });
}

// ============================================================
// OAuth helpers
// ============================================================

const SCOPES = 'offline_access Mail.Read User.Read';

/** Build the Microsoft OAuth authorization URL. */
export function buildAuthUrl(tenantId: string, clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_mode: 'query',
    prompt: 'consent',
  });
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
}

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeCodeForTokens(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: SCOPES,
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  return res.json();
}

/** Refresh the access token using the stored refresh token. */
async function refreshAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES,
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  return res.json();
}

// ============================================================
// Token management
// ============================================================

/**
 * Get a valid access token, refreshing if expired.
 * Returns null if not connected.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const settings = await getMSSettings();

  if (!settings.ms_refresh_token || !settings.ms_client_id || !settings.ms_tenant_id) {
    return null;
  }

  const expiresAt = parseInt(settings.ms_token_expires_at || '0');
  const now = Math.floor(Date.now() / 1000);

  // If token is still valid (with 5 min buffer), return it
  if (settings.ms_access_token && expiresAt > now + 300) {
    return settings.ms_access_token;
  }

  // Refresh the token
  const result = await refreshAccessToken(
    settings.ms_tenant_id,
    settings.ms_client_id,
    settings.ms_client_secret || '',
    settings.ms_refresh_token,
  );

  const newExpiry = String(now + result.expires_in);

  await saveMSSettings({
    ms_access_token: result.access_token,
    ms_refresh_token: result.refresh_token,
    ms_token_expires_at: newExpiry,
  });

  return result.access_token;
}

/**
 * Store tokens after initial OAuth exchange.
 */
export async function storeTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  userEmail: string,
) {
  const expiresAt = String(Math.floor(Date.now() / 1000) + expiresIn);
  await saveMSSettings({
    ms_access_token: accessToken,
    ms_refresh_token: refreshToken,
    ms_token_expires_at: expiresAt,
    ms_user_email: userEmail,
    ms_email_enabled: 'true',
  });
}

/**
 * Clear all MS tokens and settings (disconnect).
 */
export async function clearTokens() {
  const keysToDelete = [
    'ms_access_token',
    'ms_refresh_token',
    'ms_token_expires_at',
    'ms_user_email',
    'ms_email_enabled',
    'ms_last_fetch',
  ];

  const supabase = await createSupabaseServer();
  await supabase
    .from('settings')
    .delete()
    .in('key', keysToDelete);
}

// ============================================================
// Graph API calls
// ============================================================

interface GraphEmail {
  id: string;
  subject: string;
  from: { emailAddress: { address: string; name: string } };
  receivedDateTime: string;
  body: { content: string; contentType: string };
  isRead: boolean;
}

/** Fetch recent emails since a given ISO date string. */
export async function fetchRecentEmails(accessToken: string, since?: string): Promise<GraphEmail[]> {
  let url = 'https://graph.microsoft.com/v1.0/me/messages?$top=25&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,body,isRead';

  if (since) {
    url += `&$filter=receivedDateTime ge ${since}`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.value || [];
}

/** Get the connected user's email address. */
export async function getUserProfile(accessToken: string): Promise<{ mail: string; displayName: string }> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,displayName,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get user profile: ${res.status}`);
  }

  const data = await res.json();
  return {
    mail: data.mail || data.userPrincipalName || '',
    displayName: data.displayName || '',
  };
}

// ============================================================
// HTML stripping
// ============================================================

/** Strip HTML tags and decode entities for AI processing. */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Update the last fetch timestamp. */
export async function updateLastFetch() {
  await saveMSSettings({
    ms_last_fetch: new Date().toISOString(),
  });
}
