import type { MaterialType } from '@/components/materials/types';

const QUIZ_PROMPT = `Generate a comprehensive quiz with the following structure:
- Mix of Bloom's Taxonomy levels: remember, understand, apply, analyze, evaluate
- Include varied question formats: multiple choice, true/false, and short answer where appropriate
- Include a word_bank array of key terms if relevant
- Add point values per question (e.g. MC=2pts, short answer=5pts)
- Include detailed teaching explanations for each answer (not just "correct because...")
- 10-15 questions total
- Order from easier to harder (scaffolded difficulty)

IMPORTANT: Do NOT include numbers in question text. The UI adds numbering automatically.

JSON must include: title, instructions, word_bank (optional array of strings), questions (each with: question, choices, correct, explanation, points)`;

const VOCABULARY_TEST_PROMPT = `Generate a thorough vocabulary test:
- Include matching section, fill-in-the-blank section, and usage section
- Add a word_bank array with all tested vocabulary
- Each section should have clear instructions
- Include context clues and example sentences
- Test both recognition and production
- 15-20 items across sections

IMPORTANT: Do NOT include numbers in item prompt text. The UI adds numbering automatically.

JSON must include: title, instructions, word_bank (array of strings), sections (each with: heading, type, items with prompt/answer)`;

const GRAMMAR_TEST_PROMPT = `Generate a grammar test:
- Mix identification, correction, and application questions
- Include example sentences that demonstrate the grammar concept
- Scaffold from recognition to production
- Include an explanation of the rule being tested
- 12-15 questions

IMPORTANT: Do NOT include numbers in question text. The UI adds numbering automatically.

JSON must include: title, instructions, questions (each with: question, choices, correct, explanation)`;

const SENTENCE_DRESSUP_PROMPT = `Generate a sentence dressup activity:
- Provide plain base sentences that students will enhance
- Each sentence targets a specific writing technique (e.g. strong verb, adjective, simile, opener, etc.)
- Include a clear example of the technique applied
- Order techniques from simpler to more complex
- 8-12 sentences

JSON must include: title, instructions, sentences (each with: base, technique, example)`;

const WORKSHEET_PROMPT = `Generate a comprehensive worksheet with multiple VARIED sections:
- You MUST include at least 3 DIFFERENT section types. Do NOT make every section matching.
- Choose from: matching, fill_in, short_answer, multiple_choice, true_false, ordering
- Good combinations: "matching + fill_in + short_answer", "multiple_choice + fill_in + short_answer + ordering"
- For matching: two columns to match (prompt = left side, answer = right side)
- For fill_in: sentences with __________ blanks (prompt = sentence with blank, answer = correct word)
- For short_answer: questions requiring 1-2 sentence responses
- For multiple_choice: questions with A-D answer choices in the prompt, correct letter in answer
- For true_false: statements to evaluate (prompt = statement, answer = True/False with explanation)
- For ordering: items to put in correct sequence
- Add a word_bank array if relevant
- Include an extension section for early finishers
- Each section should have a clear heading and type-appropriate instructions
- Scaffold difficulty within and across sections
- 15-25 total items across all sections

IMPORTANT: Do NOT include numbers in item prompt text. The UI adds numbering automatically.

JSON must include: title, instructions, word_bank (optional array), sections (each with: heading, type, items with prompt/answer), extension (optional string)`;

const DISCUSSION_PROMPT = `Generate thought-provoking discussion questions:
- Mix of Bloom's levels: 2-3 recall, 3-4 analysis, 2-3 evaluation, 1-2 creative
- Include think-pair-share format suggestions where appropriate
- Add estimated time for discussion per question
- Include follow-up probes for deeper thinking
- End with a debate question that has no clear right answer
- 8-12 questions

IMPORTANT: Do NOT include numbers in question text. The UI adds numbering automatically.

JSON must include: title, questions (each with: question, follow_up, type (recall/analysis/evaluation/creative/debate), estimated_time (optional))`;

const WRITING_PROMPT_PROMPT = `Generate a writing prompt with rubric:
- Place the main prompt in a clear, inspiring format
- Include 4-6 specific requirements
- Add pre-writing brainstorming suggestions
- Include word count expectation
- Create a 4-category rubric with clear score levels (each category worth 25 points)
- Categories should cover: Content/Ideas, Organization, Style/Voice, Conventions

JSON must include: title, prompt, requirements (array of strings), pre_writing (array of brainstorm suggestions), word_count (string like "300-500 words"), rubric (array with: category, points, criteria)`;

