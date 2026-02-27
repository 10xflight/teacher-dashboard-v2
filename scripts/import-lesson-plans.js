#!/usr/bin/env node
/**
 * Import historical lesson plan PDFs into the database.
 * Usage: node scripts/import-lesson-plans.js [--dry-run] [--single <filename>]
 */

const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SUPABASE_URL = 'https://lypeehirowfkgxqkmngn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RI-WIVE3G0KAl26Vm28bVQ_aHkYlEBE';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const APP_URL = 'http://localhost:3000';

const PDF_DIR = path.resolve('C:\\Users\\12147\\Desktop\\Family\\Rachel\\TeacherDashboard\\Lesson Plans');

// Class mapping: PDF name -> DB id
const CLASS_MAP = {
  'english i': 2,    // English 1
  'english ii': 3,   // English 2
  'french i': 7,     // French 1
};

// ── Extract text from PDF using Python/PyMuPDF ──
function extractPdfText(filePath) {
  const pyScript = path.join(__dirname, 'extract-pdf.py');
  const result = execSync(`python "${pyScript}" "${filePath}"`, {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return result;
}

// ── Parse the lesson plan text into structured data ──
function parseLessonPlan(text) {
  const days = [];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Split by day headers
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  let currentDay = null;
  let currentDate = null;
  let currentClass = null;
  let currentActivities = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for day name
    if (dayNames.includes(line)) {
      // Save previous day if exists
      if (currentDay && currentDate) {
        days.push({ day: currentDay, date: currentDate, classes: [...currentActivities] });
      }
      currentDay = line;
      currentDate = null;
      currentClass = null;
      currentActivities = [];
      continue;
    }

    // Check for date pattern (M/D/YY or M/D/YYYY)
    const dateMatch = line.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (dateMatch) {
      let [, month, day, year] = dateMatch;
      if (year.length === 2) {
        year = (parseInt(year) > 50 ? '19' : '20') + year;
      }
      currentDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      continue;
    }

    // Check for class header
    const classMatch = line.match(/^(English\s+I{1,2}|French\s+I)\s*\(/i);
    if (classMatch) {
      const className = classMatch[1].toLowerCase().replace(/\s+/g, ' ').trim();
      const classId = CLASS_MAP[className];
      if (classId) {
        currentClass = { classId, className: classMatch[1], activities: [] };
        currentActivities.push(currentClass);
      }
      continue;
    }

    // Skip lines that are just period info like "(2nd and 6th)" or "(1st, 3rd, and 5th)"
    if (/^\([\d\w\s,and]+\)\s*$/.test(line)) continue;

    // Skip footer lines
    if (/^Lesson Plan$/i.test(line) || /^Rachel Shaw$/i.test(line) || /^CLASS ANNOUNCEMENTS/i.test(line)) {
      break;
    }

    // Add as activity to current class
    if (currentClass && line.length > 0) {
      // Skip "Writers Corner" and "Writers Workshop" as they're not lesson activities
      if (/^Writers?\s*(Corner|Workshop)/i.test(line)) continue;
      currentClass.activities.push(line);
    }
  }

  // Save last day
  if (currentDay && currentDate) {
    days.push({ day: currentDay, date: currentDate, classes: [...currentActivities] });
  }

  return days;
}

// ── Determine activity type ──
function guessActivityType(title) {
  const lower = title.toLowerCase();
  if (/\bquiz\b|\btest\b|\bexam\b|\bassessment\b|\bbinder check\b/i.test(lower)) return 'assessment';
  if (/\bhomework\b|\bpacket\b/i.test(lower)) return 'homework';
  if (/\bgame\b|\bbingo\b|\bjeopardy\b|\brelay\b/i.test(lower)) return 'game';
  if (/\bjournal\b|\bwriting choice\b/i.test(lower)) return 'journal';
  if (/\bbellringer\b|\bact prep\b/i.test(lower)) return 'bellringer';
  if (/\bread\b|\breading\b|\bbook\b|\bfilm\b|\bvideo\b|\bstory\b/i.test(lower)) return 'lesson';
  if (/\bvocab\b|\bgrammar\b/i.test(lower)) return 'lesson';
  return 'lesson';
}

// ── Check if it's a holiday/no-school day ──
function isHoliday(activities) {
  if (activities.length === 0) return false;
  const combined = activities.map(a => a.toLowerCase()).join(' ');
  return /teacher work day|president|no school|holiday|break|sub \(/i.test(combined);
}

// ── Tag standards via AI (calls the app's tag-standards API) ──
async function tagPlanWithAI(planId) {
  console.log(`  Tagging plan ${planId} with AI (1-3 standards per activity)...`);
  try {
    const resp = await fetch(`${APP_URL}/api/lesson-plans/tag-standards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson_plan_id: planId }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.log(`    ✗ Tag API error: ${resp.status} ${errText}`);
      return 0;
    }
    const data = await resp.json();
    const results = data.results || [];
    let totalTags = 0;
    for (const r of results) {
      if (r.codes && r.codes.length > 0) {
        totalTags += r.codes.length;
        console.log(`    Activity ${r.activity_id}: ${r.codes.join(', ')} — ${r.reasoning}`);
      } else if (r.error) {
        console.log(`    Activity ${r.activity_id}: no tags (${r.error})`);
      }
    }
    console.log(`  ✓ AI tagged ${totalTags} standards across ${results.length} activities`);
    return totalTags;
  } catch (e) {
    console.log(`    ✗ Failed to call tag API: ${e.message}`);
    console.log(`    Make sure the app is running at ${APP_URL}`);
    return 0;
  }
}

// ── Get week_of (Monday of the week) from a date ──
function getWeekOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setDate(d.getDate() + diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ── Main import function ──
async function importPdf(filePath, dryRun = false) {
  const fileName = path.basename(filePath);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${fileName}`);
  console.log('='.repeat(60));

  const text = extractPdfText(filePath);
  const days = parseLessonPlan(text);

  if (days.length === 0) {
    console.log('  No days found, skipping.');
    return { file: fileName, status: 'skipped', reason: 'no days parsed' };
  }

  // Determine week_of from first date
  const weekOf = getWeekOf(days[0].date);
  console.log(`  Week of: ${weekOf}`);
  console.log(`  Days: ${days.map(d => `${d.day} ${d.date}`).join(', ')}`);

  // Check if lesson plan already exists for this week
  const { data: existing } = await supabase
    .from('lesson_plans')
    .select('id')
    .eq('week_of', weekOf)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`  ⚠ Lesson plan already exists for week ${weekOf} (id: ${existing[0].id}), skipping.`);
    return { file: fileName, status: 'skipped', reason: 'already exists', weekOf };
  }

  let totalActivities = 0;

  if (dryRun) {
    for (const day of days) {
      console.log(`\n  ${day.day} ${day.date}:`);
      for (const cls of day.classes) {
        console.log(`    ${cls.className} (id: ${cls.classId}):`);
        for (const act of cls.activities) {
          const type = guessActivityType(act);
          const holiday = isHoliday(cls.activities);
          console.log(`      [${type}] ${act}${holiday ? ' (HOLIDAY)' : ''}`);
          totalActivities++;
        }
      }
    }
    console.log(`\n  DRY RUN: Would create ${totalActivities} activities (AI tagging happens after)`);
    return { file: fileName, status: 'dry-run', weekOf, activities: totalActivities };
  }

  // Create lesson plan
  const { data: plan, error: planError } = await supabase
    .from('lesson_plans')
    .insert({ week_of: weekOf, status: 'imported' })
    .select('id')
    .single();

  if (planError) {
    console.log(`  ✗ Failed to create lesson plan: ${planError.message}`);
    return { file: fileName, status: 'error', error: planError.message };
  }

  console.log(`  Created lesson plan id: ${plan.id}`);

  for (const day of days) {
    for (const cls of day.classes) {
      const holiday = isHoliday(cls.activities);

      if (holiday) {
        // Create single holiday placeholder
        const { data: act, error: actErr } = await supabase
          .from('activities')
          .insert({
            class_id: cls.classId,
            lesson_plan_id: plan.id,
            date: day.date,
            title: cls.activities.join(' / ') || 'No School',
            description: null,
            activity_type: 'other',
            sort_order: 0,
            material_status: 'not_needed',
          })
          .select('id')
          .single();

        if (!actErr) totalActivities++;
        continue;
      }

      for (let sortIdx = 0; sortIdx < cls.activities.length; sortIdx++) {
        const actTitle = cls.activities[sortIdx];
        const actType = guessActivityType(actTitle);

        const { data: act, error: actErr } = await supabase
          .from('activities')
          .insert({
            class_id: cls.classId,
            lesson_plan_id: plan.id,
            date: day.date,
            title: actTitle,
            description: null,
            activity_type: actType,
            sort_order: sortIdx,
            material_status: 'not_needed',
          })
          .select('id')
          .single();

        if (actErr) {
          console.log(`    ✗ Failed to create activity: ${actErr.message}`);
          continue;
        }

        totalActivities++;
      }
    }
  }

  console.log(`  ✓ Created ${totalActivities} activities`);

  // Tag with AI (calls the running app's API)
  const totalTags = await tagPlanWithAI(plan.id);

  console.log(`  ✓ Done: ${totalActivities} activities, ${totalTags} AI-tagged standards`);
  return { file: fileName, status: 'success', weekOf, planId: plan.id, activities: totalActivities, tags: totalTags };
}

// ── Re-tag an existing plan (clear old tags, then AI tag) ──
async function retagPlan(planId) {
  console.log(`\nRe-tagging plan ${planId}...`);

  // Get all activity IDs for this plan
  const { data: activities } = await supabase
    .from('activities')
    .select('id')
    .eq('lesson_plan_id', planId);

  if (!activities || activities.length === 0) {
    console.log('  No activities found for this plan.');
    return;
  }

  const actIds = activities.map(a => a.id);
  console.log(`  Found ${actIds.length} activities, clearing old tags...`);

  // Delete old tags
  const { error: delErr } = await supabase
    .from('activity_standards')
    .delete()
    .in('activity_id', actIds);

  if (delErr) {
    console.log(`  ✗ Failed to delete old tags: ${delErr.message}`);
    return;
  }

  // AI tag
  const totalTags = await tagPlanWithAI(planId);
  console.log(`  ✓ Re-tagged: ${totalTags} standards across ${actIds.length} activities`);
}

// ── CLI Entry ──
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const singleIdx = args.indexOf('--single');
  const singleFile = singleIdx >= 0 ? args[singleIdx + 1] : null;
  const retagIdx = args.indexOf('--retag');
  const retagId = retagIdx >= 0 ? parseInt(args[retagIdx + 1]) : null;

  // Re-tag mode: just retag an existing plan
  if (retagId) {
    await retagPlan(retagId);
    return;
  }

  if (singleFile) {
    const filePath = path.join(PDF_DIR, singleFile);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    const result = await importPdf(filePath, dryRun);
    console.log('\nResult:', JSON.stringify(result, null, 2));
  } else {
    const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf')).sort();
    console.log(`Found ${files.length} PDF files to import.`);

    const results = [];
    for (const file of files) {
      const result = await importPdf(path.join(PDF_DIR, file), dryRun);
      results.push(result);
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    for (const r of results) {
      console.log(`  ${r.status.padEnd(10)} ${r.file}${r.weekOf ? ` (week: ${r.weekOf})` : ''}${r.activities ? ` — ${r.activities} activities, ${r.tags} tags` : ''}${r.reason ? ` — ${r.reason}` : ''}`);
    }
  }
}

main().catch(console.error);
