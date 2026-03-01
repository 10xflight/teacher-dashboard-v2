import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseServer } from './supabase-server';

// ============================================================
// Provider types
// ============================================================
export type AIProvider = 'gemini' | 'anthropic';

interface AIConfig {
  provider: AIProvider;
  geminiApiKey: string;
  anthropicApiKey: string;
  geminiModel: string;
  anthropicModel: string;
}

// ============================================================
// Settings helpers
// ============================================================

/** Fetch AI config: API keys from env vars, provider/model from authenticated DB. */
export async function getAIConfig(): Promise<AIConfig> {
  // Provider and model preferences come from the DB (non-secret)
  let map: Record<string, string> = {};
  try {
    const supabase = await createSupabaseServer();
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['ai_provider', 'gemini_model', 'anthropic_model']);

    for (const row of data || []) {
      map[row.key] = row.value;
    }
  } catch {
    // If cookies aren't available (e.g. background job), use defaults
  }

  return {
    provider: (map.ai_provider as AIProvider) || 'gemini',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    geminiModel: map.gemini_model || 'gemini-2.5-flash',
    anthropicModel: map.anthropic_model || 'claude-sonnet-4-20250514',
  };
}

// Backwards compat — used by some callers
export async function getApiKey(): Promise<string> {
  const config = await getAIConfig();
  return config.provider === 'anthropic' ? config.anthropicApiKey : config.geminiApiKey;
}

// ============================================================
// Gemini helpers
// ============================================================
export function getGeminiModel(apiKey: string, modelName?: string) {
  if (!apiKey) return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: modelName || 'gemini-2.5-flash' });
}

// ============================================================
// Anthropic helpers
// ============================================================
function getAnthropicClient(apiKey: string): Anthropic | null {
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// ============================================================
// Shared helpers
// ============================================================
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRateLimitDelay(error: unknown): number | null {
  const msg = error instanceof Error ? error.message : String(error);
  if (!msg.includes('429') && !msg.includes('Too Many Requests') && !msg.includes('quota') && !msg.includes('rate_limit')) return null;
  const match = msg.match(/retry in (\d+)/i);
  return match ? (parseInt(match[1]) + 5) * 1000 : 30000;
}

// ============================================================
// JSON cleaning (unchanged — still needed for both providers)
// ============================================================
export function cleanJsonResponse(text: string): Record<string, unknown> {
  text = text.trim();

  if (text.startsWith('```')) {
    const newlineIdx = text.indexOf('\n');
    text = newlineIdx !== -1 ? text.substring(newlineIdx + 1) : text.substring(3);
  }
  if (text.endsWith('```')) {
    text = text.substring(0, text.length - 3);
  }
  if (text.startsWith('json')) {
    text = text.substring(4);
  }
  text = text.trim();

  // Strategy 1: Direct parse
  try { return JSON.parse(text); } catch { /* continue */ }

  // Strategy 2: Find JSON object
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    let fragment = text.substring(start, end + 1);
    try { return JSON.parse(fragment); } catch { /* continue */ }

    // Strategy 3: Fix trailing commas
    let cleaned = fragment.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    try { return JSON.parse(cleaned); } catch { /* continue */ }

    // Strategy 4: Fix unescaped control chars
    const fixed = cleaned.replace(
      /(?<=": ")(.*?)(?="[,\s}])/gs,
      (match) => match.replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '')
    );
    try { return JSON.parse(fixed); } catch { /* continue */ }

    // Strategy 5: Truncate at last complete pair
    const lines = cleaned.split('\n');
    for (let i = lines.length - 1; i > 0; i--) {
      const attempt = lines.slice(0, i).join('\n').trimEnd().replace(/,\s*$/, '') + '\n}';
      try { return JSON.parse(attempt); } catch { continue; }
    }

    // Strategy 6: Regex rebuild — handles string, number, boolean, and null values
    try {
      const obj: Record<string, unknown> = {};
      // Match string values
      const stringPairs = [...cleaned.matchAll(/"(\w+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
      for (const match of stringPairs) {
        obj[match[1]] = match[2].replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
      }
      // Match non-string values (numbers, booleans, null)
      const nonStringPairs = [...cleaned.matchAll(/"(\w+)"\s*:\s*(true|false|null|-?\d+(?:\.\d+)?)\s*[,}\]]/g)];
      for (const match of nonStringPairs) {
        if (!(match[1] in obj)) {
          const val = match[2];
          if (val === 'true') obj[match[1]] = true;
          else if (val === 'false') obj[match[1]] = false;
          else if (val === 'null') obj[match[1]] = null;
          else obj[match[1]] = Number(val);
        }
      }
      if (Object.keys(obj).length > 0) {
        return obj;
      }
    } catch { /* continue */ }
  }

  throw new Error('Could not parse JSON from AI response');
}

