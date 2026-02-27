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

PART 2 - ACT PREP: Generate ONE ACT English-style grammar question. IMPORTANT: The ACT question must be COMPLETELY INDEPENDENT of any teacher theme/notes. It is purely a grammar/mechanics skill question.

SKILL AREAS (pick one, vary each time): commas (introductory phrases, appositives, compound sentences, restrictive/nonrestrictive), apostrophes (possessives vs plurals, its/it's), semicolons & colons, subject-verb agreement (each/neither/compound subjects), pronoun errors (ambiguous reference, who/whom, case), verb tense consistency, parallelism, dangling/misplaced modifiers, wordiness/redundancy, fragments/run-ons/comma splices, word choice (affect/effect, than/then, less/fewer, lie/lay).

ACT QUESTION RULES:
- Write a realistic, natural-sounding sentence (like from an article about science, history, daily life) with ONE error
- Wrap the tested part in <b> tags
- Each answer choice must be the FULL COMPLETE SENTENCE with the bolded part replaced — so the student reads each option as a whole sentence
- "No change" should show the original sentence exactly as written (with the error, no bold tags) — only correct if the original has no error
- Vary which letter (A/B/C/D) is correct — NOT always A
- Rule = one short, student-friendly sentence
- SELF-CHECK: Read each choice as a standalone sentence. Is exactly one grammatically perfect?

ACT EXAMPLE: {"act_skill": "Commas with Introductory Phrases", "act_question": "After finishing the experiment <b>the students</b> recorded their observations.", "act_choices": "A. After finishing the experiment, the students recorded their observations.\\nB. After finishing the experiment: the students recorded their observations.\\nC. After finishing the experiment the students, recorded their observations.\\nD. After finishing the experiment the students recorded their observations.", "act_answer": "A", "act_rule": "Use a comma after an introductory phrase or clause."}

JSON format:
{
    "prompts": [
        {"journal_type": "creative", "journal_prompt": "...", "journal_subprompt": "WRITE A PARAGRAPH IN YOUR JOURNAL!"},
        {"journal_type": "quote", "journal_prompt": "...", "journal_subprompt": "WRITE A PARAGRAPH IN YOUR JOURNAL!"},
        {"journal_type": "emoji", "journal_prompt": "...", "journal_subprompt": "WRITE A PARAGRAPH IN YOUR JOURNAL!"},
        {"journal_type": "reflective", "journal_prompt": "...", "journal_subprompt": "WRITE A PARAGRAPH IN YOUR JOURNAL!"}
    ],
    "act_skill": "Skill Name",
    "act_question": "Realistic sentence with <b>tested part</b> bolded.",
    "act_choices": "A. Full sentence option 1.\\nB. Full sentence option 2.\\nC. Full sentence option 3.\\nD. Full sentence (no change).",
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

const ACT_SYSTEM_PROMPT = `You generate ONE ACT English test-style question for 9th/10th graders. These must look and feel like REAL ACT English questions — a short passage-style sentence with a grammar/mechanics error that students must identify and fix.

SKILL CATEGORIES (pick one, vary each time):
1. COMMAS: introductory phrases, compound sentences, appositives, items in a series, coordinate adjectives, restrictive vs nonrestrictive clauses
2. APOSTROPHES: possessives vs plurals, its/it's, whose/who's, their/they're/there
3. SEMICOLONS & COLONS: joining independent clauses, before lists, semicolons vs commas
4. SUBJECT-VERB AGREEMENT: compound subjects, indefinite pronouns (everyone/each/neither), inverted sentences, collective nouns
5. PRONOUN ERRORS: ambiguous reference, pronoun-antecedent agreement, who/whom, case errors (me vs I)
6. VERB TENSE: consistency, past perfect vs simple past, conditional mood
7. PARALLELISM: items in a list, paired constructions (not only...but also)
8. MODIFIERS: dangling modifiers, misplaced modifiers, adjective vs adverb
9. WORDINESS & REDUNDANCY: eliminating unnecessary words, concise alternatives
10. SENTENCE STRUCTURE: fragments, run-ons, comma splices, subordination vs coordination
11. WORD CHOICE: affect/effect, than/then, accept/except, less/fewer, lie/lay

FORMAT: Write a realistic, natural-sounding sentence with ONE error. Wrap the tested part in <b> tags. Each answer choice must be the FULL SENTENCE with the bolded part replaced — so the student can read each option as a complete sentence and judge which sounds correct.

CRITICAL RULES:
- The sentence must sound like it belongs in a real article or essay — not a contrived grammar exercise
- Each choice is the COMPLETE sentence with the replacement applied (not just the changed fragment)
- "No change" should show the original sentence exactly as written (with no bold tags)
- Exactly ONE choice must be correct and produce a grammatically perfect sentence
- The correct answer should NOT always be A — vary which letter is correct (A, B, C, or D)
- The rule must be a SHORT, memorable, student-friendly explanation (one sentence)
- NEVER put quotation marks around individual words in the choices

SELF-CHECK — DO THIS BEFORE OUTPUTTING:
1. Read each answer choice as a standalone sentence. Is the correct one grammatically perfect? Are the wrong ones clearly wrong?
2. Make sure "No change" reproduces the original (with the error) — it should only be correct if the original has no error.
3. Verify exactly ONE choice is correct.

EXAMPLE 1 (Commas):
{"act_skill": "Commas with Introductory Phrases", "act_question": "After finishing the experiment <b>the students</b> recorded their observations in the lab notebook.", "act_choices": "A. After finishing the experiment, the students recorded their observations in the lab notebook.\\nB. After finishing the experiment: the students recorded their observations in the lab notebook.\\nC. After finishing the experiment the students, recorded their observations in the lab notebook.\\nD. After finishing the experiment the students recorded their observations in the lab notebook.", "act_answer": "A", "act_rule": "Use a comma after an introductory phrase or clause."}

EXAMPLE 2 (Apostrophes):
{"act_skill": "Apostrophes — Possessives", "act_question": "The <b>companies</b> new policy required all employees to complete safety training within their first week.", "act_choices": "A. The company's new policy required all employees to complete safety training within their first week.\\nB. The companies' new policy required all employees to complete safety training within their first week.\\nC. The companys new policy required all employees to complete safety training within their first week.\\nD. The companies new policy required all employees to complete safety training within their first week.", "act_answer": "A", "act_rule": "Use an apostrophe + s to show singular possession."}

EXAMPLE 3 (Parallelism):
{"act_skill": "Parallel Structure", "act_question": "The coach told the team to stay focused, work together, and <b>they should keep a positive attitude.</b>", "act_choices": "A. The coach told the team to stay focused, work together, and keeping a positive attitude.\\nB. The coach told the team to stay focused, work together, and maintain a positive attitude.\\nC. The coach told the team to stay focused, work together, and a positive attitude should be kept.\\nD. The coach told the team to stay focused, work together, and they should keep a positive attitude.", "act_answer": "B", "act_rule": "Items in a series must follow the same grammatical pattern."}

EXAMPLE 4 (Subject-Verb Agreement):
{"act_skill": "Subject-Verb Agreement", "act_question": "Each of the paintings in the gallery <b>were</b> created by a local artist during the summer festival.", "act_choices": "A. Each of the paintings in the gallery was created by a local artist during the summer festival.\\nB. Each of the paintings in the gallery have been created by a local artist during the summer festival.\\nC. Each of the paintings in the gallery are created by a local artist during the summer festival.\\nD. Each of the paintings in the gallery were created by a local artist during the summer festival.", "act_answer": "A", "act_rule": "\\\"Each\\\" is always singular and takes a singular verb."}

Generate ONE question in valid JSON. Do NOT wrap in markdown. Vary the skill from the examples above.`;

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

export async function generateActQuestion(notes = '', skill = '') {
  const { model, error } = await getModelIfGemini();
  if (error) return { result: null, error };

  const context = await buildContext();

  let userPrompt = `Generate ONE short grammar/vocabulary question.`;
  if (skill) {
    userPrompt += `\nSkill: ${skill} (generate a question specifically testing this skill)`;
  } else {
    userPrompt += `\nAvoid: ${context.recentActSkills.slice(0, 5).join(', ') || 'None'}`;
  }
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
