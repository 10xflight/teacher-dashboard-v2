export type MaterialType =
  | 'quiz' | 'vocabulary_test' | 'grammar_test' | 'sentence_dressup'
  | 'worksheet' | 'discussion_questions' | 'writing_prompt' | 'reading_guide'
  | 'jeopardy' | 'dice_game' | 'card_match' | 'relay_race'
  | 'buzzer_quiz' | 'guess_who' | 'four_corners' | 'vocab_bingo'
  | 'flashcard_set' | 'conjugation_drill' | 'dialogue_builder' | 'cultural_activity';

export interface MaterialCategory {
  label: string;
  types: { key: MaterialType; label: string }[];
}

export interface ActivityForPanel {
  id: number;
  title: string;
  description: string | null;
  class_id: number;
  date?: string;
  material_status?: string;
  material_content?: Record<string, unknown> | null;
  classes: { name: string } | null;
}

export interface MaterialGeneratorPanelProps {
  activity: ActivityForPanel;
  onClose: () => void;
  onSaved: () => void;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
