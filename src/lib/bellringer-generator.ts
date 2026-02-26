import { getAIConfig, getGeminiModel, generateWithRetry, normalizeActFields, buildContext, cleanJsonResponse } from './ai-service';
import Anthropic from '@anthropic-ai/sdk';

// ============================================================
// SYSTEM PROMPTS — Ported verbatim from services/ai_service.py
// These were iterated heavily. Do not re-derive them.
// ============================================================

const SYSTEM_PROMPT = `You generate bellringer content for 9th/10th grade English. TWO parts:

PART 1 - JOURNAL PROMPTS: Generate 4 SHORT prompts, each a DIFFERENT type. Keep them brief - 1-2 sentences max. Examples of good length:
- "Two strangers are stuck in an elevator. What happens next?"
- "If you could have dinner with anyone in history, who and why?"
- "'The only way out is through.' - Robert Frost. What does this mean to you?"
- (for emoji type) "Tell a story using these emojis:" followed by 4-6 emojis

PART 2 - ACT PREP: Generate ONE short grammar/mechanics/vocabulary question. IMPORTANT: The ACT question must be COMPLETELY INDEPENDENT of any teacher theme/notes — it is purely a grammar/mechanics skill question. Focus on:
- Comma rules, apostrophes, semicolons, colons
- Subject-verb agreement, pronoun agreement
- Vocabulary in context
- Sentence fragments / run-ons

FORMAT: Write ONE sentence with an error. Wrap the part being tested in <b> tags. The four answer choices are REPLACEMENT OPTIONS for the bolded part. One choice fixes the error. One choice is "No change."

EXAMPLE:
Sentence: Neither the students nor the teacher <b>were</b> ready for the pop quiz.
A. was
B. are
C. has been
D. No change
Answer: A
Rule: With neither/nor, the verb agrees with the nearest subject.

RULES:
- Question is ONE sentence with <b>bolded</b> tested part
- Choices are SHORT replacement options for the bold part (not full phrases)
- Always include "No change" as one choice
- Make sure the correct answer is actually correct
- Rule = one short memorable sentence
- NEVER put quotes around words

JSON format:
{
    "prompts": [
        {"journal_type": "creative", "journal_prompt": "...", "journal_subprompt": "WRITE A PARAGRAPH IN YOUR JOURNAL!"},
        {"journal_type": "quote", "journal_prompt": "...", "journal_subprompt": "WRITE A PARAGRAPH IN YOUR JOURNAL!"},
        {"journal_type": "emoji", "journal_prompt": "...", "journal_subprompt": "WRITE A PARAGRAPH IN YOUR JOURNAL!"},
        {"journal_type": "reflective", "journal_prompt": "...", "journal_subprompt": "WRITE A PARAGRAPH IN YOUR JOURNAL!"}
    ],
    "act_skill": "Comma Rules",
    "act_question": "The sentence with <b>tested part</b> bolded.",
    "act_choices": "A. replacement1\\nB. replacement2\\nC. replacement3\\nD. No change",
    "act_answer": "A",
    "act_rule": "Short rule here."
}`;

const SINGLE_PROMPT_SYSTEM = `You generate ONE journal prompt for 9th/10th grade English. Keep it SHORT - 1-2 sentences max.

Types:
- creative: Fun scenario ("Two strangers are stuck in an elevator...")
- quote: Real quote + "What does this mean to you?"
- emoji: "Tell a story using these emojis:" then 4-6 emojis (ONLY emojis after the colon, no descriptions)
- reflective: Personal question ("Who deserves a thank you letter from you?")
- critical_thinking: Thought-provoking ("Is it ever okay to lie?")
- descriptive: Describe something ("Describe the color Red to someone who has never seen it")
- poetry: Write a poem about...
- list: "List your top 5..."
- debate: Two-sided question
- would_you_rather: Two choices + explain why
- image: Very short - "Write a story about this image" or "What does this picture mean to you?"

For emoji type: Give a SHORT lead-in (max 8 words like "Tell a story using these emojis:") then the emojis. Nothing else.
For image type: One short instruction, no description of the image.

JSON format:
{"journal_type": "creative", "journal_prompt": "The prompt text", "journal_subprompt": "WRITE A PARAGRAPH IN YOUR JOURNAL!"}`;

