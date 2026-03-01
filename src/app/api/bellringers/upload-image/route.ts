import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateBellringer } from '@/lib/db';
import { generateFromImage } from '@/lib/bellringer-generator';
import { requireAuth } from '@/lib/auth';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const date = formData.get('date') as string | null;
    const slotStr = formData.get('slot') as string | null;
    const generatePromptFlag = formData.get('generate_prompt') as string | null;

    if (!imageFile || !date || slotStr === null) {
      return NextResponse.json(
        { error: 'image, date, and slot are required' },
        { status: 400 }
      );
    }

    // Enforce file size limit
    if (imageFile.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 10MB.' },
        { status: 413 }
      );
    }

    const slot = parseInt(slotStr, 10);

    // Read file as buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = imageFile.type || 'image/png';

    // Generate a unique filename
    const ext = mimeType.split('/')[1] || 'png';
    const filename = `bellringer_${date}_slot${slot}_${Date.now()}.${ext}`;
    const storagePath = `bellringers/${filename}`;

    // Upload to Supabase Storage bucket 'uploads'
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData.publicUrl;

    // Get or create bellringer
    const { id: bellringerId } = await getOrCreateBellringer(date, supabase, user.id);

    // Update bellringer_prompts image_path
    const { error: upsertError } = await supabase
      .from('bellringer_prompts')
      .upsert(
        {
          bellringer_id: bellringerId,
          slot: slot,
          image_path: publicUrl,
        },
        { onConflict: 'bellringer_id,slot' }
      );

    if (upsertError) throw upsertError;

    // Optionally generate prompt from image
    let generatedPrompt = null;
    if (generatePromptFlag === 'true' || generatePromptFlag === '1') {
      const base64 = buffer.toString('base64');
      const notes = (formData.get('notes') as string) || '';
      const { result, error: genError } = await generateFromImage(base64, mimeType, notes);

      if (!genError && result) {
        // Update the prompt fields on the same slot
        await supabase
          .from('bellringer_prompts')
          .upsert(
            {
              bellringer_id: bellringerId,
              slot: slot,
              image_path: publicUrl,
              journal_type: result.journal_type as string || 'image',
              journal_prompt: result.journal_prompt as string || null,
              journal_subprompt: result.journal_subprompt as string || 'WRITE A PARAGRAPH IN YOUR JOURNAL!',
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
