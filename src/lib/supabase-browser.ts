import { createBrowserClient } from '@supabase/ssr';

/**
 * Create a Supabase client for use in Client Components.
 * Shares the same session cookies as the server client.
 */
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
