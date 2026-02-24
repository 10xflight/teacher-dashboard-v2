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
export async function getOrCreateBellringer(dateStr: string) {
  const db = getSupabase();
  const { data: existing } = await db
    .from('bellringers')
    .select('id')
    .eq('date', dateStr)
    .order('id', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return { id: existing.id, isNew: false };
  }

  const { data: created, error } = await db
    .from('bellringers')
    .insert({ date: dateStr, status: 'draft', is_approved: false })
    .select('id')
    .single();

  if (error) throw error;
  return { id: created!.id, isNew: true };
}

// Load prompts for a bellringer
export async function loadPrompts(bellringerId: number) {
  const db = getSupabase();
  const { data, error } = await db
    .from('bellringer_prompts')
    .select('*')
    .eq('bellringer_id', bellringerId)
    .order('slot', { ascending: true });

  if (error) throw error;
  return data || [];
}
