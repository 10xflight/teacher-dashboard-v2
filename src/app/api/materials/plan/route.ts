import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { chatWithAI } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { material_type, message, chat_history, activity_title, class_name } = await request.json();

    if (!material_type || !message?.trim()) {
      return NextResponse.json(
        { error: 'material_type and message are required' },
        { status: 400 },
      );
    }

    const typeName = material_type.replace(/_/g, ' ');

    const systemPrompt = `You are helping a high school teacher plan a ${typeName} for their class.

CONTEXT:
- Activity: ${activity_title || 'Unknown Activity'}
- Class: ${class_name || 'Unknown Class'}

YOUR JOB: Ask 1-2 brief clarifying questions to understand exactly what the teacher wants before the material is generated. Keep responses to 2-3 short sentences max. Be conversational and helpful.

Examples of good clarifying questions:
- What specific topic, chapter, or text should this cover?
- How many questions/items would you like?
- Any specific format preferences? (e.g., multiple choice vs short answer)
- What difficulty level? (introductory, review, challenging)
- Any vocabulary or concepts to focus on?

If you already have enough information, say something like "Got it! Click Generate whenever you're ready." Don't ask more than 2 rounds of questions total.`;

    const messages = [
      ...(chat_history || []).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message.trim() },
    ];

    const response = await chatWithAI(systemPrompt, messages, {
      temperature: 0.7,
      maxOutputTokens: 300,
    });

    return NextResponse.json({ response });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