const IMAGE_PROMPT_SYSTEM = `You generate a journal prompt for 9th/10th grade English based on an image. Be VERY brief - do NOT describe the image. Just give a short writing instruction.

Good examples:
- "Write a story inspired by this image."
- "What does this picture mean to you?"
- "What happened right before this moment?"
- "Give this image a title and explain why."

BAD (too long): "In this image we see a sunset over mountains with clouds. Write about a time you felt peaceful watching nature..."
GOOD (short): "What would you title this photo? Why?"

JSON format:
{"journal_type": "image", "journal_prompt": "Short prompt here", "journal_subprompt": "WRITE A PARAGRAPH IN YOUR JOURNAL!"}`;

const ACT_SYSTEM_PROMPT = `You generate ONE short ACT-style grammar/mechanics/vocabulary question for 9th/10th grade English.

Focus areas (pick one):
- Comma rules, apostrophes, semicolons, colons
- Subject-verb agreement, pronoun agreement
- Vocabulary in context
- Sentence fragments / run-ons

FORMAT: Write ONE sentence with an error. Wrap the part being tested in <b> tags. The four answer choices are REPLACEMENT OPTIONS for the bolded part. One choice fixes the error. One choice is "No change."

EXAMPLE:
Sentence: Neither the students nor the teacher <b>were</b> ready for the pop quiz.
A. was
B. are
C. has been
D. No change
Answer: A
Rule: With neither/nor, the verb agrees with the nearest subject.

RULES:
- Question is ONE sentence with <b>bolded</b> tested part
- Choices are SHORT replacement options for the bold part (not full phrases from the sentence)
- Always include "No change" as one choice
- Make sure the correct answer is actually correct
- Rule = one short memorable sentence
- NEVER put quotes around words

JSON format:
{"act_skill": "Subject-Verb Agreement", "act_question": "The sentence with <b>tested part</b> bolded.", "act_choices": "A. replacement1\\nB. replacement2\\nC. replacement3\\nD. No change", "act_answer": "A", "act_rule": "Short rule here."}`;

// ============================================================
// Helper to get model or null (for provider routing)
// ============================================================
async function getModelIfGemini() {
  const config = await getAIConfig();
  if (config.provider === 'gemini') {
    const model = getGeminiModel(config.geminiApiKey, config.geminiModel);
    if (!model) return { model: null, config, error: 'API key not configured. Go to Settings to add your API key.' };
    return { model, config, error: null };
  }
  // Anthropic — model is null, generateWithRetry handles it
  if (!config.anthropicApiKey) {
    return { model: null, config, error: 'Anthropic API key not configured. Go to Settings to add your API key.' };
  }
  return { model: null, config, error: null };
}

// ============================================================
// Generation functions
// ============================================================

export async function generateFullBellringer(teacherNotes = '') {
  const { model, error } = await getModelIfGemini();
  if (error) return { result: null, error };

  const context = await buildContext();

  let userPrompt = `Generate a bellringer for ${context.dayOfWeek}.
Avoid these recent ACT skills: ${context.recentActSkills.slice(0, 5).join(', ') || 'None'}
Vary from these recent journal types: ${context.recentJournalTypes.slice(0, 5).join(', ') || 'None'}`;

  if (teacherNotes) {
    userPrompt += `\nTeacher idea/theme: ${teacherNotes}`;
  }
  userPrompt += '\nKeep prompts SHORT. Respond with ONLY valid JSON.';

  try {
    const result = await generateWithRetry(
      model,
      SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.9, maxOutputTokens: 2000 }
    );

    const prompts = result.prompts as Array<Record<string, string>> | undefined;
    if (prompts && prompts.length > 0) {
      const first = prompts[0];
      result.journal_type = first.journal_type;
      result.journal_prompt = first.journal_prompt;
      result.journal_subprompt = first.journal_subprompt || 'WRITE A PARAGRAPH IN YOUR JOURNAL!';
    }

    normalizeActFields(result);
    return { result, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Could not parse')) {
      return { result: null, error: `Failed to parse AI response: ${msg}` };
    }
    return { result: null, error: `AI error: ${msg}` };
  }
}

