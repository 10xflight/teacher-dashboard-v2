import { chatWithAI, generateWithRetry, getAIConfig, getGeminiModel, cleanJsonResponse } from './ai-service';

interface ChatMessage {
  role: string;
  content: string;
}

interface BrainstormContext {
  classes?: { id: number; name: string; periods?: string | null }[];
  weekOf?: string;
  existingActivities?: string[];
  teacherName?: string;
  schoolName?: string;
}

interface ParsedActivity {
  class_id: number;
  title: string;
  description: string;
  activity_type: string;
  material_status: string;
}

interface ParsedDay {
  date: string;
  activities: ParsedActivity[];
}

interface ParseResult {
  days: ParsedDay[];
}

function buildBrainstormPrompt(teacherName?: string, schoolName?: string): string {
  const name = teacherName || 'Teacher';
  const school = schoolName || 'the school';

  return `You are a helpful AI assistant for a high school English and French teacher (${name}) at ${school}.

You are helping them brainstorm and plan their week of lessons. Your role is to:
- Suggest creative activities, games, discussions, and lesson ideas
- Ask clarifying questions about what topics they're covering, what texts they're reading, etc.
- Offer variety: mix lectures, group work, games, writing exercises, discussions, and hands-on activities
- Consider pacing across the week (don't front-load everything)
- Be aware they teach both English and French classes
- Keep suggestions practical for a rural Oklahoma high school
- Be conversational and collaborative, not just listing things

IMPORTANT: Do NOT suggest bellringers, journal prompts, warm-ups, or daily openers. Bellringers are handled by a completely separate system. Focus ONLY on the main lesson activities, games, projects, assessments, and classwork.

When suggesting activities, think about:
- Engagement level (students should WANT to participate)
- Material prep needed (keep it realistic)
- Variety of activity types throughout the week
- Building on previous days' work
- Fun games like Jeopardy, relay races, Four Corners, vocabulary bingo, etc.

When you've discussed enough activities to fill a full week for each class, let the teacher know they can click the "Generate Plan" button at the top of the chat to populate their weekly grid automatically. Do NOT try to format activities into a structured plan yourself — the system does that automatically when they click the button.

Keep your responses concise but helpful. Ask follow-up questions to understand what they need.`;
}

/**
 * Send a brainstorm conversation to the AI and get the response.
 * Uses whichever provider is configured (Gemini or Anthropic).
 */
export async function brainstormWithAI(
  messages: ChatMessage[],
  context: BrainstormContext
): Promise<{ response: string; error: string | null }> {
  // Build context string
  let contextStr = '';
  if (context.weekOf) {
    contextStr += `\nPlanning for the week of: ${context.weekOf}`;
  }
  if (context.classes && context.classes.length > 0) {
    contextStr += `\nClasses: ${context.classes.map(c => `${c.name}${c.periods ? ` (${c.periods})` : ''}`).join(', ')}`;
  }
  if (context.existingActivities && context.existingActivities.length > 0) {
    contextStr += `\nAlready planned: ${context.existingActivities.join(', ')}`;
  }

  const systemPrompt = buildBrainstormPrompt(context.teacherName, context.schoolName) + (contextStr ? `\n\nCurrent context:${contextStr}` : '');

  try {
    const text = await chatWithAI(systemPrompt, messages, {
      temperature: 0.9,
      maxOutputTokens: 2000,
    });
    return { response: text, error: null };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return { response: '', error: `Brainstorm failed: ${errMsg}` };
  }
}

const PARSE_SYSTEM_PROMPT = `You are a lesson plan parser. Given a brainstorm conversation between a teacher and an AI assistant, extract ALL planned activities and organize them by day and class.

Output ONLY valid JSON in this exact format:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "activities": [
        {
          "class_id": <number>,
          "title": "Short activity title",
          "description": "Brief description of the activity",
          "activity_type": "lesson|game|discussion|writing|assessment|warmup|review|project|homework",
          "material_status": "not_needed|needs_material"
        }
      ]
    }
  ]
}

RULES:
- Extract every concrete activity mentioned in the conversation
- If a specific day isn't mentioned, distribute activities sensibly across the week
- Set material_status to "needs_material" for activities that need worksheets, handouts, slides, or game materials
- Set material_status to "not_needed" for discussions, reading aloud, verbal activities, etc.
- Use the correct class_id from the provided class list
- Keep titles concise (3-8 words)
- Keep descriptions to 1-2 sentences
- If the conversation is too vague to extract activities, return {"days": []} with empty days
- Do NOT invent activities that weren't discussed
- Do NOT include bellringers, journal prompts, warm-ups, or daily openers — those are handled by a separate system
- Each day should have at least an activity per class if discussed`;

/**
 * Parse a brainstorm conversation into structured activities per day per class.
 */
export async function parseBrainstormToActivities(
  brainstormHistory: ChatMessage[],
  classes: { id: number; name: string }[],
  weekDates: string[]
): Promise<{ result: ParseResult | null; error: string | null }> {
  const classListStr = classes.map(c => `ID ${c.id}: ${c.name}`).join('\n');
  const datesStr = weekDates.join(', ');

  const conversationStr = brainstormHistory
    .map(msg => `${msg.role === 'user' ? 'TEACHER' : 'AI'}: ${msg.content}`)
    .join('\n\n');

  const userPrompt = `CLASSES:
${classListStr}

WEEK DATES (Mon-Fri): ${datesStr}

BRAINSTORM CONVERSATION:
${conversationStr}

Parse this conversation into structured activities. Output ONLY valid JSON.`;

  try {
    const aiConfig = await getAIConfig();

    // For Anthropic, generateWithRetry handles everything
    // For Gemini, we pass the model
    const model = aiConfig.provider === 'gemini'
      ? getGeminiModel(aiConfig.geminiApiKey, aiConfig.geminiModel)
      : null;

    if (aiConfig.provider === 'gemini' && !model) {
      return { result: null, error: 'Gemini API key not configured. Go to Settings to add your API key.' };
    }

    const result = await generateWithRetry(
      model,
      PARSE_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.3, maxOutputTokens: 4000 }
    );

    const parsed = result as unknown as ParseResult;
    if (!parsed.days || !Array.isArray(parsed.days)) {
      throw new Error('Invalid response structure: missing days array');
    }

    return { result: parsed, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { result: null, error: `Parse failed: ${msg}` };
  }
}
