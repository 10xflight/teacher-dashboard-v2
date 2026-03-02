'use client';

import { useState, useRef, useEffect } from 'react';
import type { MaterialType, MaterialCategory } from './types';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

const TYPE_OPENERS: Partial<Record<MaterialType, string>> = {
  quiz: "What topic or chapter should the quiz cover? Any preference for question types (multiple choice, true/false, short answer)?",
  vocabulary_test: "What vocabulary words or topic should the test cover? Roughly how many words?",
  grammar_test: "What grammar concept should the test focus on? (e.g., subject-verb agreement, punctuation, parts of speech)",
  sentence_dressup: "What literary techniques should students practice? Any specific theme or text to connect to?",
  worksheet: "What's the topic? I can include matching, fill-in-the-blank, short answer, multiple choice, and more — any section type preferences?",
  discussion_questions: "What text, topic, or theme should the questions explore? Any specific thinking levels to target?",
  writing_prompt: "What type of writing? (narrative, persuasive, analytical, creative) Any specific topic or text connection?",
  reading_guide: "What text will students be reading? Any specific chapters or page numbers?",
  jeopardy: "What topics should the Jeopardy categories cover? Any specific content areas?",
  dice_game: "What content should the dice game review?",
  card_match: "What concepts should students match? (vocab & definitions, characters & quotes, etc.)",
  relay_race: "What content should the relay questions cover?",
  buzzer_quiz: "What topic should the buzzer quiz cover?",
  guess_who: "What characters or concepts should students guess?",
  four_corners: "What topic should the four corners activity explore?",
  vocab_bingo: "What vocabulary list should the bingo cards use?",
  flashcard_set: "What French vocabulary or topic should the flashcards cover?",
  conjugation_drill: "What French verbs and tenses should the drill focus on?",
  dialogue_builder: "What French conversation scenario should students practice?",
  cultural_activity: "What aspect of French/Francophone culture should the activity explore?",
};

interface MaterialTypePickerProps {
  categories: MaterialCategory[];
  selectedType: MaterialType | null;
  generating: boolean;
  saving: boolean;
  error: string | null;
  generatedMaterial: Record<string, unknown> | null;
  activityId: number;
  activityTitle: string;
  activityClassName: string;
  onGenerate: (type: MaterialType, prompt: string, planHistory?: ChatMsg[]) => void;
  onMarkUploadReady: () => void;
  onMarkReadyNoMaterials: () => void;
  onDismissError: () => void;
}

