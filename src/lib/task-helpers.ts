import type { ClassInfo } from './types';

/** Convert a Date to YYYY-MM-DD using local timezone (never UTC). */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Parse natural language date input into YYYY-MM-DD string.
 */
export function parseNaturalDate(input: string): string | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();

  // YYYY-MM-DD passthrough
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const toISO = (d: Date) => localDateStr(d);

  // today / tod
  if (s === 'today' || s === 'tod') return toISO(today);

  // tomorrow / tmrw / tmr
  if (s === 'tomorrow' || s === 'tmrw' || s === 'tmr') {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return toISO(d);
  }

  // Day name shortcuts
  const dayMap: Record<string, number> = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tues: 2, tuesday: 2,
    wed: 3, wednesday: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6,
  };

  // "next mon", "next friday"
  const nextMatch = s.match(/^next\s+(\w+)$/);
  if (nextMatch) {
    const dayNum = dayMap[nextMatch[1]];
    if (dayNum !== undefined) {
      const d = new Date(today);
      const currentDay = d.getDay();
      let diff = dayNum - currentDay;
      if (diff <= 0) diff += 7;
      diff += 7; // always next week
      d.setDate(d.getDate() + diff);
      return toISO(d);
    }
  }

  // Day name alone → next occurrence (including today if same day)
  if (dayMap[s] !== undefined) {
    const dayNum = dayMap[s];
    const d = new Date(today);
    const currentDay = d.getDay();
    let diff = dayNum - currentDay;
    if (diff < 0) diff += 7;
    if (diff === 0) diff = 0; // today counts
    d.setDate(d.getDate() + diff);
    return toISO(d);
  }

  // M/D or M-D format
  const mdMatch = s.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (mdMatch) {
    const month = parseInt(mdMatch[1]) - 1;
    const day = parseInt(mdMatch[2]);
    let year = today.getFullYear();
    const candidate = new Date(year, month, day, 12);
    // If the date has passed this year, use next year
    if (candidate < today) {
      year++;
    }
    return toISO(new Date(year, month, day, 12));
  }

  return null;
}

/**
 * Fuzzy match user input to a class. Returns class_id or null for "general".
 */
export function matchClass(input: string, classes: ClassInfo[]): number | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();

  // "general" / "gen" / empty → null (general)
  if (!s || s === 'general' || s === 'gen' || s === 'g') return null;

  // Exact match (case-insensitive)
  const exact = classes.find(c => c.name.toLowerCase() === s);
  if (exact) return exact.id;

  // Prefix match: "eng" → English-1, "fr" → French-1
  const prefix = classes.find(c => c.name.toLowerCase().startsWith(s));
  if (prefix) return prefix.id;

  // Abbreviated: "e1" → English-1, "f1" → French-1, "e2" → English-2
  const abbrMatch = s.match(/^([a-z])(\d+)$/);
  if (abbrMatch) {
    const letter = abbrMatch[1];
    const num = abbrMatch[2];
    const found = classes.find(c => {
      const name = c.name.toLowerCase();
      return name.startsWith(letter) && name.includes(num);
    });
    if (found) return found.id;
  }

  // Partial match anywhere in name
  const partial = classes.find(c => c.name.toLowerCase().includes(s));
  if (partial) return partial.id;

  return null;
}

/**
 * Format a date string for compact display.
 */
export function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T12:00:00');

  // All dates within the next 7 days — show day name + M/D (Today gets special prefix)
  const diffDays = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays >= 0 && diffDays <= 6) {
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    return `${dayName} ${d.getMonth() + 1}/${d.getDate()}`;
  }

  // This year
  if (d.getFullYear() === today.getFullYear()) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Different year
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
