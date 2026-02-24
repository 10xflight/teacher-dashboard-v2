// Database entity types

export interface CalendarEvent {
  id: number;
  date: string;
  event_type: string;
  title: string;
  notes: string | null;
  created_at: string;
}

export interface Task {
  id: number;
  text: string;
  due_date: string | null;
  is_done: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface ClassInfo {
  id: number;
  name: string;
  periods: string | null;
  color: string | null;
}

export interface Activity {
  id: number;
  class_id: number;
  lesson_plan_id: number | null;
  date: string | null;
  title: string;
  description: string | null;
  activity_type: string;
  sort_order: number;
  material_status: string;
  material_content: Record<string, unknown> | null;
  material_file_path: string | null;
  is_done: boolean;
  is_graded: boolean;
  moved_to_date: string | null;
  created_at: string;
}

export interface Bellringer {
  id: number;
  date: string;
  journal_type: string | null;
  journal_prompt: string | null;
  journal_subprompt: string | null;
  journal_image_path: string | null;
  act_skill_category: string | null;
  act_skill: string | null;
  act_question: string | null;
  act_choice_a: string | null;
  act_choice_b: string | null;
  act_choice_c: string | null;
  act_choice_d: string | null;
  act_correct_answer: string | null;
  act_explanation: string | null;
  act_rule: string | null;
  status: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface BellringerPrompt {
  id: number;
  bellringer_id: number;
  slot: number;
  journal_type: string | null;
  journal_prompt: string | null;
  journal_subprompt: string | null;
  image_path: string | null;
}

export interface BellringerWithPrompts extends Bellringer {
  prompts: BellringerPrompt[];
}

export interface ReferenceDoc {
  id: number;
  name: string;
  file_path: string;
  extracted_text: string | null;
  doc_type: string | null;
  uploaded_at: string;
}

export interface LessonPlan {
  id: number;
  week_of: string;
  class_id: number | null;
  raw_input: string | null;
  brainstorm_history: Record<string, unknown> | null;
  publish_token: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

export interface LessonPlanComment {
  id: number;
  lesson_plan_id: number;
  author_role: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface Standard {
  id: number;
  subject: string;
  grade_band: string;
  code: string;
  description: string;
  strand: string | null;
}

export interface ActivityStandard {
  id: number;
  activity_id: number;
  standard_id: number;
  tagged_by: string;
  created_at: string;
}

// Journal prompt types
export const JOURNAL_TYPES = [
  'creative',
  'quote',
  'emoji',
  'reflective',
  'critical_thinking',
  'descriptive',
  'poetry',
  'list',
  'debate',
  'would_you_rather',
  'image',
  'emoji_story_starter',
] as const;

export type JournalType = (typeof JOURNAL_TYPES)[number];

// Type labels for display
export const TYPE_LABELS: Record<string, string> = {
  creative: 'Creative',
  quote: 'Quote',
  image: 'Visual',
  emoji: 'Emoji',
  emoji_story_starter: 'Emoji Story',
  reflective: 'Reflective',
  critical_thinking: 'Critical Thinking',
  descriptive: 'Descriptive',
  poetry: 'Poetry',
  list: 'Top 5 List',
  visual: 'Visual',
  debate: 'Debate',
  would_you_rather: 'Would You Rather',
};

// Prompt bank entry
export interface PromptBankEntry {
  type: string;
  prompt: string;
  source?: string;
  writing_prompt?: string;
}

// ACT bank entry
export interface ActBankEntry {
  day: number;
  week: number;
  day_of_week: string;
  skill_category: string;
  skill: string;
  question: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_answer: string;
  explanation: string;
  rule: string;
}

// Display types
export interface PromptCard {
  type: string;
  label: string;
  text: string;
  image: string | null;
  emojis?: string;
}

// SubDash types

export interface ScheduleEntry {
  period: string;
  time: string;
  class_id: number | null;
  class_name: string;
}

export interface MediaLibraryItem {
  id: number;
  name: string;
  file_path: string | null;
  url: string | null;
  media_type: 'file' | 'link' | 'video';
  class_id: number | null;
  tags: string[];
  uploaded_at: string;
}

export interface SubDashPlan {
  id: number;
  date: string;
  share_token: string;
  custom_notes: string | null;
  sub_name: string | null;
  sub_contact: string | null;
  status: 'draft' | 'shared';
  mode: 'planned' | 'emergency';
  snapshot: SubDashSnapshot;
  created_at: string;
  updated_at: string | null;
}

export interface SubDashMediaItem {
  name: string;
  file_path: string | null;
  url: string | null;
  media_type: 'file' | 'link' | 'video';
}

export interface SubDashInstruction {
  title: string;
  description: string | null;
  activity_type: string;
  material_file_path: string | null;
}

export interface SubDashPeriod {
  period: string;
  time: string;
  class_name: string;
  instructions: SubDashInstruction[];
}

export interface SubDashSnapshot {
  date: string;
  teacher_name: string;
  school_name: string;
  room_number: string;
  office_phone: string;
  sub_name: string | null;
  sub_contact: string | null;
  custom_notes: string | null;
  schedule: ScheduleEntry[];
  periods: SubDashPeriod[];
  bellringer: {
    display_url: string;
    prompts: Array<{ type: string; prompt: string }>;
    act_question: string | null;
    act_choices: string[];
    act_correct: string | null;
    act_explanation: string | null;
  } | null;
  management_notes: string;
  behavior_policy: string;
  seating_chart_urls: string[];
  emergency_contacts: string;
  standing_instructions: string;
  backup_activities: string[];
  media: SubDashMediaItem[];
  generated_at: string;
}
