import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

function classToSubject(className: string): string {
  const lower = className.toLowerCase();
  if (lower.includes('french')) return 'French';
  return 'English';
}

function classToGradeBand(className: string): string | null {
  const lower = className.toLowerCase();
  if (lower.includes('french')) return '1';
  if (lower.includes('english-1') || lower.includes('english 1') || lower.includes('eng 1')) return '9';
  if (lower.includes('english-2') || lower.includes('english 2') || lower.includes('eng 2')) return '10';
  const match = className.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    if (num <= 2) return num === 1 ? '9' : '10';
    return String(num);
  }
  return null;
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

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

    // 3. Fetch activity_standards and activities SEPARATELY to avoid join issues
    //    Also paginate to avoid Supabase's default 1000-row limit

    // 3a. Fetch ALL activity_standards (paginated)
    let allActivityStandards: { standard_id: number; activity_id: number }[] = [];
    {
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('activity_standards')
          .select('standard_id, activity_id')
          .range(from, from + pageSize - 1);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        if (data) allActivityStandards = allActivityStandards.concat(data);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
    }

    // 3b. Fetch ALL activities (just id, date, class_id) — paginated
    let allActivities: { id: number; date: string | null; class_id: number }[] = [];
    {
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('activities')
          .select('id, date, class_id')
          .range(from, from + pageSize - 1);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        if (data) allActivities = allActivities.concat(data);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
    }

    // 3c. Build activity lookup by id
    const activityMap = new Map<number, { date: string | null; class_id: number }>();
    for (const act of allActivities) {
      activityMap.set(act.id, { date: act.date, class_id: act.class_id });
    }

    // 4. Build a lookup: per class_id + standard_id -> { hit_count, last_hit_date }
    const coverageMap: Record<
      string,
      { hit_count: number; last_hit_date: string | null }
    > = {};

    for (const row of allActivityStandards) {
      const activity = activityMap.get(row.activity_id);
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
    const cutoffDate = `${fourWeeksAgo.getFullYear()}-${String(fourWeeksAgo.getMonth() + 1).padStart(2, '0')}-${String(fourWeeksAgo.getDate()).padStart(2, '0')}`;

    // 6. Match standards to each class by subject + grade_band

    const classResults = (classes ?? []).map((cls) => {
      const subject = classToSubject(cls.name);
      const gradeBand = classToGradeBand(cls.name);

      // Filter standards to only those matching this class's subject/grade_band
      const relevantStandards = (standards ?? []).filter((std) => {
        if (std.subject !== subject) return false;
        if (gradeBand && std.grade_band !== gradeBand) return false;
        return true;
      });

      const classStandards = relevantStandards.map((std) => {
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