// ============================================================
// Provider-agnostic generation
// ============================================================

/**
 * Generate JSON from a system + user prompt, with retry.
 * Works with either Gemini or Anthropic based on the current provider setting.
 */
export async function generateWithRetry(
  modelOrNull: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null,
  systemPrompt: string,
  userPrompt: string,
  config: { temperature: number; maxOutputTokens: number },
  maxRetries = 2
): Promise<Record<string, unknown>> {
  const aiConfig = await getAIConfig();

  if (aiConfig.provider === 'anthropic') {
    return generateWithAnthropic(aiConfig, systemPrompt, userPrompt, config, maxRetries);
  }

  // Gemini path (original)
  const model = modelOrNull || getGeminiModel(aiConfig.geminiApiKey, aiConfig.geminiModel);
  if (!model) throw new Error('No AI model configured. Go to Settings to add your API key.');

  let lastError: Error | null = null;
  let temperature = config.temperature;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { role: 'model', parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature,
          maxOutputTokens: config.maxOutputTokens,
          // Disable thinking for JSON generation — thinking tokens eat into
          // maxOutputTokens and can truncate the actual response
          // @ts-expect-error thinkingConfig not in types yet
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      return cleanJsonResponse(result.response.text());
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const delay = getRateLimitDelay(e);
      if (delay) { await sleep(delay); continue; }
      temperature = Math.max(0.3, temperature - 0.3);
    }
  }
  throw lastError;
}

/**
 * Anthropic-specific JSON generation with retry.
 */
async function generateWithAnthropic(
  aiConfig: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  config: { temperature: number; maxOutputTokens: number },
  maxRetries: number,
): Promise<Record<string, unknown>> {
  const client = getAnthropicClient(aiConfig.anthropicApiKey);
  if (!client) throw new Error('Anthropic API key not configured. Go to Settings to add your API key.');

  let lastError: Error | null = null;
  let temperature = Math.min(config.temperature, 1.0); // Anthropic max temp is 1.0

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const message = await client.messages.create({
        model: aiConfig.anthropicModel,
        max_tokens: config.maxOutputTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

      return cleanJsonResponse(text);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const delay = getRateLimitDelay(e);
      if (delay) { await sleep(delay); continue; }
      temperature = Math.max(0.3, temperature - 0.2);
    }
  }
  throw lastError;
}

/**
 * Provider-agnostic chat (for brainstorm conversations).
 * Returns plain text, not JSON.
 */
export async function chatWithAI(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  config: { temperature: number; maxOutputTokens: number },
): Promise<string> {
  const aiConfig = await getAIConfig();

  if (aiConfig.provider === 'anthropic') {
    const client = getAnthropicClient(aiConfig.anthropicApiKey);
    if (!client) throw new Error('Anthropic API key not configured. Go to Settings to add your API key.');

    const anthropicMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: m.content,
    }));

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const message = await client.messages.create({
          model: aiConfig.anthropicModel,
          max_tokens: config.maxOutputTokens,
          temperature: Math.min(config.temperature, 1.0),
          system: systemPrompt,
          messages: anthropicMessages,
        });

        return message.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('');
      } catch (e) {
        const delay = getRateLimitDelay(e);
        if (delay) { await sleep(delay); continue; }
        throw e;
      }
    }
    throw new Error('Rate limited — please wait a minute and try again.');
  }

  // Gemini path
  const model = getGeminiModel(aiConfig.geminiApiKey, aiConfig.geminiModel);
  if (!model) throw new Error('No AI model configured. Go to Settings to add your API key.');

  const geminiContents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: msg.content }],
  }));

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent({
        contents: geminiContents,
        systemInstruction: { role: 'model' as const, parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens,
        },
      });
      return result.response.text();
    } catch (e) {
      const delay = getRateLimitDelay(e);
      if (delay) { await sleep(delay); continue; }
      throw e;
    }
  }
  throw new Error('Rate limited — please wait a minute and try again.');
}

