import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    // 1. Fetch all classes
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('*')
      .order('id', { ascending: true });

    if (classError) {
      return NextResponse.json({ error: classError.message }, { status: 500 });
    }

    // 2. Fetch all standards
    const { data: standards, error: stdError } = await supabase
      .from('standards')
      .select('*')
      .order('subject', { ascending: true })
      .order('grade_band', { ascending: true })
      .order('code', { ascending: true });

    if (stdError) {
      return NextResponse.json({ error: stdError.message }, { status: 500 });
    }

    // 3. Fetch all activity_standards with the activity's date and class_id
    const { data: activityStandards, error: asError } = await supabase
      .from('activity_standards')
      .select('standard_id, activity_id, activities(date, class_id)');

    if (asError) {
      return NextResponse.json({ error: asError.message }, { status: 500 });
    }

    // 4. Build a lookup: per class_id + standard_id -> { hit_count, last_hit_date }
    const coverageMap: Record<
      string,
      { hit_count: number; last_hit_date: string | null }
    > = {};

    for (const row of activityStandards ?? []) {
      // Supabase returns the joined activity as an object (or null)
      const activity = row.activities as unknown as {
        date: string | null;
        class_id: number;
      } | null;

      if (!activity) continue;

      const key = `${activity.class_id}:${row.standard_id}`;
      if (!coverageMap[key]) {
        coverageMap[key] = { hit_count: 0, last_hit_date: null };
      }
      coverageMap[key].hit_count += 1;

      if (activity.date) {
        if (
          !coverageMap[key].last_hit_date ||
          activity.date > coverageMap[key].last_hit_date!
        ) {
          coverageMap[key].last_hit_date = activity.date;
        }
      }
    }

    // 5. Determine the 4-week-ago cutoff
    const now = new Date();
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const cutoffDate = fourWeeksAgo.toISOString().split('T')[0];

    // 6. Group standards by subject + grade_band and map to each class
    //    We match classes to standards by name heuristics or just show all
    //    standards for each class (teacher decides which are relevant).
    //    For a teacher dashboard, we associate standards with classes by
    //    subject/grade_band. If that's not possible we show all.

    const classResults = (classes ?? []).map((cls) => {
      // All standards are potentially relevant to any class
      // The teacher tagged activities per class, so coverage is per-class
      const classStandards = (standards ?? []).map((std) => {
        const key = `${cls.id}:${std.id}`;
        const coverage = coverageMap[key];
        const hit_count = coverage?.hit_count ?? 0;
        const last_hit_date = coverage?.last_hit_date ?? null;

        // Determine gap status
        let is_gap = false;
        if (hit_count === 0) {
          is_gap = true; // never hit
        } else if (last_hit_date && last_hit_date < cutoffDate) {
          is_gap = true; // stale - not hit in 4+ weeks
        }

        return {
          id: std.id,
          code: std.code,
          description: std.description,
          strand: std.strand,
          subject: std.subject,
          grade_band: std.grade_band,
          hit_count,
          last_hit_date,
          is_gap,
        };
      });

      const totalStandards = classStandards.length;
      const coveredStandards = classStandards.filter(
        (s) => s.hit_count > 0
      ).length;
      const coveragePct =
        totalStandards > 0
          ? Math.round((coveredStandards / totalStandards) * 100)
          : 0;

      return {
        id: cls.id,
        name: cls.name,
        color: cls.color,
        total_standards: totalStandards,
        covered_standards: coveredStandards,
        coverage_pct: coveragePct,
        standards: classStandards,
      };
    });

    return NextResponse.json({ classes: classResults });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
