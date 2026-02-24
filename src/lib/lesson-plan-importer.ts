import mammoth from 'mammoth';
import { getAIConfig, getGeminiModel, cleanJsonResponse, generateWithRetry } from './ai-service';

interface ParsedActivity {
  class_name: string;
  title: string;
  description: string;
  activity_type: string;
}

interface ParsedDay {
  date: string;
  day_name: string;
  activities: ParsedActivity[];
}

interface ImportResult {
  days: ParsedDay[];
}

const IMPORT_SYSTEM_PROMPT = `You are a lesson plan document parser for a high school English and French teacher.

Parse this lesson plan document. Extract activities organized by day (Monday-Friday) and class.

The teacher typically teaches these classes: English-1, English-2, and French-1.
- Look for mentions of class names, period numbers, or subject headings
- Match activities to the correct class based on context clues
- If a class name is ambiguous, use your best judgment based on the content (French activities for French class, etc.)

Return ONLY valid JSON in this exact format:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "day_name": "Monday",
      "activities": [
        {
          "class_name": "English-1",
          "title": "Short activity title (3-8 words)",
          "description": "Brief description of the activity (1-2 sentences)",
          "activity_type": "lesson|game|discussion|writing|assessment|warmup|review|project|homework"
        }
      ]
    }
  ]
}

RULES:
- Extract every concrete activity mentioned in the document
- Keep titles concise (3-8 words)
- Keep descriptions to 1-2 sentences
- Use the correct activity_type based on the nature of the activity
- If a specific date isn't in the document, use the provided week dates
- If a class is not mentioned, omit it for that day
- Do NOT invent activities that aren't in the document
- Preserve the original intent and content of each activity`;

export async function importLessonPlanDocx(
  buffer: Buffer,
  weekOf: string
): Promise<{ result: ImportResult | null; error: string | null }> {
  // Step 1: Extract text from Word doc
  let extractedText: string;
  try {
    const mammothResult = await mammoth.convertToHtml({ buffer });
    extractedText = mammothResult.value;

    const plainResult = await mammoth.extractRawText({ buffer });
    const plainText = plainResult.value;

    if (!extractedText || extractedText.trim().length < 20) {
      extractedText = plainText;
    }

    if (!extractedText || extractedText.trim().length < 10) {
      return { result: null, error: 'Could not extract text from the document. The file may be empty or corrupted.' };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { result: null, error: `Failed to read Word document: ${msg}` };
  }

  // Step 2: Calculate Mon-Fri dates
  const weekDates = getWeekDates(weekOf);
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dateMap = weekDates.map((date, i) => `${dayNames[i]}: ${date}`).join(', ');

  // Step 3: Send to AI for parsing
  const userPrompt = `WEEK DATES: ${dateMap}

LESSON PLAN DOCUMENT CONTENT:
${extractedText}

Parse this lesson plan document into structured activities. Output ONLY valid JSON.`;

  try {
    const aiConfig = await getAIConfig();
    const model = aiConfig.provider === 'gemini'
      ? getGeminiModel(aiConfig.geminiApiKey, aiConfig.geminiModel)
      : null;

    if (aiConfig.provider === 'gemini' && !model) {
      return { result: null, error: 'Gemini API key not configured. Go to Settings to add your API key.' };
    }

    const result = await generateWithRetry(
      model,
      IMPORT_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.3, maxOutputTokens: 4000 }
    );

    const parsed = result as unknown as ImportResult;

    if (!parsed.days || !Array.isArray(parsed.days)) {
      throw new Error('Invalid response structure: missing days array');
    }

    // Fill in missing dates
    for (const day of parsed.days) {
      if (!day.activities || !Array.isArray(day.activities)) {
        day.activities = [];
      }
      if (!day.date && day.day_name) {
        const dayIndex = dayNames.findIndex(
          d => d.toLowerCase() === day.day_name.toLowerCase()
        );
        if (dayIndex !== -1) {
          day.date = weekDates[dayIndex];
        }
      }
    }

    return { result: parsed, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { result: null, error: `Failed to parse lesson plan: ${msg}` };
  }
}

function getWeekDates(weekOf: string): string[] {
  const d = new Date(weekOf + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);

  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const current = new Date(d);
    current.setDate(d.getDate() + i);
    dates.push(current.toISOString().split('T')[0]);
  }
  return dates;
}