export default function MaterialTypePicker({
  categories,
  selectedType,
  generating,
  saving,
  error,
  generatedMaterial,
  activityId,
  activityTitle,
  activityClassName,
  onGenerate,
  onMarkUploadReady,
  onMarkReadyNoMaterials,
  onDismissError,
}: MaterialTypePickerProps) {
  const [pickedType, setPickedType] = useState<MaterialType | null>(null);
  const [planHistory, setPlanHistory] = useState<ChatMsg[]>([]);
  const [planInput, setPlanInput] = useState('');
  const [planning, setPlanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // When type is picked, show opener message
  useEffect(() => {
    if (pickedType) {
      const opener = TYPE_OPENERS[pickedType] || 'What would you like this to cover?';
      setPlanHistory([{ role: 'assistant', content: opener }]);
      setPlanInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [pickedType]);

  // Auto-scroll chat
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [planHistory]);

  async function handlePlanSend() {
    const message = planInput.trim();
    if (!message || planning) return;

    setPlanInput('');
    const newHistory: ChatMsg[] = [...planHistory, { role: 'user', content: message }];
    setPlanHistory(newHistory);
    setPlanning(true);

    try {
      const res = await fetch('/api/materials/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_type: pickedType,
          message,
          chat_history: planHistory,
          activity_title: activityTitle,
          class_name: activityClassName,
        }),
      });

      if (!res.ok) throw new Error('Failed to get response');
      const data = await res.json();
      setPlanHistory([...newHistory, { role: 'assistant', content: data.response }]);
    } catch {
      setPlanHistory([
        ...newHistory,
        { role: 'assistant', content: "I had trouble responding. You can keep describing what you want, or click Generate whenever you're ready!" },
      ]);
    } finally {
      setPlanning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleGenerate() {
    if (!pickedType) return;
    // Serialize the full planning conversation as context for generation
    const prompt = planHistory
      .map(m => m.role === 'user' ? `Teacher: ${m.content}` : `Planning Assistant: ${m.content}`)
      .join('\n');
    onGenerate(pickedType, prompt, planHistory);
  }

  function handleBack() {
    setPickedType(null);
    setPlanHistory([]);
    setPlanInput('');
  }

  // If generating, show loading state
  if (generating) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Generating {selectedType?.replace(/_/g, ' ')}...</p>
          <p className="text-xs text-text-muted">This usually takes 10-20 seconds</p>
        </div>
      </div>
    );
  }

  // ── Planning chat view (type is picked) ──
  if (pickedType) {
    return (
      <div className="flex flex-col h-full">
        {/* Header with back button */}
        <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-hover transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {pickedType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h3>
            <p className="text-xs text-text-muted">Describe what you want, then generate</p>
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {planHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent text-white rounded-br-sm'
                  : 'bg-bg-secondary text-text-primary rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {planning && (
            <div className="flex justify-start">
              <div className="bg-bg-secondary rounded-xl px-3 py-2 rounded-bl-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input + Generate */}
        <div className="p-3 border-t border-border shrink-0 space-y-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={planInput}
              onChange={e => setPlanInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (planInput.trim()) handlePlanSend();
                }
              }}
              placeholder="Describe what you want..."
              disabled={planning}
              className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm placeholder:text-text-muted focus:border-accent focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handlePlanSend}
              disabled={!planInput.trim() || planning}
              className="px-3 py-2 text-xs font-semibold text-text-secondary border border-border rounded-lg hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              Send
            </button>
          </div>
          <button
            onClick={handleGenerate}
            disabled={planning}
            className="w-full px-4 py-2.5 bg-accent text-white rounded-lg font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
          >
            Generate {pickedType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-3 mb-3 rounded-lg bg-accent-red/15 border border-accent-red/30 p-3">
            <p className="text-accent-red text-sm">{error}</p>
            <button onClick={onDismissError} className="text-xs text-accent-red/70 hover:text-accent-red mt-1 underline">
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Default: type grid + quick actions ──
  return (
    <div className="p-6 space-y-5">
      {categories.map(cat => (
        <div key={cat.label}>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            {cat.label}
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {cat.types.map(t => (
              <button
                key={t.key}
                onClick={() => setPickedType(t.key)}
                className="px-3 py-2.5 text-sm font-medium rounded-lg border transition-all text-left
                  bg-bg-secondary border-border text-text-secondary hover:border-accent hover:text-accent hover:bg-accent/10"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-text-muted font-semibold uppercase">OR</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Quick actions */}
      <div className="space-y-2">
        <button
          onClick={onMarkUploadReady}
          disabled={saving}
          className="w-full px-3 py-2.5 text-left text-sm text-text-secondary bg-bg-secondary border border-border rounded-lg hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
            </svg>
            I already have materials &mdash; mark as ready
          </span>
        </button>

        <button
          onClick={onMarkReadyNoMaterials}
          disabled={saving}
          className="w-full px-3 py-2.5 text-left text-sm text-text-secondary bg-bg-secondary border border-border rounded-lg hover:border-accent-green hover:text-accent-green transition-colors disabled:opacity-50"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            No materials needed for this activity
          </span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-accent-red/15 border border-accent-red/30 p-4">
          <p className="text-accent-red text-sm">{error}</p>
          <button onClick={onDismissError} className="text-xs text-accent-red/70 hover:text-accent-red mt-1 underline">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
