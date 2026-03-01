-- Teacher Dashboard v2 Schema (with Auth)
-- Run this in Supabase SQL Editor to create all tables
-- Requires Supabase Auth to be enabled

-- Classes
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  periods TEXT,
  color TEXT
);

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'custom',
  title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  due_date TEXT,
  is_done BOOLEAN DEFAULT FALSE,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  created_date TEXT DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Reference docs
CREATE TABLE IF NOT EXISTS reference_docs (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  extracted_text TEXT,
  doc_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bellringers
CREATE TABLE IF NOT EXISTS bellringers (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Standards (seeded from oklahoma_standards.json — shared reference data)
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
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Settings table (key-value store for app settings, per-user)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  PRIMARY KEY (key, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_classes_user ON classes(user_id);
CREATE INDEX IF NOT EXISTS idx_bellringers_date ON bellringers(date);
CREATE INDEX IF NOT EXISTS idx_bellringers_user ON bellringers(user_id);
CREATE INDEX IF NOT EXISTS idx_bellringer_prompts_bellringer ON bellringer_prompts(bellringer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(is_done);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_class ON tasks(class_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
CREATE INDEX IF NOT EXISTS idx_activities_class ON activities(class_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON lesson_plan_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_user ON lesson_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id);

-- Enable Row Level Security
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

-- RLS Policies

-- Classes: users manage their own
CREATE POLICY "Users manage own classes"
  ON classes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Calendar events: users manage their own
CREATE POLICY "Users manage own calendar events"
  ON calendar_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tasks: users manage their own
CREATE POLICY "Users manage own tasks"
  ON tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Reference docs: users manage their own
CREATE POLICY "Users manage own reference docs"
  ON reference_docs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bellringers: users manage their own
CREATE POLICY "Users manage own bellringers"
  ON bellringers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bellringer prompts: access through parent bellringer
CREATE POLICY "Users manage own bellringer prompts"
  ON bellringer_prompts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM bellringers
    WHERE bellringers.id = bellringer_prompts.bellringer_id
      AND bellringers.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM bellringers
    WHERE bellringers.id = bellringer_prompts.bellringer_id
      AND bellringers.user_id = auth.uid()
  ));

-- Standards: shared reference data, readable by all authenticated users
CREATE POLICY "Anyone can read standards"
  ON standards FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage standards"
  ON standards FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Lesson plans: users manage their own
CREATE POLICY "Users manage own lesson plans"
  ON lesson_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Published lesson plans are publicly readable (principal view)
CREATE POLICY "Published plans are public"
  ON lesson_plans FOR SELECT
  USING (publish_token IS NOT NULL AND status = 'published');

-- Comments: public on published plans
CREATE POLICY "Comments on published plans are public"
  ON lesson_plan_comments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM lesson_plans
    WHERE lesson_plans.id = lesson_plan_comments.lesson_plan_id
      AND lesson_plans.publish_token IS NOT NULL
      AND lesson_plans.status = 'published'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lesson_plans
    WHERE lesson_plans.id = lesson_plan_comments.lesson_plan_id
      AND lesson_plans.publish_token IS NOT NULL
      AND lesson_plans.status = 'published'
  ));

-- Activities: users manage their own
CREATE POLICY "Users manage own activities"
  ON activities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Activities in published plans are publicly readable
CREATE POLICY "Activities in published plans are public"
  ON activities FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM lesson_plans
    WHERE lesson_plans.id = activities.lesson_plan_id
      AND lesson_plans.publish_token IS NOT NULL
      AND lesson_plans.status = 'published'
  ));

-- Activity standards: access through parent activity
CREATE POLICY "Users manage own activity standards"
  ON activity_standards FOR ALL
  USING (EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_standards.activity_id
      AND activities.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM activities
    WHERE activities.id = activity_standards.activity_id
      AND activities.user_id = auth.uid()
  ));

CREATE POLICY "Activity standards in published plans are public"
  ON activity_standards FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM activities
      JOIN lesson_plans ON lesson_plans.id = activities.lesson_plan_id
    WHERE activities.id = activity_standards.activity_id
      AND lesson_plans.publish_token IS NOT NULL
      AND lesson_plans.status = 'published'
  ));

-- Settings: users manage their own
CREATE POLICY "Users manage own settings"
  ON settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- SubDash tables
-- ============================================================

-- Classroom profiles (key-value store for sub dashboard)
CREATE TABLE IF NOT EXISTS classroom_profiles (
  key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  PRIMARY KEY (key, user_id)
);

-- Media library (persistent file/link library)
CREATE TABLE IF NOT EXISTS media_library (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_subdash_plans_user ON subdash_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_media_library_class ON media_library(class_id);
CREATE INDEX IF NOT EXISTS idx_media_library_user ON media_library(user_id);
CREATE INDEX IF NOT EXISTS idx_classroom_profiles_user ON classroom_profiles(user_id);

-- RLS for SubDash tables
ALTER TABLE classroom_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE subdash_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subdash_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own classroom profiles"
  ON classroom_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own media"
  ON media_library FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own subdash plans"
  ON subdash_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Subdash plans are public via token"
  ON subdash_plans FOR SELECT
  USING (share_token IS NOT NULL);

CREATE POLICY "Users manage own subdash media"
  ON subdash_media FOR ALL
  USING (EXISTS (
    SELECT 1 FROM subdash_plans
    WHERE subdash_plans.id = subdash_media.subdash_plan_id
      AND subdash_plans.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM subdash_plans
    WHERE subdash_plans.id = subdash_media.subdash_plan_id
      AND subdash_plans.user_id = auth.uid()
  ));

CREATE POLICY "Subdash media readable via public plan"
  ON subdash_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM subdash_plans
    WHERE subdash_plans.id = subdash_media.subdash_plan_id
      AND subdash_plans.share_token IS NOT NULL
  ));

-- Email task queue
CREATE TABLE IF NOT EXISTS email_task_queue (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_message_id TEXT NOT NULL,
  email_subject TEXT,
  email_from TEXT,
  email_date TEXT,
  task_text TEXT NOT NULL,
  suggested_due_date TEXT,
  suggested_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  confidence TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  created_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_task_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_user ON email_task_queue(user_id);
ALTER TABLE email_task_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own email queue"
  ON email_task_queue FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
