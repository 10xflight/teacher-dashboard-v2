import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const { data, error } = await supabase
      .from('subdash_plans')
      .select('snapshot')
      .eq('share_token', token)
      .eq('status', 'shared')
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'SubDash not found or not shared' },
        { status: 404 }
      );
    }

    return NextResponse.json(data.snapshot);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
