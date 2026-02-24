/**
 * Migration script: SQLite (Flask v1) → Supabase Postgres (Next.js v2)
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-supabase.mjs <path-to-sqlite-db>
 *
 * Requires:
 *   npm install better-sqlite3 @supabase/supabase-js
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
 *   (or SUPABASE_SERVICE_ROLE_KEY for bypassing RLS)
 */

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Config ---
const dbPath = process.argv[2];
if (!dbPath) {
  console.error('Usage: node scripts/migrate-sqlite-to-supabase.mjs <path-to-sqlite.db>');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const db = new Database(resolve(dbPath), { readonly: true });

// --- Helpers ---
function readAll(table) {
  try {
    return db.prepare(`SELECT * FROM ${table}`).all();
  } catch {
    console.log(`  Table '${table}' does not exist in SQLite, skipping.`);
    return [];
  }
}

async function upsertBatch(table, rows, batchSize = 100) {
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows, skipping.`);
    return 0;
  }

  let total = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`  ERROR inserting into ${table} (batch ${i}):`, error.message);
      // Try row-by-row for this batch
      for (const row of batch) {
        const { error: rowErr } = await supabase.from(table).upsert(row, { onConflict: 'id' });
        if (rowErr) {
          console.error(`    Row id=${row.id}: ${rowErr.message}`);
        } else {
          total++;
        }
      }
    } else {
      total += batch.length;
    }
  }
  console.log(`  ${table}: ${total}/${rows.length} rows migrated.`);
  return total;
}

// --- Seed Calendar if needed ---
async function seedCalendar() {
  const seedPath = resolve(__dirname, '../src/data/calendar-seed.json');
  try {
    const events = JSON.parse(readFileSync(seedPath, 'utf-8'));
    if (events.length > 0) {
      const { error } = await supabase.from('calendar_events').upsert(
        events.map((e, i) => ({ ...e, id: 10000 + i })),
        { onConflict: 'id' }
      );
      if (error) console.error('  Calendar seed error:', error.message);
      else console.log(`  Calendar seed: ${events.length} events from calendar-seed.json`);
    }
  } catch {
    console.log('  No calendar-seed.json found, skipping seed.');
  }
}

// --- Main Migration ---
async function migrate() {
  console.log(`\nMigrating from: ${resolve(dbPath)}`);
  console.log(`To: ${supabaseUrl}\n`);

  // 1. Classes
  console.log('1. Classes...');
  const classes = readAll('classes').map(c => ({
    id: c.id,
    name: c.name,
    periods: c.periods || null,
    color: c.color || null,
  }));
  await upsertBatch('classes', classes);

  // 2. Calendar Events
  console.log('2. Calendar Events...');
  const events = readAll('calendar_events').map(e => ({
    id: e.id,
    date: e.date,
    event_type: e.event_type,
    title: e.title || '',
    notes: e.notes || null,
    created_at: e.created_at || new Date().toISOString(),
  }));
  await upsertBatch('calendar_events', events);

  // Also seed from calendar-seed.json if DB events are few
  if (events.length < 10) {
    console.log('  Few events in DB, also seeding from calendar-seed.json...');
    await seedCalendar();
  }

  // 3. Tasks
  console.log('3. Tasks...');
  const tasks = readAll('tasks').map(t => ({
    id: t.id,
    text: t.text,
    due_date: t.due_date || null,
    is_done: !!t.is_done,
    created_at: t.created_at || new Date().toISOString(),
    completed_at: t.completed_at || null,
  }));
  await upsertBatch('tasks', tasks);

  // 4. Bellringers
  console.log('4. Bellringers...');
  const bellringers = readAll('bellringers').map(b => ({
    id: b.id,
    date: b.date,
    journal_type: b.journal_type || null,
    journal_prompt: b.journal_prompt || null,
    journal_subprompt: b.journal_subprompt || null,
    journal_image_path: b.journal_image_path || null,
    act_skill_category: b.act_skill_category || null,
    act_skill: b.act_skill || null,
    act_question: b.act_question || null,
    act_choice_a: b.act_choice_a || null,
    act_choice_b: b.act_choice_b || null,
    act_choice_c: b.act_choice_c || null,
    act_choice_d: b.act_choice_d || null,
    act_correct_answer: b.act_correct_answer || null,
    act_explanation: b.act_explanation || null,
    act_rule: b.act_rule || null,
    status: b.status || 'draft',
    is_approved: !!b.is_approved,
    created_at: b.created_at || new Date().toISOString(),
    updated_at: b.updated_at || null,
  }));
  await upsertBatch('bellringers', bellringers);

  // 5. Bellringer Prompts
  console.log('5. Bellringer Prompts...');
  const prompts = readAll('bellringer_prompts').map(p => ({
    id: p.id,
    bellringer_id: p.bellringer_id,
    slot: p.slot || 0,
    journal_type: p.journal_type || null,
    journal_prompt: p.journal_prompt || null,
    journal_subprompt: p.journal_subprompt || null,
    image_path: p.image_path || null,
  }));
  await upsertBatch('bellringer_prompts', prompts);

  // 6. Reference Docs
  console.log('6. Reference Docs...');
  const docs = readAll('reference_docs').map(d => ({
    id: d.id,
    name: d.name,
    file_path: d.file_path,
    extracted_text: d.extracted_text || null,
    doc_type: d.doc_type || null,
    uploaded_at: d.uploaded_at || new Date().toISOString(),
  }));
  await upsertBatch('reference_docs', docs);

  // 7. Assignments → Activities (field mapping)
  console.log('7. Assignments → Activities...');
  const assignments = readAll('assignments').map(a => ({
    id: a.id,
    class_id: a.class_id,
    date: a.date || null,
    title: a.title,
    description: a.description || null,
    activity_type: 'lesson',
    sort_order: 0,
    material_status: 'not_needed',
    is_done: !!a.is_graded,
    created_at: a.created_at || new Date().toISOString(),
  }));
  if (assignments.length > 0) {
    await upsertBatch('activities', assignments);
  } else {
    console.log('  No assignments to migrate.');
  }

  // 8. Settings — migrate from config if available
  console.log('8. Settings...');
  // SQLite v1 doesn't have a settings table; settings were in config.py
  // We'll skip this — user sets them in the v2 UI

  // Done
  console.log('\nMigration complete!');

  // Summary
  console.log('\nSummary:');
  console.log(`  Classes: ${classes.length}`);
  console.log(`  Calendar Events: ${events.length}`);
  console.log(`  Tasks: ${tasks.length}`);
  console.log(`  Bellringers: ${bellringers.length}`);
  console.log(`  Bellringer Prompts: ${prompts.length}`);
  console.log(`  Reference Docs: ${docs.length}`);
  console.log(`  Assignments → Activities: ${assignments.length}`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
}).finally(() => {
  db.close();
});
