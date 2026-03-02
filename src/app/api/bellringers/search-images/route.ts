import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const PER_PAGE = 18;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    if (!PIXABAY_API_KEY) {
      return NextResponse.json(
        { error: 'PIXABAY_API_KEY not configured in .env.local' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const page = parseInt(searchParams.get('page') || '1', 10);

    if (!q) {
      return NextResponse.json(
        { error: 'q (search query) is required' },
        { status: 400 }
      );
    }

    const url = new URL('https://pixabay.com/api/');
    url.searchParams.set('key', PIXABAY_API_KEY);
    url.searchParams.set('q', q);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(PER_PAGE));
    url.searchParams.set('safesearch', 'true');
    url.searchParams.set('image_type', 'photo');

    const res = await fetch(url.toString());
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Pixabay API error' },
        { status: res.status }
      );
    }

    const data = await res.json();

    const results = (data.hits || []).map(
      (hit: {
        id: number;
        previewURL: string;
        webformatURL: string;
        tags: string;
      }) => ({
        id: hit.id,
        preview: hit.previewURL,
        web: hit.webformatURL,
        tags: hit.tags,
      })
    );

    const totalHits = data.totalHits || 0;
    const hasMore = page * PER_PAGE < totalHits;

    return NextResponse.json({ results, hasMore });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
