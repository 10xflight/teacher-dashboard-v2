'use client';

import type { MaterialType } from './types';
import EditQuiz from './editors/EditQuiz';
import EditWorksheet from './editors/EditWorksheet';
import EditDiscussion from './editors/EditDiscussion';
import EditWritingPrompt from './editors/EditWritingPrompt';
import EditReadingGuide from './editors/EditReadingGuide';
import EditJeopardy from './editors/EditJeopardy';
import EditGame from './editors/EditGame';
import EditSentenceDressup from './editors/EditSentenceDressup';
import EditFlashcards from './editors/EditFlashcards';
import EditConjugationDrill from './editors/EditConjugationDrill';
import EditGeneric from './editors/EditGeneric';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function MaterialEditor({
  material,
  materialType,
  onChange,
}: {
  material: any;
  materialType: MaterialType;
  onChange: (m: any) => void;
}) {
  if (['quiz', 'vocabulary_test', 'grammar_test'].includes(materialType) && material.questions) {
    return <EditQuiz material={material} onChange={onChange} />;
  }
  if (materialType === 'sentence_dressup') return <EditSentenceDressup material={material} onChange={onChange} />;
  if (materialType === 'worksheet') return <EditWorksheet material={material} onChange={onChange} />;
  if (materialType === 'discussion_questions') return <EditDiscussion material={material} onChange={onChange} />;
  if (materialType === 'writing_prompt') return <EditWritingPrompt material={material} onChange={onChange} />;
  if (materialType === 'reading_guide') return <EditReadingGuide material={material} onChange={onChange} />;
  if (materialType === 'jeopardy') return <EditJeopardy material={material} onChange={onChange} />;
  if (materialType === 'flashcard_set') return <EditFlashcards material={material} onChange={onChange} />;
  if (materialType === 'conjugation_drill') return <EditConjugationDrill material={material} onChange={onChange} />;
  if (['dice_game', 'card_match', 'relay_race', 'buzzer_quiz', 'guess_who', 'four_corners', 'vocab_bingo'].includes(materialType)) {
    return <EditGame material={material} onChange={onChange} />;
  }
  return <EditGeneric material={material} onChange={onChange} />;
}
