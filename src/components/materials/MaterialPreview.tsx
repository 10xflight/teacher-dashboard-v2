'use client';

import type { MaterialType } from './types';
import QuizPreview from './previews/QuizPreview';
import WorksheetPreview from './previews/WorksheetPreview';
import DiscussionPreview from './previews/DiscussionPreview';
import WritingPromptPreview from './previews/WritingPromptPreview';
import ReadingGuidePreview from './previews/ReadingGuidePreview';
import JeopardyPreview from './previews/JeopardyPreview';
import GamePreview from './previews/GamePreview';
import SentenceDressupPreview from './previews/SentenceDressupPreview';
import FlashcardsPreview from './previews/FlashcardsPreview';
import ConjugationDrillPreview from './previews/ConjugationDrillPreview';
import DialogueBuilderPreview from './previews/DialogueBuilderPreview';
import CulturalActivityPreview from './previews/CulturalActivityPreview';
import GenericPreview from './previews/GenericPreview';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function MaterialPreview({
  material,
  materialType,
  onUpdate,
}: {
  material: any;
  materialType: MaterialType;
  onUpdate?: (m: any) => void;
}) {
  if (['quiz', 'vocabulary_test', 'grammar_test'].includes(materialType) && material.questions) {
    return <QuizPreview material={material} onUpdate={onUpdate} />;
  }
  if (materialType === 'sentence_dressup' && material.sentences) {
    return <SentenceDressupPreview material={material} onUpdate={onUpdate} />;
  }
  if (materialType === 'worksheet' && material.sections) {
    return <WorksheetPreview material={material} onUpdate={onUpdate} />;
  }
  if (materialType === 'discussion_questions' && material.questions) {
    return <DiscussionPreview material={material} onUpdate={onUpdate} />;
  }
  if (materialType === 'writing_prompt' && material.prompt) {
    return <WritingPromptPreview material={material} onUpdate={onUpdate} />;
  }
  if (materialType === 'reading_guide') {
    return <ReadingGuidePreview material={material} onUpdate={onUpdate} />;
  }
  if (materialType === 'jeopardy' && material.categories) {
    return <JeopardyPreview material={material} onUpdate={onUpdate} />;
  }
  if (['dice_game', 'card_match', 'relay_race', 'buzzer_quiz', 'guess_who', 'four_corners', 'vocab_bingo'].includes(materialType)) {
    return <GamePreview material={material} onUpdate={onUpdate} />;
  }
  if (materialType === 'flashcard_set' && material.cards) {
    return <FlashcardsPreview material={material} onUpdate={onUpdate} />;
  }
  if (materialType === 'conjugation_drill' && material.verbs) {
    return <ConjugationDrillPreview material={material} onUpdate={onUpdate} />;
  }
  if (materialType === 'dialogue_builder') {
    return <DialogueBuilderPreview material={material} onUpdate={onUpdate} />;
  }
  if (materialType === 'cultural_activity') {
    return <CulturalActivityPreview material={material} onUpdate={onUpdate} />;
  }
  return <GenericPreview material={material} />;
}