// ============================================================
// Bellringer-specific helpers (unchanged)
// ============================================================
export function normalizeActFields(result: Record<string, unknown>): Record<string, unknown> {
  if (result.act_choices && !result.act_choice_a) {
    const choicesText = String(result.act_choices);
    const lines = choicesText.split('\n').map(l => l.trim()).filter(Boolean);
    const labels = ['act_choice_a', 'act_choice_b', 'act_choice_c', 'act_choice_d'];
    for (let i = 0; i < labels.length; i++) {
      result[labels[i]] = i < lines.length ? lines[i] : '';
    }
  }
  if (result.act_answer && !result.act_correct_answer) {
    result.act_correct_answer = result.act_answer;
  }
  if (!result.act_explanation) result.act_explanation = '';
  if (!result.act_skill_category) result.act_skill_category = '';

  // Strip quotation marks wrapping words in the rule — they confuse students in a grammar context
  // Handles: "word", 'word', \u201Cword\u201D, \u2018word\u2019 — but keeps apostrophes inside words (it's, don't)
  if (result.act_rule && typeof result.act_rule === 'string') {
    result.act_rule = result.act_rule
      .replace(/["\u201C\u201D]/g, '')
      .replace(/['\u2018\u2019]([^'\u2018\u2019]+)['\u2018\u2019]/g, '$1');
  }

  // Shuffle answer choices so the correct answer isn't always A
  shuffleActChoices(result);

  return result;
}

/** Randomly reorder ACT choices A-D, updating the correct answer letter to match. */
function shuffleActChoices(result: Record<string, unknown>) {
  const keys = ['act_choice_a', 'act_choice_b', 'act_choice_c', 'act_choice_d'] as const;
  const letters = ['A', 'B', 'C', 'D'] as const;

  // Need all 4 choices and a correct answer to shuffle
  const choices = keys.map(k => result[k]);
  if (choices.some(c => !c)) return;
  const correct = String(result.act_correct_answer || '').trim().toUpperCase();
  const correctIdx = letters.indexOf(correct as typeof letters[number]);
  if (correctIdx === -1) return;

  // Strip leading "A. ", "B. " etc. from choice text
  const stripped = choices.map(c => String(c).replace(/^[A-D]\.\s*/, ''));
  const correctText = stripped[correctIdx];

  // Fisher-Yates shuffle
  const indices = [0, 1, 2, 3];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Apply shuffle — re-label with new letter prefixes
  let newCorrectLetter = 'A';
  for (let i = 0; i < 4; i++) {
    const srcIdx = indices[i];
    result[keys[i]] = `${letters[i]}. ${stripped[srcIdx]}`;
    if (srcIdx === correctIdx) {
      newCorrectLetter = letters[i];
    }
  }

  result.act_correct_answer = newCorrectLetter;
  result.act_answer = newCorrectLetter;

  // Also update act_choices if present (combined string)
  result.act_choices = keys.map(k => String(result[k])).join('\n');
}

export async function buildContext() {
  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const supabase = await createSupabaseServer();
  const { data: recent } = await supabase
    .from('bellringers')
    .select('journal_type, journal_prompt, act_skill')
    .order('date', { ascending: false })
    .limit(10);

  const recentActSkills = (recent || []).map(r => r.act_skill).filter(Boolean) as string[];
  const recentJournalTypes = (recent || []).map(r => r.journal_type).filter(Boolean) as string[];

  return {
    today: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    dayOfWeek: dayNames[today.getDay()],
    recentActSkills,
    recentJournalTypes,
  };
}

export function splitEmojis(text: string): { instruction: string; emojis: string } {
  if (!text) return { instruction: '', emojis: '' };
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2702}-\u{27B0}\u{FE00}-\u{FE0F}\u{200D}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+/gu;
  const emojiMatches = text.match(emojiRegex);
  const emojis = emojiMatches ? emojiMatches.join('') : '';
  let instruction = text.replace(emojiRegex, '').trim();
  instruction = instruction.replace(/[\s:,]+$/, '').trim();
  return { instruction, emojis };
}