const READING_GUIDE_PROMPT = `Generate a reading guide with three clear sections:
- BEFORE READING: 3-4 prior knowledge activation questions, vocabulary preview
- DURING READING: 6-10 questions tied to specific pages/sections (bold page refs), mix of comprehension and analysis, identify literary devices
- AFTER READING: 3-5 synthesis/creative response questions
- Include vocabulary array with key terms and definitions
- Add answer blanks (blank lines) between questions

JSON must include: title, vocabulary (optional array of {word, definition}), before_reading (array of strings), during_reading (array of {page_or_section, question}), after_reading (array of strings)`;

const JEOPARDY_PROMPT = `Generate a Jeopardy game:
- EXACTLY 5 categories with 5 questions each (100, 200, 300, 400, 500 points)
- Questions should be phrased as answers (Jeopardy-style) where possible
- Include a Daily Double in one category
- Include a Final Jeopardy question
- Setup instructions for the teacher
- Categories should cover different aspects of the topic

JSON must include: title, setup, categories (array of {name, questions: [{points, question, answer}]}), final_jeopardy ({question/clue, answer})`;

const GAME_PROMPT = `Generate a classroom game:
- Include a detailed materials_needed list
- Time estimate for the activity
- Recommended team sizes
- Clear step-by-step rules a substitute could follow
- Differentiation suggestions
- Printable game cards/items with prompts and answers
- 15-25 game items

JSON must include: title, setup, materials_needed (array), time_estimate (string), team_size (string), rules (array of strings), items (array of {prompt, answer}), differentiation (optional string)`;

const FLASHCARD_PROMPT = `Generate a flashcard set for French 1:
- Include IPA pronunciation guide for each term
- Add cultural context notes where relevant
- Highlight cognates (words similar to English)
- Flag common mistakes/false friends
- Include example sentences using each term
- 15-25 cards organized by theme

JSON must include: title, instructions, cards (array of {front, back, pronunciation, example_sentence})`;

const CONJUGATION_DRILL_PROMPT = `Generate a conjugation drill for French 1:
- Include 4-6 verbs appropriate for the level
- Full conjugation table for each (je, tu, il/elle, nous, vous, ils/elles)
- Example sentence for each verb
- Include pronunciation notes
- Practice exercises at the end (8-12 fill-in-the-blank)
- Include common mistakes to avoid

JSON must include: title, instructions, verbs (array of {infinitive, english, conjugations: {je, tu, il/elle, nous, vous, ils/elles}, example}), exercises (array of {prompt, answer})`;

const DIALOGUE_BUILDER_PROMPT = `Generate a dialogue builder activity for French 1:
- Set a realistic, fun scenario (café, school, shopping, etc.)
- Include key vocabulary with pronunciation
- Provide a model dialogue with translations
- Include practice prompts for students to create their own variations
- Cultural notes about conversation customs

JSON must include: title, scenario, vocabulary (array of {french, english}), model_dialogue (array of {speaker: "A"|"B", french, english}), practice_prompts (array of strings)`;

const CULTURAL_ACTIVITY_PROMPT = `Generate a French cultural activity:
- Include engaging background information
- Mix of activity types: discussion, comparison (to students' culture), research, creative
- Connect to students' own experiences
- Include relevant vocabulary
- Make it interactive and hands-on

JSON must include: title, topic, background, activities (array of {type, description, instructions}), vocabulary (array of {french, english})`;

const PROMPT_MAP: Record<string, string> = {
  quiz: QUIZ_PROMPT,
  vocabulary_test: VOCABULARY_TEST_PROMPT,
  grammar_test: GRAMMAR_TEST_PROMPT,
  sentence_dressup: SENTENCE_DRESSUP_PROMPT,
  worksheet: WORKSHEET_PROMPT,
  discussion_questions: DISCUSSION_PROMPT,
  writing_prompt: WRITING_PROMPT_PROMPT,
  reading_guide: READING_GUIDE_PROMPT,
  jeopardy: JEOPARDY_PROMPT,
  dice_game: GAME_PROMPT,
  card_match: GAME_PROMPT,
  relay_race: GAME_PROMPT,
  buzzer_quiz: GAME_PROMPT,
  guess_who: GAME_PROMPT,
  four_corners: GAME_PROMPT,
  vocab_bingo: GAME_PROMPT,
  flashcard_set: FLASHCARD_PROMPT,
  conjugation_drill: CONJUGATION_DRILL_PROMPT,
  dialogue_builder: DIALOGUE_BUILDER_PROMPT,
  cultural_activity: CULTURAL_ACTIVITY_PROMPT,
};

export function getPromptForType(materialType: MaterialType | string, isFrench: boolean): string {
  return PROMPT_MAP[materialType] || (isFrench ? FLASHCARD_PROMPT : WORKSHEET_PROMPT);
}
