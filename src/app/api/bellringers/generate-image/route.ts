import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getOrCreateBellringer } from '@/lib/db';
import { generateFromImage } from '@/lib/bellringer-generator';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const { topic, date, slot, generatePrompt } = await request.json();

    if (!topic || !date || slot === undefined) {
      return NextResponse.json(
        { error: 'topic, date, and slot are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Generate the image using Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Generate a classroom-appropriate illustration for this topic: "${topic}". The image should be colorful, engaging, and suitable for 9th/10th grade students. Do NOT include any text or words in the image.`,
            },
          ],
        },
      ],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    });

    // Extract the image from the response
    let imageBase64: string | null = null;
    let mimeType = 'image/png';

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data ?? null;
          mimeType = part.inlineData.mimeType || 'image/png';
          break;
        }
      }
    }

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'AI did not generate an image. Try a different topic.' },
        { status: 422 }
      );
    }

    // Upload to Supabase Storage
    const buffer = Buffer.from(imageBase64, 'base64');
    const ext = mimeType.split('/')[1] || 'png';
    const filename = `bellringer_${date}_slot${slot}_ai_${Date.now()}.${ext}`;
    const storagePath = `bellringers/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData.publicUrl;

    // Upsert bellringer_prompts.image_path
    const { id: bellringerId } = await getOrCreateBellringer(
      date,
      supabase,
      user.id
    );

    const { error: upsertError } = await supabase
      .from('bellringer_prompts')
      .upsert(
        {
          bellringer_id: bellringerId,
          slot,
          image_path: publicUrl,
        },
        { onConflict: 'bellringer_id,slot' }
      );

    if (upsertError) throw upsertError;

    // Optionally generate a writing prompt from the image
    let generatedPrompt = null;
    if (generatePrompt) {
      const { result, error: genError } = await generateFromImage(
        imageBase64,
        mimeType,
        ''
      );
      if (!genError && result) {
        await supabase
          .from('bellringer_prompts')
          .upsert(
            {
              bellringer_id: bellringerId,
              slot,
              image_path: publicUrl,
              journal_type: (result.journal_type as string) || 'image',
              journal_prompt: (result.journal_prompt as string) || null,
              journal_subprompt:
                (result.journal_subprompt as string) ||
                'WRITE A PARAGRAPH IN YOUR JOURNAL!',
            },
            { onConflict: 'bellringer_id,slot' }
          );
        generatedPrompt = result;
      }
    }

    return NextResponse.json({
      path: publicUrl,
      prompt: generatedPrompt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
