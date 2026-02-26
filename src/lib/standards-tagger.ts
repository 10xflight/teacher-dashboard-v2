import { getAIConfig, getGeminiModel, generateWithRetry } from './ai-service';
import { supabase } from './db';

interface TaggableActivity {
  title: string;
  description: string | null;
  class_name: string;
}

function classToSubject(className: string): string {
  const lower = className.toLowerCase();
  if (lower.includes('french')) return 'French';
  return 'English';
}

function classToGradeBand(className: string): string | null {
  const lower = className.toLowerCase();
  if (lower.includes('french')) return '1';
  if (lower.includes('english-1') || lower.includes('english 1') || lower.includes('eng 1')) return '9';
  if (lower.includes('english-2') || lower.includes('english 2') || lower.includes('eng 2')) return '10';
  const match = className.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    if (num <= 2) return num === 1 ? '9' : '10';
    return String(num);
  }
  return null;
}

const SYSTEM_PROMPT = `You are an Oklahoma academic standards tagger. Given an activity and a list of available standards, pick the 1-3 most relevant standard codes.

Rules:
- Pick 1-3 codes that BEST match the activity
- ONLY return codes from the provided list
- Keep reasoning to one short sentence

Respond with ONLY valid JSON. Example:
{"codes": ["9.3.R.1"], "reasoning": "Matches literary analysis"}`;

export async function tagActivityWithStandards(
  activity: TaggableActivity
): Promise<{ codes: string[]; reasoning: string; error: string | null }> {
  const aiConfig = await getAIConfig();
  const model = aiConfig.provider === 'gemini'
    ? getGeminiModel(aiConfig.geminiApiKey, aiConfig.geminiModel)
    : null;

  if (aiConfig.provider === 'gemini' && !model) {
    return { codes: [], reasoning: '', error: 'Gemini API key not configured. Go to Settings to add your API key.' };
  }
  if (aiConfig.provider === 'anthropic' && !aiConfig.anthropicApiKey) {
    return { codes: [], reasoning: '', error: 'Anthropic API key not configured. Go to Settings to add your API key.' };
  }

  const subject = classToSubject(activity.class_name);
  const gradeBand = classToGradeBand(activity.class_name);

  let query = supabase
    .from('standards')
    .select('code, description, strand')
    .eq('subject', subject);

  if (gradeBand) {
    query = query.eq('grade_band', gradeBand);
  }

  const { data: standards, error: dbError } = await query.order('code', { ascending: true });

  if (dbError) {
    return { codes: [], reasoning: '', error: `Failed to load standards: ${dbError.message}` };
  }

  if (!standards || standards.length === 0) {
    return { codes: [], reasoning: '', error: `No standards found for subject "${subject}" grade band "${gradeBand}". Run /api/standards/seed first.` };
  }

  const standardsList = standards
    .map((s) => `${s.code} [${s.strand || 'General'}]: ${s.description}`)
    .join('\n');

  const userPrompt = `ACTIVITY:
Title: ${activity.title}
Description: ${activity.description || '(no description)'}
Class: ${activity.class_name}

AVAILABLE STANDARDS (${subject} - Grade ${gradeBand}):
${standardsList}

Select the 1-3 most relevant standard codes. Respond with ONLY valid JSON.`;

  try {
    const result = await generateWithRetry(
      model,
      SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.3, maxOutputTokens: 1024 }
    );

    const codes = (result.codes as string[]) || [];
    const reasoning = (result.reasoning as string) || '';

    const validCodes = new Set(standards.map((s) => s.code));
    const filteredCodes = codes.filter((c) => validCodes.has(c));

    if (filteredCodes.length === 0 && codes.length > 0) {
      return {
        codes: [],
        reasoning,
        error: `AI returned codes that don't match any known standards: ${codes.join(', ')}`,
      };
    }

    return { codes: filteredCodes, reasoning, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { codes: [], reasoning: '', error: `Standards tagging failed: ${msg}` };
  }
}
