import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || url === 'your-supabase-url') {
      throw new Error('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// Backward compat — lazy getter
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Helper to get or create a bellringer for a date
export async function getOrCreateBellringer(dateStr: string, db?: SupabaseClient, userId?: string) {
  const client = db || getSupabase();
  const { data: existing } = await client
    .from('bellringers')
    .select('id')
    .eq('date', dateStr)
    .order('id', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return { id: existing.id, isNew: false };
  }

  const insertData: Record<string, unknown> = { date: dateStr, status: 'draft', is_approved: false };
  if (userId) insertData.user_id = userId;

  const { data: created, error } = await client
    .from('bellringers')
    .insert(insertData)
    .select('id')
    .single();

  if (error) throw error;
  return { id: created!.id, isNew: true };
}

// Load prompts for a bellringer
export async function loadPrompts(bellringerId: number, db?: SupabaseClient) {
  const client = db || getSupabase();
  const { data, error } = await client
    .from('bellringer_prompts')
    .select('*')
    .eq('bellringer_id', bellringerId)
    .order('slot', { ascending: true });

  if (error) throw error;
  return data || [];
}
