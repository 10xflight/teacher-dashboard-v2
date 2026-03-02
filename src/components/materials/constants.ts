import type { MaterialCategory } from './types';

export const ASSESSMENTS: MaterialCategory = {
  label: 'Assessments',
  types: [
    { key: 'quiz', label: 'Quiz' },
    { key: 'vocabulary_test', label: 'Vocabulary Test' },
    { key: 'grammar_test', label: 'Grammar Test' },
    { key: 'sentence_dressup', label: 'Sentence Dressup' },
  ],
};

export const WORKSHEETS: MaterialCategory = {
  label: 'Worksheets',
  types: [
    { key: 'worksheet', label: 'Worksheet' },
    { key: 'discussion_questions', label: 'Discussion Qs' },
    { key: 'writing_prompt', label: 'Writing Prompt' },
    { key: 'reading_guide', label: 'Reading Guide' },
  ],
};

export const GAMES: MaterialCategory = {
  label: 'Games',
  types: [
    { key: 'jeopardy', label: 'Jeopardy' },
    { key: 'dice_game', label: 'Dice Game' },
    { key: 'card_match', label: 'Card Match' },
    { key: 'relay_race', label: 'Relay Race' },
    { key: 'buzzer_quiz', label: 'Buzzer Quiz' },
    { key: 'guess_who', label: 'Guess Who' },
    { key: 'four_corners', label: 'Four Corners' },
    { key: 'vocab_bingo', label: 'Vocab Bingo' },
  ],
};

export const FRENCH: MaterialCategory = {
  label: 'French',
  types: [
    { key: 'flashcard_set', label: 'Flashcard Set' },
    { key: 'conjugation_drill', label: 'Conjugation Drill' },
    { key: 'dialogue_builder', label: 'Dialogue Builder' },
    { key: 'cultural_activity', label: 'Cultural Activity' },
  ],
};

export const inputCls = 'w-full px-2 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-xs focus:border-accent focus:outline-none';
export const textareaCls = 'w-full px-2 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-xs focus:border-accent focus:outline-none resize-none';
