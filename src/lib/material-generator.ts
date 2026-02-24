import { getAIConfig, getGeminiModel, generateWithRetry } from './ai-service';

export type MaterialType =
  | 'quiz' | 'vocabulary_test' | 'grammar_test' | 'sentence_dressup'
  | 'worksheet' | 'discussion_questions' | 'writing_prompt' | 'reading_guide'
  | 'jeopardy' | 'dice_game' | 'card_match' | 'relay_race'
  | 'buzzer_quiz' | 'guess_who' | 'four_corners' | 'vocab_bingo'
  | 'flashcard_set' | 'conjugation_drill' | 'dialogue_builder' | 'cultural_activity';

interface MaterialContext {
  class_name: string;
  grade_level: string;
  activity_title: string;
  description?: string;
  material_type: MaterialType;
  teacher_notes?: string;
}

const MATERIAL_SYSTEM_PROMPT = `You are a material generator for a high school English and French teacher at Stratford High School in Stratford, Oklahoma.

Generate classroom materials based on the provided context. Output ONLY valid JSON, no markdown.

For each material type, use this JSON structure:

QUIZ/TEST:
{"title": "...", "instructions": "...", "questions": [{"question": "...", "choices": ["A. ...", "B. ...", "C. ...", "D. ..."], "correct": "A", "explanation": "..."}]}

WORKSHEET:
{"title": "...", "instructions": "...", "sections": [{"heading": "...", "type": "matching|fill_in|short_answer|multiple_choice", "items": [{"prompt": "...", "answer": "..."}]}]}

DISCUSSION QUESTIONS:
{"title": "...", "questions": [{"question": "...", "follow_up": "...", "type": "open|analytical|evaluative"}]}

WRITING PROMPT + RUBRIC:
{"title": "...", "prompt": "...", "requirements": ["..."], "rubric": [{"category": "...", "points": 25, "criteria": "..."}]}

READING GUIDE:
{"title": "...", "before_reading": ["..."], "during_reading": [{"page_or_section": "...", "question": "..."}], "after_reading": ["..."]}

GAME (Jeopardy):
{"title": "...", "setup": "...", "categories": [{"name": "...", "questions": [{"points": 100, "question": "...", "answer": "..."}]}]}

GAME (Dice/Card/Relay/Buzzer/FourCorners/Bingo):
{"title": "...", "setup": "...", "rules": ["..."], "items": [{"prompt": "...", "answer": "..."}]}

SENTENCE DRESSUP:
{"title": "...", "instructions": "...", "sentences": [{"base": "...", "technique": "...", "example": "..."}]}

RULES:
- Keep content appropriate for the grade level
- Make games genuinely fun — students should WANT to play
- For physical games, include clear setup instructions a substitute teacher could follow
- Generate 10-20 items for quizzes/worksheets, 5 categories with 5 questions for Jeopardy
- Always include answer keys`;

const FRENCH_SYSTEM_PROMPT = `You are a French language material generator for a high school French 1 class at Stratford High School in Stratford, Oklahoma. Students are beginners.

Generate materials based on the provided context. Output ONLY valid JSON, no markdown.

FLASHCARD SET:
{"title": "...", "instructions": "...", "cards": [{"front": "...", "back": "...", "pronunciation": "...", "example_sentence": "..."}]}

CONJUGATION DRILL:
{"title": "...", "instructions": "...", "verbs": [{"infinitive": "...", "english": "...", "conjugations": {"je": "...", "tu": "...", "il/elle": "...", "nous": "...", "vous": "...", "ils/elles": "..."}, "example": "..."}], "exercises": [{"prompt": "...", "answer": "..."}]}

DIALOGUE BUILDER:
{"title": "...", "scenario": "...", "vocabulary": [{"french": "...", "english": "..."}], "model_dialogue": [{"speaker": "A|B", "french": "...", "english": "..."}], "practice_prompts": ["..."]}

CULTURAL ACTIVITY:
{"title": "...", "topic": "...", "background": "...", "activities": [{"type": "discussion|comparison|research|creative", "description": "...", "instructions": "..."}], "vocabulary": [{"french": "...", "english": "..."}]}

RULES:
- All French text should include pronunciation guides for beginners
- Keep vocabulary and grammar at French 1 level
- Include English translations for all French content
- Make activities engaging and interactive
- For cultural activities, connect to students' own experiences`;

export async function generateMaterial(context: MaterialContext) {
  const aiConfig = await getAIConfig();
  const model = aiConfig.provider === 'gemini'
    ? getGeminiModel(aiConfig.geminiApiKey, aiConfig.geminiModel)
    : null;

  if (aiConfig.provider === 'gemini' && !model) {
    return { result: null, error: 'Gemini API key not configured. Go to Settings to add your API key.' };
  }
  if (aiConfig.provider === 'anthropic' && !aiConfig.anthropicApiKey) {
    return { result: null, error: 'Anthropic API key not configured. Go to Settings to add your API key.' };
  }

  const isFrench = context.class_name.toLowerCase().includes('french');
  const systemPrompt = isFrench ? FRENCH_SYSTEM_PROMPT : MATERIAL_SYSTEM_PROMPT;

  const userPrompt = `Generate material for:
CLASS: ${context.class_name} (${context.grade_level})
ACTIVITY: ${context.activity_title}
${context.description ? `DESCRIPTION: ${context.description}` : ''}
MATERIAL TYPE: ${context.material_type}
${context.teacher_notes ? `TEACHER NOTES: ${context.teacher_notes}` : ''}

Respond with ONLY valid JSON.`;

  try {
    const result = await generateWithRetry(
      model,
      systemPrompt,
      userPrompt,
      { temperature: 0.8, maxOutputTokens: 4000 }
    );
    return { result, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { result: null, error: `Material generation failed: ${msg}` };
  }
}
