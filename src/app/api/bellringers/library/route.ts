import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    // Select bellringer_prompts joined with bellringers for date/status
    const { data, error } = await supabase
      .from('bellringer_prompts')
      .select(`
        *,
        bellringers!inner (
          date,
          status,
          is_approved
        )
      `)
      .order('id', { ascending: false });

    if (error) throw error;

    // Flatten the join for convenience
    const prompts = (data || []).map((row) => {
      const bellringer = row.bellringers as { date: string; status: string; is_approved: boolean };
      return {
        id: row.id,
        bellringer_id: row.bellringer_id,
        slot: row.slot,
        journal_type: row.journal_type,
        journal_prompt: row.journal_prompt,
        journal_subprompt: row.journal_subprompt,
        image_path: row.image_path,
        date: bellringer?.date || null,
        status: bellringer?.status || null,
        is_approved: bellringer?.is_approved || false,
      };
    });

    return NextResponse.json({ prompts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
