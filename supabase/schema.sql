-- Teacher Dashboard v2 Schema
-- Run this in Supabase SQL Editor to create all tables

-- Classes
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  periods TEXT,
  color TEXT
);

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'custom',
  title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  due_date TEXT,
  is_done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Reference docs
CREATE TABLE IF NOT EXISTS reference_docs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  extracted_text TEXT,
  doc_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bellringers
CREATE TABLE IF NOT EXISTS bellringers (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  journal_type TEXT,
  journal_prompt TEXT,
  journal_subprompt TEXT,
  journal_image_path TEXT,
  act_skill_category TEXT,
  act_skill TEXT,
  act_question TEXT,
  act_choice_a TEXT,
  act_choice_b TEXT,
  act_choice_c TEXT,
  act_choice_d TEXT,
  act_correct_answer TEXT,
  act_explanation TEXT,
  act_rule TEXT,
  status TEXT DEFAULT 'draft',
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Bellringer prompts (4-slot system)
CREATE TABLE IF NOT EXISTS bellringer_prompts (
  id SERIAL PRIMARY KEY,
  bellringer_id INTEGER NOT NULL REFERENCES bellringers(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL DEFAULT 0,
  journal_type TEXT,
  journal_prompt TEXT,
  journal_subprompt TEXT,
  image_path TEXT,
  UNIQUE(bellringer_id, slot)
);

-- Standards (seeded from oklahoma_standards.json)
CREATE TABLE IF NOT EXISTS standards (
  id SERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  grade_band TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  strand TEXT
);

-- Lesson plans (v2 redesign)
CREATE TABLE IF NOT EXISTS lesson_plans (
  id SERIAL PRIMARY KEY,
  week_of TEXT NOT NULL,
  class_id INTEGER REFERENCES classes(id),
  raw_input TEXT,
  brainstorm_history JSONB,
  publish_token TEXT,
  status TEXT DEFAULT 'draft',
  announcements TEXT,
  writers_corner JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Lesson plan comments (teacher <-> principal)
CREATE TABLE IF NOT EXISTS lesson_plan_comments (
  id SERIAL PRIMARY KEY,
  lesson_plan_id INTEGER NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES lesson_plan_comments(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities (replaces assignments with richer fields)
CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  lesson_plan_id INTEGER REFERENCES lesson_plans(id),
  date TEXT,
  title TEXT NOT NULL,
  description TEXT,
  activity_type TEXT DEFAULT 'lesson',
  sort_order INTEGER DEFAULT 0,
  material_status TEXT DEFAULT 'not_needed',
  material_content JSONB,
  material_file_path TEXT,
  is_done BOOLEAN DEFAULT FALSE,
  is_graded BOOLEAN DEFAULT FALSE,
  moved_to_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity-standards junction table
CREATE TABLE IF NOT EXISTS activity_standards (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  standard_id INTEGER NOT NULL REFERENCES standards(id),
  tagged_by TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_id, standard_id)
);

-- Settings table (key-value store for app settings)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bellringers_date ON bellringers(date);
CREATE INDEX IF NOT EXISTS idx_bellringer_prompts_bellringer ON bellringer_prompts(bellringer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(is_done);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
CREATE INDEX IF NOT EXISTS idx_activities_class ON activities(class_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON lesson_plan_comments(parent_id);

-- Enable Row Level Security (RLS) - all tables public for single-user app
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bellringers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bellringer_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plan_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations with anon key (single-user app, no auth needed)
CREATE POLICY "Allow all" ON classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON calendar_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON reference_docs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON bellringers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON bellringer_prompts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON standards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON lesson_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON lesson_plan_comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON activity_standards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON settings FOR ALL USING (true) WITH CHECK (true);

-- Seed default classes
INSERT INTO classes (name, periods, color) VALUES
  ('English-1', '4th and 6th', '#4ECDC4'),
  ('English-2', '1st, 3rd, and 5th', '#6C8EBF'),
  ('French-1', '', '#E8A87C')
ON CONFLICT DO NOTHING;

-- Seed default settings
INSERT INTO settings (key, value) VALUES
  ('school_name', 'Stratford High School'),
  ('teacher_name', 'R. Shaw'),
  ('school_year', '2025-2026'),
  ('gemini_api_key', '')
ON CONFLICT (key) DO NOTHING;

-- SubDash tables

-- Classroom profiles (key-value store for sub dashboard)
CREATE TABLE IF NOT EXISTS classroom_profiles (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Media library (persistent file/link library)
CREATE TABLE IF NOT EXISTS media_library (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT,
  url TEXT,
  media_type TEXT NOT NULL DEFAULT 'file',
  class_id INTEGER REFERENCES classes(id),
  tags TEXT[] DEFAULT '{}',
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- SubDash plans (generated SubDash instances)
CREATE TABLE IF NOT EXISTS subdash_plans (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  custom_notes TEXT,
  sub_name TEXT,
  sub_contact TEXT,
  status TEXT DEFAULT 'draft',
  mode TEXT DEFAULT 'planned',
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- SubDash media junction table
CREATE TABLE IF NOT EXISTS subdash_media (
  id SERIAL PRIMARY KEY,
  subdash_plan_id INTEGER NOT NULL REFERENCES subdash_plans(id) ON DELETE CASCADE,
  media_library_id INTEGER NOT NULL REFERENCES media_library(id) ON DELETE CASCADE
);

-- Indexes for SubDash
CREATE INDEX IF NOT EXISTS idx_subdash_plans_date ON subdash_plans(date);
CREATE INDEX IF NOT EXISTS idx_subdash_plans_token ON subdash_plans(share_token);
CREATE INDEX IF NOT EXISTS idx_media_library_class ON media_library(class_id);

-- RLS for SubDash tables
ALTER TABLE classroom_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE subdash_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subdash_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON classroom_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON media_library FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON subdash_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON subdash_media FOR ALL USING (true) WITH CHECK (true);
