import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date } = body;

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    // Find the bellringer for this date
    const { data: existing, error: findError } = await supabase
      .from('bellringers')
      .select('id')
      .eq('date', date)
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (findError || !existing) {
      return NextResponse.json({ error: 'No bellringer found for this date' }, { status: 404 });
    }

    // Update is_approved and status
    const { data: bellringer, error: updateError } = await supabase
      .from('bellringers')
      .update({
        is_approved: true,
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ bellringer });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
