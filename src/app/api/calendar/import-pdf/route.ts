import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getAIConfig, getGeminiModel, cleanJsonResponse } from '@/lib/ai-service';
import Anthropic from '@anthropic-ai/sdk';

interface ParsedCalendarEvent {
  date: string;
  event_type: string;
  title: string;
}

const CALENDAR_PARSE_SYSTEM_PROMPT = `You are a school calendar parser. Parse this school calendar document and extract all dates with events.

Return ONLY valid JSON as an array of events:
[
  {
    "date": "YYYY-MM-DD",
    "event_type": "holiday|break|testing|assembly|school_day|custom",
    "title": "Event name"
  }
]

RULES:
- Extract EVERY date with a meaningful event
- Use consistent date format: YYYY-MM-DD
- Event types:
  - "holiday" = no school (Christmas, Thanksgiving, MLK Day, etc.)
  - "break" = multi-day no school (Spring Break, Fall Break, etc.)
  - "testing" = standardized testing days (ACT, state tests, etc.)
  - "assembly" = school assemblies, pep rallies, etc.
  - "school_day" = regular school days if listed
  - "custom" = anything else (parent-teacher conferences, early dismissal, etc.)
- For date ranges (e.g., "Spring Break March 10-14"), create a separate entry for each date
- For school year start/end dates, use the "school_day" type
- If a year is ambiguous, assume the current or upcoming school year
- Skip vague or unspecific entries that don't have concrete dates
- Keep event titles concise but descriptive`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'A PDF file is required' }, { status: 400 });
    }

    const fileName = (file as File).name || '';
    const mimeType = file.type || 'application/pdf';

    if (!fileName.endsWith('.pdf') && !mimeType.includes('pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    const aiConfig = await getAIConfig();

    let parsedEvents: ParsedCalendarEvent[] = [];
    let lastError: Error | null = null;
    let temperature = 0.2;

    if (aiConfig.provider === 'anthropic') {
      // Anthropic path — PDF via base64 document
      const client = new Anthropic({ apiKey: aiConfig.anthropicApiKey });
      if (!aiConfig.anthropicApiKey) {
        return NextResponse.json({ error: 'Anthropic API key not configured.' }, { status: 500 });
      }

      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const message = await client.messages.create({
            model: aiConfig.anthropicModel,
            max_tokens: 8000,
            temperature: Math.min(temperature, 1.0),
            system: CALENDAR_PARSE_SYSTEM_PROMPT,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
                },
                {
                  type: 'text',
                  text: 'Parse this school calendar PDF. Extract all dates with events. Return ONLY a valid JSON array.',
                },
              ],
            }],
          });

          const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
          parsedEvents = parseEventsFromText(text);

          if (parsedEvents.length === 0) {
            throw new Error('No valid events found in the parsed output');
          }
          lastError = null;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          temperature = Math.max(0.1, temperature - 0.05);
        }
      }
    } else {
      // Gemini path
      const model = getGeminiModel(aiConfig.geminiApiKey, aiConfig.geminiModel);
      if (!model) {
        return NextResponse.json({ error: 'Gemini API key not configured.' }, { status: 500 });
      }

      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const result = await model.generateContent({
            contents: [{
              role: 'user' as const,
              parts: [
                { inlineData: { mimeType: 'application/pdf', data: base64Data } },
                { text: 'Parse this school calendar PDF. Extract all dates with events. Return ONLY a valid JSON array.' },
              ],
            }],
            systemInstruction: {
              role: 'model' as const,
              parts: [{ text: CALENDAR_PARSE_SYSTEM_PROMPT }],
            },
            generationConfig: { temperature, maxOutputTokens: 8000 },
          });

          const text = result.response.text();
          parsedEvents = parseEventsFromText(text);

          if (parsedEvents.length === 0) {
            throw new Error('No valid events found in the parsed output');
          }
          lastError = null;
          break;
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          temperature = Math.max(0.1, temperature - 0.05);
        }
      }
    }

    if (lastError) {
      return NextResponse.json(
        { error: `Failed to parse calendar PDF: ${lastError.message}` },
        { status: 500 }
      );
    }

    if (parsedEvents.length === 0) {
      return NextResponse.json(
        { error: 'No calendar events could be extracted from the PDF' },
        { status: 400 }
      );
    }

    const eventsToInsert = parsedEvents.map((e) => ({
      date: e.date,
      event_type: e.event_type,
      title: e.title,
      notes: `Imported from: ${fileName}`,
    }));

    const { data: insertedEvents, error: insertError } = await supabase
      .from('calendar_events')
      .insert(eventsToInsert)
      .select();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to save calendar events: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      events_created: insertedEvents?.length || 0,
      events: insertedEvents || [],
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================
// Helpers
// ============================================================

function parseEventsFromText(text: string): ParsedCalendarEvent[] {
  const cleaned = cleanMarkdownFences(text);
  let events: ParsedCalendarEvent[];

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      events = parsed;
    } else if (parsed.events && Array.isArray(parsed.events)) {
      events = parsed.events;
    } else {
      const obj = cleanJsonResponse(cleaned);
      events = (obj.events as ParsedCalendarEvent[]) || [];
    }
  } catch {
    try {
      const obj = cleanJsonResponse(text);
      if (Array.isArray(obj)) {
        events = obj as unknown as ParsedCalendarEvent[];
      } else {
        events = (obj.events as ParsedCalendarEvent[]) || [];
      }
    } catch {
      return [];
    }
  }

  return events
    .filter((e) => e.date && e.title && isValidDate(e.date))
    .map((e) => ({
      date: e.date,
      event_type: normalizeEventType(e.event_type),
      title: e.title.trim(),
    }));
}

function cleanMarkdownFences(text: string): string {
  text = text.trim();
  if (text.startsWith('```')) {
    const newlineIdx = text.indexOf('\n');
    text = newlineIdx !== -1 ? text.substring(newlineIdx + 1) : text.substring(3);
  }
  if (text.endsWith('```')) {
    text = text.substring(0, text.length - 3);
  }
  if (text.startsWith('json')) {
    text = text.substring(4);
  }
  return text.trim();
}

function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr + 'T12:00:00');
  return !isNaN(d.getTime());
}

function normalizeEventType(type: string): string {
  if (!type) return 'custom';
  const lower = type.toLowerCase().trim();
  if (lower === 'holiday' || lower.includes('holiday')) return 'holiday';
  if (lower === 'break' || lower.includes('break')) return 'break';
  if (lower === 'testing' || lower.includes('test')) return 'testing';
  if (lower === 'assembly' || lower.includes('assembl') || lower.includes('rally')) return 'assembly';
  if (lower === 'school_day' || lower === 'school day') return 'school_day';
  return 'custom';
}
