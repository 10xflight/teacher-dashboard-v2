import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { chatWithAI, cleanJsonResponse } from '@/lib/ai-service';
import { getRefineSystemPrompt } from '@/lib/material-refiner';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { supabase } = auth;

    const body = await request.json();
    const { activity_id, material_type, message, chat_history, current_material } = body;

    if (!activity_id || !material_type || !message?.trim()) {
      return NextResponse.json(
        { error: 'activity_id, material_type, and message are required' },
        { status: 400 },
      );
    }

    // Fetch activity for context
    const { data: activity } = await supabase
      .from('activities')
      .select('title, class_id, classes(name)')
      .eq('id', activity_id)
      .single();

    const activityTitle = activity?.title || 'Unknown Activity';
    const classes = activity?.classes as unknown as { name: string } | null;
    const className = classes?.name || 'Unknown Class';

    // Build system prompt
    const systemPrompt = getRefineSystemPrompt(material_type, activityTitle, className);

    // Build message history for the AI
    // Include current material JSON as context in the first message
    const materialContext = `Here is the current material JSON:\n\`\`\`json\n${JSON.stringify(current_material, null, 2)}\n\`\`\``;

    const messages = [
      { role: 'user', content: materialContext },
      { role: 'assistant', content: 'I have the current material. What changes would you like me to make?' },
      // Include any prior conversation (skip duplicate first messages)
      ...(chat_history || []).filter((_: { role: string; content: string }, i: number) => i >= 0).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message.trim() },
    ];

    // Call AI
    const rawResponse = await chatWithAI(systemPrompt, messages, {
      temperature: 0.7,
      maxOutputTokens: 8000,
    });

    // Parse: look for JSON code fence, and text after it
    let updatedMaterial = current_material;
    let responseText = rawResponse;

    const jsonMatch = rawResponse.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        updatedMaterial = cleanJsonResponse(jsonMatch[1]);
        // Preserve material_type
        updatedMaterial.material_type = material_type;
        // Get the text after the code fence
        const afterFence = rawResponse.substring(rawResponse.lastIndexOf('```') + 3).trim();
        responseText = afterFence || 'Done! I\'ve updated the material.';
      } catch {
        // If JSON parsing fails, just return the text response
        responseText = rawResponse;
      }
    }

    return NextResponse.json({
      material: updatedMaterial,
      response: responseText,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
