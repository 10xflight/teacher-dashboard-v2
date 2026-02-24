import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import standardsData from '@/data/oklahoma-standards.json';

// Map JSON subject keys to (subject, grade_band) for the standards table
const SUBJECT_MAP: Record<string, { subject: string; grade_band: string }> = {
  'English 9': { subject: 'English', grade_band: '9' },
  'English 10': { subject: 'English', grade_band: '10' },
  'French 1 (World Languages - Novice)': { subject: 'French', grade_band: '1' },
};

interface RawStandard {
  id: string;
  standard: number;
  category: string;
  description: string;
  goal?: string;
}

export async function POST() {
  try {
    const allRows: {
      subject: string;
      grade_band: string;
      code: string;
      description: string;
      strand: string | null;
    }[] = [];

    for (const [key, standards] of Object.entries(
      standardsData as Record<string, RawStandard[]>
    )) {
      const mapping = SUBJECT_MAP[key];
      if (!mapping) continue;

      for (const s of standards) {
        allRows.push({
          subject: mapping.subject,
          grade_band: mapping.grade_band,
          code: s.id,
          description: s.description,
          strand: s.category || null,
        });
      }
    }

    if (allRows.length === 0) {
      return NextResponse.json({ error: 'No standards found in data file' }, { status: 400 });
    }

    // Fetch existing standard codes to avoid duplicates
    const { data: existing, error: fetchError } = await supabase
      .from('standards')
      .select('code');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const existingCodes = new Set((existing ?? []).map((r) => r.code));

    // Split into rows to insert (new) vs rows to update (existing)
    const toInsert = allRows.filter((r) => !existingCodes.has(r.code));
    const toUpdate = allRows.filter((r) => existingCodes.has(r.code));

    let insertedCount = 0;
    let updatedCount = 0;
    const BATCH_SIZE = 100;

    // Insert new standards in batches
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);

      const { data, error } = await supabase
        .from('standards')
        .insert(batch)
        .select('id');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      insertedCount += data?.length ?? batch.length;
    }

    // Update existing standards (description/strand may have changed)
    for (const row of toUpdate) {
      const { error } = await supabase
        .from('standards')
        .update({
          subject: row.subject,
          grade_band: row.grade_band,
          description: row.description,
          strand: row.strand,
        })
        .eq('code', row.code);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      count: insertedCount + updatedCount,
      inserted: insertedCount,
      updated: updatedCount,
      subjects: Object.keys(SUBJECT_MAP),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
