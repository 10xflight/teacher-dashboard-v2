import { NextResponse } from 'next/server';
import { createSupabaseServer } from './supabase-server';

/**
 * Get the authenticated user from the current request.
 * Returns the user object or null if not authenticated.
 *
 * Also returns a Supabase client that has the user's session attached,
 * so all queries will be scoped by RLS policies.
 */
export async function getAuthUser() {
  const supabase = await createSupabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, supabase };
  }

  return { user, supabase };
}

/**
 * Require authentication for an API route.
 * Returns the user and a scoped Supabase client, or a 401 response.
 *
 * Usage in a route handler:
 * ```ts
 * export async function GET() {
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth;
 *   const { user, supabase } = auth;
 *   // ... use supabase for queries (RLS will filter by user_id)
 * }
 * ```
 */
export async function requireAuth(): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof getAuthUser>>['user']>; supabase: Awaited<ReturnType<typeof getAuthUser>>['supabase'] }
  | NextResponse
> {
  const { user, supabase } = await getAuthUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please log in.' },
      { status: 401 }
    );
  }

  return { user, supabase };
}
