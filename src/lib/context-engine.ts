import { supabase } from './db';

interface ContextOptions {
  classId?: number;
  date?: string;
}

interface CalendarEventRow {
  id: number;
  date: string;
  event_type: string;
  title: string;
  notes: string | null;
}

interface BellringerRow {
  id: number;
  date: string;
  journal_type: string | null;
  journal_prompt: string | null;
  act_skill: string | null;
  act_skill_category: string | null;
  is_approved: boolean;
}

interface ActivityRow {
  id: number;
  class_id: number;
  date: string | null;
  title: string;
  description: string | null;
  activity_type: string;
  is_done: boolean;
  classes?: { id: number; name: string; periods: string | null; color: string | null } | null;
}

interface StandardRow {
  id: number;
  code: string;
  description: string;
}

interface ActivityStandardRow {
  activity_id: number;
  standard_id: number;
  standards?: StandardRow | null;
}

interface LessonPlanRow {
  id: number;
  week_of: string;
  status: string;
  created_at: string;
}

interface ClassRow {
  id: number;
  name: string;
  periods: string | null;
  color: string | null;
}

interface ClassHistory {
  classId: number;
  className: string;
  recentActivities: {
    date: string | null;
    title: string;
    description: string | null;
    activity_type: string;
    is_done: boolean;
  }[];
}

interface StandardsGap {
  standardId: number;
  code: string;
  description: string;
  lastUsed: string | null;
  daysSinceUsed: number | null;
}

interface FullContext {
  today: string;
  dayOfWeek: string;
  schoolDayNumber: number | null;
  calendarEventsThisWeek: CalendarEventRow[];
  approvedBellringers: BellringerRow[];
  recentBellringers: BellringerRow[];
  recentACTSkills: string[];
  recentJournalTypes: string[];
  classHistory: ClassHistory[];
  standardsGaps: StandardsGap[];
  upcomingEvents: CalendarEventRow[];
  recentLessonPlans: (LessonPlanRow & { activities: ActivityRow[] })[];
}

/**
 * Build a comprehensive context object for use in AI prompts.
 * Fetches data from all relevant tables to give the AI a full picture
 * of the teacher's planning state, recent activities, and upcoming events.
 */
