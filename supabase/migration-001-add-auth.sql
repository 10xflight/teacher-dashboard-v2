-- ============================================================
-- Migration 001: Add user_id columns and real RLS policies
-- Run this in the Supabase SQL Editor AFTER:
--   1. Enabling Auth in your Supabase project
--   2. Creating your user account in Auth → Users
-- ============================================================

-- ============================================================
-- STEP 0: Get the first user ID for backfilling existing data
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Grab the first (and likely only) user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in auth.users. Create a user in Authentication → Users first, then re-run this migration.';
  END IF;

  RAISE NOTICE 'Backfilling existing data with user_id: %', v_user_id;

  -- ============================================================
  -- STEP 1: Add user_id columns (nullable first)
  -- ============================================================

  ALTER TABLE classes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE reference_docs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE bellringers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE activities ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE classroom_profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE media_library ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE subdash_plans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE email_task_queue ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

  -- ============================================================
  -- STEP 2: Backfill existing rows with the user's ID
  -- ============================================================

  UPDATE classes SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE calendar_events SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE tasks SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE reference_docs SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE bellringers SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE lesson_plans SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE activities SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE settings SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE classroom_profiles SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE media_library SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE subdash_plans SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE email_task_queue SET user_id = v_user_id WHERE user_id IS NULL;

END $$;

-- ============================================================
-- STEP 3: Now safe to add composite primary keys
-- (settings and classroom_profiles use key+user_id)
-- ============================================================

ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE settings ADD PRIMARY KEY (key, user_id);

ALTER TABLE classroom_profiles DROP CONSTRAINT IF EXISTS classroom_profiles_pkey;
ALTER TABLE classroom_profiles ADD PRIMARY KEY (key, user_id);

-- ============================================================
-- STEP 4: Add indexes on user_id columns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_classes_user ON classes(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_reference_docs_user ON reference_docs(user_id);
CREATE INDEX IF NOT EXISTS idx_bellringers_user ON bellringers(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_user ON lesson_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_classroom_profiles_user ON classroom_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_media_library_user ON media_library(user_id);
CREATE INDEX IF NOT EXISTS idx_subdash_plans_user ON subdash_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_user ON email_task_queue(user_id);

-- ============================================================
-- STEP 5: Drop old permissive "Allow all" policies
-- ============================================================

DROP POLICY IF EXISTS "Allow all" ON classes;
DROP POLICY IF EXISTS "Allow all" ON calendar_events;
DROP POLICY IF EXISTS "Allow all" ON tasks;
DROP POLICY IF EXISTS "Allow all" ON reference_docs;
DROP POLICY IF EXISTS "Allow all" ON bellringers;
DROP POLICY IF EXISTS "Allow all" ON bellringer_prompts;
DROP POLICY IF EXISTS "Allow all" ON standards;
DROP POLICY IF EXISTS "Allow all" ON lesson_plans;
DROP POLICY IF EXISTS "Allow all" ON lesson_plan_comments;
DROP POLICY IF EXISTS "Allow all" ON activities;
DROP POLICY IF EXISTS "Allow all" ON activity_standards;
DROP POLICY IF EXISTS "Allow all" ON settings;
DROP POLICY IF EXISTS "Allow all" ON classroom_profiles;
DROP POLICY IF EXISTS "Allow all" ON media_library;
DROP POLICY IF EXISTS "Allow all" ON subdash_plans;
DROP POLICY IF EXISTS "Allow all" ON subdash_media;
DROP POLICY IF EXISTS "Allow all" ON email_task_queue;

-- ============================================================
-- STEP 6: Create real RLS policies
-- ============================================================

-- === CLASSES ===
CREATE POLICY "Users manage own classes"
  ON classes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- === CALENDAR EVENTS ===
CREATE POLICY "Users manage own calendar events"
  ON calendar_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- === TASKS ===
CREATE POLICY "Users manage own tasks"
  ON tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- === REFERENCE DOCS ===
CREATE POLICY "Users manage own reference docs"
  ON reference_docs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- === BELLRINGERS ===
CREATE POLICY "Users manage own bellringers"
  ON bellringers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- === BELLRINGER PROMPTS ===
CREATE POLICY "Users manage own bellringer prompts"
  ON bellringer_prompts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bellringers
      WHERE bellringers.id = bellringer_prompts.bellringer_id
        AND bellringers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bellringers
      WHERE bellringers.id = bellringer_prompts.bellringer_id
        AND bellringers.user_id = auth.uid()
    )
  );

-- === STANDARDS ===
CREATE POLICY "Anyone can read standards"
  ON standards FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage standards"
  ON standards FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- === LESSON PLANS ===
CREATE POLICY "Users manage own lesson plans"
  ON lesson_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Published plans are public"
  ON lesson_plans FOR SELECT
  USING (publish_token IS NOT NULL AND status = 'published');

-- === LESSON PLAN COMMENTS ===
CREATE POLICY "Comments on published plans are public"
  ON lesson_plan_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lesson_plans
      WHERE lesson_plans.id = lesson_plan_comments.lesson_plan_id
        AND lesson_plans.publish_token IS NOT NULL
        AND lesson_plans.status = 'published'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lesson_plans
      WHERE lesson_plans.id = lesson_plan_comments.lesson_plan_id
        AND lesson_plans.publish_token IS NOT NULL
        AND lesson_plans.status = 'published'
    )
  );

-- === ACTIVITIES ===
CREATE POLICY "Users manage own activities"
  ON activities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Activities in published plans are public"
  ON activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lesson_plans
      WHERE lesson_plans.id = activities.lesson_plan_id
        AND lesson_plans.publish_token IS NOT NULL
        AND lesson_plans.status = 'published'
    )
  );

-- === ACTIVITY STANDARDS ===
CREATE POLICY "Users manage own activity standards"
  ON activity_standards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM activities
      WHERE activities.id = activity_standards.activity_id
        AND activities.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activities
      WHERE activities.id = activity_standards.activity_id
        AND activities.user_id = auth.uid()
    )
  );

CREATE POLICY "Activity standards in published plans are public"
  ON activity_standards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activities
        JOIN lesson_plans ON lesson_plans.id = activities.lesson_plan_id
      WHERE activities.id = activity_standards.activity_id
        AND lesson_plans.publish_token IS NOT NULL
        AND lesson_plans.status = 'published'
    )
  );

-- === SETTINGS ===
CREATE POLICY "Users manage own settings"
  ON settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- === CLASSROOM PROFILES ===
CREATE POLICY "Users manage own classroom profiles"
  ON classroom_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- === MEDIA LIBRARY ===
CREATE POLICY "Users manage own media"
  ON media_library FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- === SUBDASH PLANS ===
CREATE POLICY "Users manage own subdash plans"
  ON subdash_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Subdash plans are public via token"
  ON subdash_plans FOR SELECT
  USING (share_token IS NOT NULL);

-- === SUBDASH MEDIA ===
CREATE POLICY "Users manage own subdash media"
  ON subdash_media FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM subdash_plans
      WHERE subdash_plans.id = subdash_media.subdash_plan_id
        AND subdash_plans.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM subdash_plans
      WHERE subdash_plans.id = subdash_media.subdash_plan_id
        AND subdash_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Subdash media readable via public plan"
  ON subdash_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subdash_plans
      WHERE subdash_plans.id = subdash_media.subdash_plan_id
        AND subdash_plans.share_token IS NOT NULL
    )
  );

-- === EMAIL TASK QUEUE ===
CREATE POLICY "Users manage own email queue"
  ON email_task_queue FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
