import { supabase } from './db';
import type { SubDashSnapshot, ScheduleEntry, SubDashPeriod, SubDashMediaItem } from './types';

export async function generateSubDashSnapshot(
  dateStr: string,
  customNotes: string | null,
  mediaIds: number[],
  origin: string
): Promise<{ data: SubDashSnapshot | null; error: string | null }> {
  try {
    // 1. Fetch classroom profile
    const { data: profileRows } = await supabase
      .from('classroom_profiles')
      .select('key, value');

    const profile: Record<string, string> = {};
    for (const row of profileRows ?? []) {
      profile[row.key] = row.value;
    }

    // 2. Fetch settings
    const { data: settingsRows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['teacher_name', 'school_name']);

    const settings: Record<string, string> = {};
    for (const row of settingsRows ?? []) {
      settings[row.key] = row.value;
    }

    // 3. Fetch classes
    const { data: classes } = await supabase
      .from('classes')
      .select('*')
      .order('id', { ascending: true });

    const classMap = new Map<number, { name: string; periods: string | null }>();
    for (const c of classes ?? []) {
      classMap.set(c.id, { name: c.name, periods: c.periods });
    }

    // 4. Fetch activities for date
    const { data: activities } = await supabase
      .from('activities')
      .select('*, classes(name, periods)')
      .eq('date', dateStr)
      .order('class_id', { ascending: true })
      .order('sort_order', { ascending: true });

    // Group activities by class_id
    const activitiesByClass = new Map<number, Array<{
      title: string;
      description: string | null;
      activity_type: string;
      material_file_path: string | null;
    }>>();
    for (const a of activities ?? []) {
      if (!activitiesByClass.has(a.class_id)) {
        activitiesByClass.set(a.class_id, []);
      }
      activitiesByClass.get(a.class_id)!.push({
        title: a.title,
        description: a.description,
        activity_type: a.activity_type,
        material_file_path: a.material_file_path,
      });
    }

    // 5. Fetch bellringer + prompts
    const { data: bellringer } = await supabase
      .from('bellringers')
      .select('*')
      .eq('date', dateStr)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    let bellringerData: SubDashSnapshot['bellringer'] = null;
    if (bellringer) {
      const { data: prompts } = await supabase
        .from('bellringer_prompts')
        .select('*')
        .eq('bellringer_id', bellringer.id)
        .order('slot', { ascending: true });

      let promptList = (prompts ?? []).map(p => ({
        type: p.journal_type || 'prompt',
        prompt: p.journal_prompt || '',
      })).filter(p => p.prompt);

      if (promptList.length === 0 && bellringer.journal_prompt) {
        promptList = [{ type: bellringer.journal_type || 'prompt', prompt: bellringer.journal_prompt }];
      }

      bellringerData = {
        display_url: `${origin}/display/${dateStr}`,
        prompts: promptList,
        act_question: bellringer.act_question,
        act_choices: [
          bellringer.act_choice_a,
          bellringer.act_choice_b,
          bellringer.act_choice_c,
          bellringer.act_choice_d,
        ].filter(Boolean),
        act_correct: bellringer.act_correct_answer,
        act_explanation: bellringer.act_explanation,
      };
    }

    // 6. Fetch media library items
    let mediaItems: SubDashMediaItem[] = [];
    if (mediaIds.length > 0) {
      const { data: mediaRows } = await supabase
        .from('media_library')
        .select('*')
        .in('id', mediaIds);

      mediaItems = (mediaRows ?? []).map(m => ({
        name: m.name,
        file_path: m.file_path,
        url: m.url,
        media_type: m.media_type,
      }));
    }

    // 7. Parse schedule from profile
    let schedule: ScheduleEntry[] = [];
    if (profile.schedule_json) {
      try { schedule = JSON.parse(profile.schedule_json); } catch { schedule = []; }
    }

    // 8. Build period-by-period instructions
    const periods: SubDashPeriod[] = schedule.map(entry => {
      const classActivities = entry.class_id
        ? activitiesByClass.get(entry.class_id) ?? []
        : [];

      return {
        period: entry.period,
        time: entry.time,
        class_name: entry.class_name,
        instructions: classActivities.map(a => ({
          title: a.title,
          description: a.description,
          activity_type: a.activity_type,
          material_file_path: a.material_file_path,
        })),
      };
    });

    // Parse backup activities
    let backupActivities: string[] = [];
    if (profile.default_backup_activities) {
      try { backupActivities = JSON.parse(profile.default_backup_activities); } catch { backupActivities = []; }
    }

    // Parse seating chart URLs
    let seatingChartUrls: string[] = [];
    if (profile.seating_chart_urls) {
      try { seatingChartUrls = JSON.parse(profile.seating_chart_urls); } catch { seatingChartUrls = []; }
    }

    const snapshot: SubDashSnapshot = {
      date: dateStr,
      teacher_name: settings.teacher_name || 'Teacher',
      school_name: settings.school_name || 'School',
      room_number: profile.room_number || '',
      office_phone: profile.office_phone || '',
      sub_name: null,
      sub_contact: null,
      custom_notes: customNotes,
      schedule,
      periods,
      bellringer: bellringerData,
      management_notes: profile.management_notes || '',
      behavior_policy: profile.behavior_policy || '',
      seating_chart_urls: seatingChartUrls,
      emergency_contacts: profile.emergency_contacts || '',
      standing_instructions: profile.standing_instructions || '',
      backup_activities: backupActivities,
      media: mediaItems,
      generated_at: new Date().toISOString(),
    };

    return { data: snapshot, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