export async function generateSinglePrompt(promptType?: string, notes = '') {
  const { model, error } = await getModelIfGemini();
  if (error) return { result: null, error };

  let userPrompt = 'Generate ONE short journal prompt.';
  if (promptType) userPrompt += ` Type: ${promptType}`;
  if (notes) userPrompt += `\nTeacher idea: ${notes}`;
  userPrompt += '\nKeep it SHORT - 1-2 sentences. Respond with ONLY valid JSON.';

  try {
    const result = await generateWithRetry(
      model,
      SINGLE_PROMPT_SYSTEM,
      userPrompt,
      { temperature: 0.9, maxOutputTokens: 500 }
    );
    return { result, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { result: null, error: `Failed to generate prompt: ${msg}` };
  }
}

export async function generateFromImage(imageBase64: string, mimeType: string, notes = '') {
  const aiConfig = await getAIConfig();

  if (aiConfig.provider === 'anthropic') {
    // Anthropic vision
    const client = new Anthropic({ apiKey: aiConfig.anthropicApiKey });
    if (!aiConfig.anthropicApiKey) {
      return { result: null, error: 'Anthropic API key not configured. Go to Settings to add your API key.' };
    }

    let userPrompt = 'Write a SHORT journal prompt for this image. Do NOT describe the image. Just a brief writing instruction.';
    if (notes) userPrompt += `\nTeacher idea: ${notes}`;
    userPrompt += '\nRespond with ONLY valid JSON.';

    try {
      const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      const message = await client.messages.create({
        model: aiConfig.anthropicModel,
        max_tokens: 300,
        temperature: 0.9,
        system: IMAGE_PROMPT_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: userPrompt },
          ],
        }],
      });

      const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
      const result = cleanJsonResponse(text);
      result.journal_type = 'image';
      return { result, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { result: null, error: `Image prompt generation error: ${msg}` };
    }
  }

  // Gemini path
  const model = getGeminiModel(aiConfig.geminiApiKey, aiConfig.geminiModel);
  if (!model) {
    return { result: null, error: 'Gemini API key not configured. Go to Settings to add your API key.' };
  }

  let userPrompt = 'Write a SHORT journal prompt for this image. Do NOT describe the image. Just a brief writing instruction.';
  if (notes) userPrompt += `\nTeacher idea: ${notes}`;
  userPrompt += '\nRespond with ONLY valid JSON.';

  try {
    const genResult = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: IMAGE_PROMPT_SYSTEM + '\n\n' + userPrompt },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 300 },
    });

    const result = cleanJsonResponse(genResult.response.text());
    result.journal_type = 'image';
    return { result, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { result: null, error: `Image prompt generation error: ${msg}` };
  }
}

export async function generateActQuestion(notes = '') {
  const { model, error } = await getModelIfGemini();
  if (error) return { result: null, error };

  const context = await buildContext();

  let userPrompt = `Generate ONE short grammar/vocabulary question.\nAvoid: ${context.recentActSkills.slice(0, 5).join(', ') || 'None'}`;
  if (notes) userPrompt += `\nTeacher idea: ${notes}`;
  userPrompt += '\nKeep it SHORT. Respond with ONLY valid JSON, no markdown.';

  try {
    const result = await generateWithRetry(
      model,
      ACT_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.9, maxOutputTokens: 800 }
    );
    normalizeActFields(result);
    return { result, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { result: null, error: `Failed to generate ACT question: ${msg}` };
  }
}

export { IMAGE_PROMPT_SYSTEM };