export async function buildFullContext(options?: ContextOptions): Promise<FullContext> {
  const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = options?.date || localDate(new Date());
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDate = new Date(today + 'T12:00:00');
  const dayOfWeek = dayNames[todayDate.getDay()];

  // Calculate this week's Monday and Friday
  const dayNum = todayDate.getDay();
  const mondayOffset = dayNum === 0 ? -6 : 1 - dayNum;
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() + mondayOffset);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const mondayStr = localDate(monday);
  const fridayStr = localDate(friday);

  // Calculate date 7 days from today for upcoming events
  const nextWeek = new Date(todayDate);
  nextWeek.setDate(todayDate.getDate() + 7);
  const nextWeekStr = localDate(nextWeek);

  // Calculate date 4 weeks ago for standards gap detection
  const fourWeeksAgo = new Date(todayDate);
  fourWeeksAgo.setDate(todayDate.getDate() - 28);
  const fourWeeksAgoStr = localDate(fourWeeksAgo);

  // Run all queries in parallel for performance
  const [
    schoolDayResult,
    weekEventsResult,
    approvedBellringersResult,
    recentBellringersResult,
    classesResult,
    upcomingEventsResult,
    recentPlansResult,
    allStandardsResult,
    recentActivityStandardsResult,
  ] = await Promise.all([
    // School day number: count school_day events from start of year to today
    supabase
      .from('calendar_events')
      .select('id', { count: 'exact' })
      .eq('event_type', 'school_day')
      .lte('date', today),

    // Calendar events this week
    supabase
      .from('calendar_events')
      .select('*')
      .gte('date', mondayStr)
      .lte('date', fridayStr)
      .order('date', { ascending: true }),

    // Last 20 approved bellringers
    supabase
      .from('bellringers')
      .select('id, date, journal_type, journal_prompt, act_skill, act_skill_category, is_approved')
      .eq('is_approved', true)
      .order('date', { ascending: false })
      .limit(20),

    // Last 10 bellringers (for avoiding repetition)
    supabase
      .from('bellringers')
      .select('id, date, journal_type, journal_prompt, act_skill, act_skill_category, is_approved')
      .order('date', { ascending: false })
      .limit(10),

    // All classes
    supabase
      .from('classes')
      .select('id, name, periods, color')
      .order('id', { ascending: true }),

    // Upcoming events (next 7 days)
    supabase
      .from('calendar_events')
      .select('*')
      .gte('date', today)
      .lte('date', nextWeekStr)
      .order('date', { ascending: true }),

    // Last 2 lesson plans
    supabase
      .from('lesson_plans')
      .select('id, week_of, status, created_at')
      .order('created_at', { ascending: false })
      .limit(2),

    // All standards (for gap detection)
    supabase
      .from('standards')
      .select('id, code, description')
      .order('code', { ascending: true }),

    // Recent activity-standard mappings (last 4 weeks)
    supabase
      .from('activity_standards')
      .select('activity_id, standard_id, standards(id, code, description)')
      .order('created_at', { ascending: false }),
  ]);

  // Process school day number
  let schoolDayNumber: number | null = null;
  if (schoolDayResult.count !== null && schoolDayResult.count !== undefined) {
    schoolDayNumber = schoolDayResult.count;
  }

  // Process calendar events this week
  const calendarEventsThisWeek = (weekEventsResult.data || []) as CalendarEventRow[];

  // Process approved bellringers
  const approvedBellringers = (approvedBellringersResult.data || []) as BellringerRow[];

  // Process recent bellringers
  const recentBellringers = (recentBellringersResult.data || []) as BellringerRow[];

  // Extract recent ACT skills and journal types
  const recentACTSkills = recentBellringers
    .map(b => b.act_skill)
    .filter((s): s is string => Boolean(s));

  const recentJournalTypes = recentBellringers
    .map(b => b.journal_type)
    .filter((t): t is string => Boolean(t));

  // Process classes and build class history
  const classes = (classesResult.data || []) as ClassRow[];
  const classHistory: ClassHistory[] = [];

  // Fetch recent activities for each class (or for specific class if provided)
  const classesToFetch = options?.classId
    ? classes.filter(c => c.id === options.classId)
    : classes;

  for (const cls of classesToFetch) {
    try {
      const { data: activities } = await supabase
        .from('activities')
        .select('date, title, description, activity_type, is_done')
        .eq('class_id', cls.id)
        .order('date', { ascending: false })
        .limit(10);

      classHistory.push({
        classId: cls.id,
        className: cls.name,
        recentActivities: (activities || []).map(a => ({
          date: a.date,
          title: a.title,
          description: a.description,
          activity_type: a.activity_type,
          is_done: a.is_done,
        })),
      });
    } catch {
      // Skip this class if query fails
      classHistory.push({
        classId: cls.id,
        className: cls.name,
        recentActivities: [],
      });
    }
  }

  // Process upcoming events
  const upcomingEvents = (upcomingEventsResult.data || []) as CalendarEventRow[];

  // Process recent lesson plans with their activities
  const recentPlans = (recentPlansResult.data || []) as LessonPlanRow[];
  const recentLessonPlans: (LessonPlanRow & { activities: ActivityRow[] })[] = [];

  for (const plan of recentPlans) {
    try {
      const { data: planActivities } = await supabase
        .from('activities')
        .select('id, class_id, date, title, description, activity_type, is_done, classes(id, name, periods, color)')
        .eq('lesson_plan_id', plan.id)
        .order('date', { ascending: true })
        .order('sort_order', { ascending: true });

      recentLessonPlans.push({
        ...plan,
        activities: (planActivities || []) as unknown as ActivityRow[],
      });
    } catch {
      recentLessonPlans.push({
        ...plan,
        activities: [],
      });
    }
  }

  // Detect standards gaps: standards not used in the last 4 weeks
  const standardsGaps: StandardsGap[] = [];
  const allStandards = (allStandardsResult.data || []) as StandardRow[];
  const recentStandardMappings = (recentActivityStandardsResult.data || []) as unknown as ActivityStandardRow[];

  if (allStandards.length > 0) {
    // Get all activities from the last 4 weeks to check their dates
    const { data: recentActivities } = await supabase
      .from('activities')
      .select('id, date')
      .gte('date', fourWeeksAgoStr)
      .lte('date', today);

    const recentActivityIds = new Set((recentActivities || []).map(a => a.id));

    // Build a map of standard_id -> last activity date
    const standardLastUsed: Map<number, string> = new Map();
    for (const mapping of recentStandardMappings) {
      const stdId = mapping.standard_id;
      // Check if this mapping's activity is recent
      if (recentActivityIds.has(mapping.activity_id)) {
        const activity = (recentActivities || []).find(a => a.id === mapping.activity_id);
        if (activity?.date) {
          const existing = standardLastUsed.get(stdId);
          if (!existing || activity.date > existing) {
            standardLastUsed.set(stdId, activity.date);
          }
        }
      }
    }

    // Find standards that haven't been used recently
    for (const std of allStandards) {
      const lastUsed = standardLastUsed.get(std.id) || null;
      if (!lastUsed) {
        // Never used or not used in our activity history
        standardsGaps.push({
          standardId: std.id,
          code: std.code,
          description: std.description,
          lastUsed: null,
          daysSinceUsed: null,
        });
      } else {
        const lastDate = new Date(lastUsed + 'T12:00:00');
        const diffMs = todayDate.getTime() - lastDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays >= 28) {
          standardsGaps.push({
            standardId: std.id,
            code: std.code,
            description: std.description,
            lastUsed,
            daysSinceUsed: diffDays,
          });
        }
      }
    }
  }

  return {
    today,
    dayOfWeek,
    schoolDayNumber,
    calendarEventsThisWeek,
    approvedBellringers,
    recentBellringers,
    recentACTSkills,
    recentJournalTypes,
    classHistory,
    standardsGaps,
    upcomingEvents,
    recentLessonPlans,
  };
}
