import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Look up the lesson plan by token
    const { data: plan, error: planError } = await supabase
      .from('lesson_plans')
      .select('id')
      .eq('publish_token', token)
      .eq('status', 'published')
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Published lesson plan not found' },
        { status: 404 }
      );
    }

    // Fetch all comments for this lesson plan
    const { data: comments, error: commentsError } = await supabase
      .from('lesson_plan_comments')
      .select('id, parent_id, author_role, author_name, content, created_at')
      .eq('lesson_plan_id', plan.id)
      .order('created_at', { ascending: true });

    if (commentsError) {
      return NextResponse.json(
        { error: commentsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(comments ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { author_name, author_role, content, parent_id } = body;

    if (!author_name?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: 'author_name and content are required' },
        { status: 400 }
      );
    }

    // Look up the lesson plan by token
    const { data: plan, error: planError } = await supabase
      .from('lesson_plans')
      .select('id')
      .eq('publish_token', token)
      .eq('status', 'published')
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Published lesson plan not found' },
        { status: 404 }
      );
    }

    // Insert the new comment
    const { data: comment, error: insertError } = await supabase
      .from('lesson_plan_comments')
      .insert({
        lesson_plan_id: plan.id,
        author_name: author_name.trim(),
        author_role: author_role?.trim() || 'principal',
        content: content.trim(),
        parent_id: parent_id || null,
      })
      .select('id, parent_id, author_role, author_name, content, created_at')
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { comment_id, content } = body;

    if (!comment_id || !content?.trim()) {
      return NextResponse.json(
        { error: 'comment_id and content are required' },
        { status: 400 }
      );
    }

    // Verify the plan exists
    const { data: plan, error: planError } = await supabase
      .from('lesson_plans')
      .select('id')
      .eq('publish_token', token)
      .eq('status', 'published')
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Published lesson plan not found' },
        { status: 404 }
      );
    }

    const { data: comment, error: updateError } = await supabase
      .from('lesson_plan_comments')
      .update({ content: content.trim() })
      .eq('id', comment_id)
      .eq('lesson_plan_id', plan.id)
      .select('id, parent_id, author_role, author_name, content, created_at')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(comment);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('comment_id');

    if (!commentId) {
      return NextResponse.json(
        { error: 'comment_id query param is required' },
        { status: 400 }
      );
    }

    // Verify the plan exists
    const { data: plan, error: planError } = await supabase
      .from('lesson_plans')
      .select('id')
      .eq('publish_token', token)
      .eq('status', 'published')
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Published lesson plan not found' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabase
      .from('lesson_plan_comments')
      .delete()
      .eq('id', parseInt(commentId))
      .eq('lesson_plan_id', plan.id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
