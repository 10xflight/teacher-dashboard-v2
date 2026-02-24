'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import type { Bellringer, BellringerPrompt, PromptCard } from '@/lib/types';
import { TYPE_LABELS } from '@/lib/types';

// Card accent colors matching v1 display
const CARD_COLORS = [
  { bg: 'rgba(78, 205, 196, 0.12)', border: '#4ECDC4' },
  { bg: 'rgba(232, 168, 124, 0.12)', border: '#E8A87C' },
  { bg: 'rgba(155, 89, 182, 0.12)', border: '#9B59B6' },
  { bg: 'rgba(52, 152, 219, 0.12)', border: '#3498DB' },
];

function splitEmojis(text: string): { instruction: string; emojis: string } {
  if (!text) return { instruction: '', emojis: '' };
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2702}-\u{27B0}\u{FE00}-\u{FE0F}\u{200D}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+/gu;
  const matches = text.match(emojiRegex);
  const emojis = matches ? matches.join('') : '';
  let instruction = text.replace(emojiRegex, '').trim();
  instruction = instruction.replace(/[\s:,]+$/, '').trim();
  return { instruction, emojis };
}

export default function DisplayPage() {
  const params = useParams();
  const dateStr = params.date === 'today'
    ? new Date().toISOString().split('T')[0]
    : String(params.date);

  const [bellringer, setBellringer] = useState<Bellringer | null>(null);
  const [promptCards, setPromptCards] = useState<PromptCard[]>([]);
  const [actAnswerText, setActAnswerText] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const promptTextRefs = useRef<(HTMLDivElement | null)[]>([]);

  const totalPages = 3;

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/bellringers/${dateStr}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      if (!data?.bellringer) { setLoading(false); return; }

      const b = data.bellringer;
      setBellringer(b);

      // Build prompt cards from bellringer_prompts
      const cards: PromptCard[] = [];
      const prompts: BellringerPrompt[] = data.prompts || [];

      for (const p of prompts) {
        if (p.journal_prompt) {
          const ptype = p.journal_type || 'creative';
          const card: PromptCard = {
            type: ptype,
            label: TYPE_LABELS[ptype] || 'Creative',
            text: p.journal_prompt,
            image: p.image_path || null,
            emojis: '',
          };
          if (ptype === 'emoji') {
            const { instruction, emojis } = splitEmojis(p.journal_prompt);
            card.text = instruction || p.journal_prompt;
            card.emojis = emojis;
          }
          cards.push(card);
        }
      }

      // Fallback: legacy main prompt if no stored prompts
      if (cards.length === 0 && b.journal_prompt) {
        cards.push({
          type: b.journal_type || 'creative',
          label: TYPE_LABELS[b.journal_type] || 'Creative',
          text: b.journal_prompt,
          image: b.journal_image_path || null,
        });
      }

      setPromptCards(cards);

      // Build answer text
      const letter = (b.act_correct_answer || '').trim().toUpperCase();
      const choiceMap: Record<string, string> = {
        A: b.act_choice_a || '',
        B: b.act_choice_b || '',
        C: b.act_choice_c || '',
        D: b.act_choice_d || '',
      };
      setActAnswerText(choiceMap[letter] || letter);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh on tab visibility
  useEffect(() => {
    const handler = () => { if (!document.hidden) fetchData(); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [fetchData]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          setCurrentPage(p => Math.min(p + 1, totalPages - 1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentPage(p => Math.max(p - 1, 0));
          break;
        case 'f':
        case 'F':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            window.location.href = '/';
          }
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Auto-fit text for prompt cards
  useEffect(() => {
    const fit = () => {
      promptTextRefs.current.forEach((el, idx) => {
        if (!el) return;
        const card = el.closest('[data-card]') as HTMLElement;
        if (!card) return;
        if (promptCards[idx]?.type === 'emoji') return;

        const cardH = card.clientHeight;
        const typeLabel = card.querySelector('[data-type-label]') as HTMLElement;
        const labelH = typeLabel ? typeLabel.offsetHeight : 0;
        const gap = 6;
        const padV = 32;
        const maxH = cardH - labelH - gap - padV;

        el.style.flex = 'none';
        el.style.overflow = 'visible';

        let size = 3.2;
        el.style.fontSize = `${size}rem`;
        el.style.lineHeight = '1.3';

        while (el.scrollHeight > maxH && size > 1.0) {
          size -= 0.1;
          el.style.fontSize = `${size}rem`;
        }

        el.style.flex = '1 1 0';
        el.style.overflow = 'hidden';
      });
    };
    const timer = setTimeout(fit, 100);
    window.addEventListener('resize', fit);
    return () => { clearTimeout(timer); window.removeEventListener('resize', fit); };
  }, [promptCards, currentPage]);

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: '#1a1a2e' }}>
        <div className="text-2xl" style={{ color: '#6c7a96' }}>Loading...</div>
      </div>
    );
  }

  if (!bellringer) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center gap-5" style={{ background: '#1a1a2e' }}>
        <h2 className="text-3xl" style={{ color: '#6c7a96' }}>No Bellringer for {dateStr}</h2>
        <p className="text-lg" style={{ color: '#6c7a96' }}>Go to the dashboard to generate or create one.</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ background: '#1a1a2e', color: '#FFFFFF', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* PAGE 1: JOURNAL */}
      <div
        className={`w-screen h-screen flex-col ${currentPage === 0 ? 'flex' : 'hidden'}`}
        style={{ padding: '12px 60px 12px' }}
      >
        {/* 2x2 Grid */}
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3.5 overflow-hidden min-h-0">
          {promptCards.slice(0, 4).map((card, i) => (
            <div
              key={i}
              data-card
              className="rounded-2xl flex flex-col gap-1.5 overflow-hidden min-h-0"
              style={{
                background: CARD_COLORS[i]?.bg || CARD_COLORS[0].bg,
                borderLeft: `5px solid ${CARD_COLORS[i]?.border || CARD_COLORS[0].border}`,
                padding: '16px 20px',
              }}
            >
              <span
                data-type-label
                className="text-base uppercase tracking-widest font-bold shrink-0"
                style={{ color: CARD_COLORS[i]?.border || CARD_COLORS[0].border }}
              >
                {card.label}
              </span>

              {card.image && (
                <img
                  src={card.image}
                  alt=""
                  className="float-right w-[45%] max-h-[80%] object-contain rounded-lg ml-3 mb-2"
                />
              )}

              <div
                ref={el => { promptTextRefs.current[i] = el; }}
                className="flex-1 overflow-hidden whitespace-pre-line min-h-0"
                style={{ fontSize: card.type === 'emoji' ? '1.3rem' : '1.6rem', lineHeight: '1.3' }}
                dangerouslySetInnerHTML={{ __html: card.text }}
              />

              {card.emojis && (
                <div className="text-center flex-1 flex items-center justify-center min-h-0 overflow-hidden break-all"
                  style={{ fontSize: '4rem', lineHeight: '1.2', letterSpacing: '10px' }}>
                  {card.emojis}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* PAGE 2: ACT QUESTION */}
      <div
        className={`w-screen h-screen flex-col ${currentPage === 1 ? 'flex' : 'hidden'}`}
        style={{ padding: '12px 60px 12px' }}
      >
        <div className="flex-1 flex flex-col justify-center gap-4 overflow-hidden min-h-0">
          <div className="text-xl text-center font-semibold shrink-0" style={{ color: '#4ECDC4' }}>
            {bellringer.act_skill}
          </div>
          <div
            className="text-xl text-center mx-auto max-w-[920px] overflow-y-auto max-h-[33vh]"
            style={{ lineHeight: '1.55' }}
            dangerouslySetInnerHTML={{ __html: bellringer.act_question || '' }}
          />
          <ul className="flex flex-col gap-2.5 max-w-[850px] mx-auto w-full shrink-0">
            {[bellringer.act_choice_a, bellringer.act_choice_b, bellringer.act_choice_c, bellringer.act_choice_d]
              .filter(Boolean)
              .map((choice, i) => (
                <li
                  key={i}
                  className="text-xl rounded-xl"
                  style={{
                    padding: '12px 22px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    lineHeight: '1.35',
                  }}
                >
                  {choice}
                </li>
              ))}
          </ul>
        </div>
      </div>

      {/* PAGE 3: ACT ANSWER */}
      <div
        className={`w-screen h-screen flex-col ${currentPage === 2 ? 'flex' : 'hidden'}`}
        style={{ padding: '12px 60px 12px' }}
      >
        <div className="flex-1 flex flex-col justify-center items-center gap-6 overflow-hidden min-h-0 px-10">
          <div
            className="text-4xl font-bold text-center rounded-2xl shrink-0"
            style={{ background: '#FFFF00', color: '#111', padding: '18px 60px' }}
          >
            {actAnswerText}
          </div>
          <div
            className="text-xl font-semibold text-center rounded-2xl max-w-[880px] shrink-0"
            style={{ background: '#FFFF00', color: '#111', padding: '14px 40px' }}
          >
            {bellringer.act_rule}
          </div>
        </div>
      </div>

      {/* NAV ARROWS */}
      <button
        onClick={() => setCurrentPage(p => Math.max(p - 1, 0))}
        className="fixed top-1/2 left-2 -translate-y-1/2 z-50 flex items-center justify-center text-3xl cursor-pointer rounded-lg select-none transition-all"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff',
          width: '52px',
          height: '90px',
          opacity: 0.35,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.35'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      >
        &#9664;
      </button>
      <button
        onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages - 1))}
        className="fixed top-1/2 right-2 -translate-y-1/2 z-50 flex items-center justify-center text-3xl cursor-pointer rounded-lg select-none transition-all"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff',
          width: '52px',
          height: '90px',
          opacity: 0.35,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.35'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      >
        &#9654;
      </button>

    </div>
  );
}
