import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAIConfig, getGeminiModel, generateWithRetry } from '@/lib/ai-service';

const PARSE_SYSTEM_PROMPT = `You are a standards parser. Given freeform text containing academic standards (pasted from a document, PDF, or spreadsheet), extract each standard into structured data.

Rules:
- Extract the standard code/identifier (e.g., "9.3.R.1", "FL.1.C.2")
- Extract the full description text
- Identify the strand/category if present (e.g., "Reading", "Writing", "Communication")
- If codes aren't clearly formatted, infer a reasonable code pattern
- Skip headers, section labels, and non-standard text
- Return ALL standards found in the text

Respond with ONLY valid JSON:
{"standards": [{"code": "9.3.R.1", "description": "Full description text", "strand": "Reading"}]}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, subject, grade_band } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    if (!subject?.trim()) {
      return NextResponse.json({ error: 'subject is required' }, { status: 400 });
    }
    if (!grade_band?.trim()) {
      return NextResponse.json({ error: 'grade_band is required' }, { status: 400 });
    }

    const aiConfig = await getAIConfig();
    const model = aiConfig.provider === 'gemini'
      ? getGeminiModel(aiConfig.geminiApiKey, aiConfig.geminiModel)
      : null;

    const userPrompt = `Parse the following text and extract all academic standards. The subject is "${subject}" and the grade band is "${grade_band}".

TEXT:
${text.trim()}

Extract every standard into structured JSON. Respond with ONLY valid JSON.`;

    const result = await generateWithRetry(
      model,
      PARSE_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.2, maxOutputTokens: 4000 }
    );

    const parsed = (result.standards as { code: string; description: string; strand?: string }[]) || [];

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No standards could be parsed from the text' }, { status: 400 });
    }

    // Fetch existing codes to determine insert vs update
    const codes = parsed.map(s => s.code);
    const { data: existing } = await supabase
      .from('standards')
      .select('code')
      .in('code', codes);

    const existingCodes = new Set((existing || []).map(r => r.code));

    const toInsert = parsed
      .filter(s => !existingCodes.has(s.code))
      .map(s => ({
        code: s.code,
        description: s.description,
        strand: s.strand || null,
        subject: subject.trim(),
        grade_band: grade_band.trim(),
      }));

    const toUpdate = parsed.filter(s => existingCodes.has(s.code));

    let insertedCount = 0;
    let updatedCount = 0;

    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from('standards')
        .insert(toInsert)
        .select('id');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      insertedCount = data?.length ?? toInsert.length;
    }

    for (const s of toUpdate) {
      const { error } = await supabase
        .from('standards')
        .update({
          description: s.description,
          strand: s.strand || null,
          subject: subject.trim(),
          grade_band: grade_band.trim(),
        })
        .eq('code', s.code);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      parsed: parsed.length,
      inserted: insertedCount,
      updated: updatedCount,
      standards: parsed,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
