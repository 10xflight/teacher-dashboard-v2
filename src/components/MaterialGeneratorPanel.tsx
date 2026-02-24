'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ActivityForPanel {
  id: number;
  title: string;
  description: string | null;
  class_id: number;
  date?: string;
  classes: { name: string } | null;
}

interface MaterialGeneratorPanelProps {
  activity: ActivityForPanel;
  onClose: () => void;
  onSaved: () => void;
}

type MaterialType =
  | 'quiz' | 'vocabulary_test' | 'grammar_test' | 'sentence_dressup'
  | 'worksheet' | 'discussion_questions' | 'writing_prompt' | 'reading_guide'
  | 'jeopardy' | 'dice_game' | 'card_match' | 'relay_race'
  | 'buzzer_quiz' | 'guess_who' | 'four_corners' | 'vocab_bingo'
  | 'flashcard_set' | 'conjugation_drill' | 'dialogue_builder' | 'cultural_activity';

interface MaterialCategory {
  label: string;
  types: { key: MaterialType; label: string }[];
}

// ── Material Type Categories ───────────────────────────────────────────────────

const ASSESSMENTS: MaterialCategory = {
  label: 'Assessments',
  types: [
    { key: 'quiz', label: 'Quiz' },
    { key: 'vocabulary_test', label: 'Vocabulary Test' },
    { key: 'grammar_test', label: 'Grammar Test' },
    { key: 'sentence_dressup', label: 'Sentence Dressup' },
  ],
};

const WORKSHEETS: MaterialCategory = {
  label: 'Worksheets',
  types: [
    { key: 'worksheet', label: 'Worksheet' },
    { key: 'discussion_questions', label: 'Discussion Qs' },
    { key: 'writing_prompt', label: 'Writing Prompt' },
    { key: 'reading_guide', label: 'Reading Guide' },
  ],
};

const GAMES: MaterialCategory = {
  label: 'Games',
  types: [
    { key: 'jeopardy', label: 'Jeopardy' },
    { key: 'dice_game', label: 'Dice Game' },
    { key: 'card_match', label: 'Card Match' },
    { key: 'relay_race', label: 'Relay Race' },
    { key: 'buzzer_quiz', label: 'Buzzer Quiz' },
    { key: 'guess_who', label: 'Guess Who' },
    { key: 'four_corners', label: 'Four Corners' },
    { key: 'vocab_bingo', label: 'Vocab Bingo' },
  ],
};

const FRENCH: MaterialCategory = {
  label: 'French',
  types: [
    { key: 'flashcard_set', label: 'Flashcard Set' },
    { key: 'conjugation_drill', label: 'Conjugation Drill' },
    { key: 'dialogue_builder', label: 'Dialogue Builder' },
    { key: 'cultural_activity', label: 'Cultural Activity' },
  ],
};

// ── Renderers for different material structures ────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

function renderQuizTest(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.instructions && (
        <p className="text-xs text-text-secondary italic">{material.instructions}</p>
      )}
      {material.questions?.map((q: any, i: number) => (
        <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-1.5">
          <p className="text-sm text-text-primary font-medium">
            {i + 1}. {q.question}
          </p>
          {q.choices?.map((c: string, ci: number) => (
            <p key={ci} className={`text-xs ml-4 ${
              c.startsWith(q.correct) ? 'text-accent-green font-semibold' : 'text-text-secondary'
            }`}>
              {c}
            </p>
          ))}
          {q.explanation && (
            <p className="text-xs text-text-muted ml-4 italic">
              {q.explanation}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function renderWorksheet(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.instructions && (
        <p className="text-xs text-text-secondary italic">{material.instructions}</p>
      )}
      {material.sections?.map((s: any, si: number) => (
        <div key={si} className="space-y-2">
          <h5 className="text-xs font-semibold text-accent uppercase tracking-wider">
            {s.heading} {s.type && <span className="text-text-muted font-normal">({s.type})</span>}
          </h5>
          {s.items?.map((item: any, ii: number) => (
            <div key={ii} className="rounded-lg bg-bg-primary/50 p-2.5">
              <p className="text-sm text-text-primary">{ii + 1}. {item.prompt}</p>
              {item.answer && (
                <p className="text-xs text-accent-green mt-1 ml-4">Answer: {item.answer}</p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function renderDiscussionQuestions(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.questions?.map((q: any, i: number) => (
        <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-1">
          <p className="text-sm text-text-primary font-medium">{i + 1}. {q.question}</p>
          {q.follow_up && (
            <p className="text-xs text-text-secondary ml-4">Follow-up: {q.follow_up}</p>
          )}
          {q.type && (
            <span className="text-[0.65rem] text-text-muted ml-4 uppercase">{q.type}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function renderWritingPrompt(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.prompt && (
        <p className="text-sm text-text-primary leading-relaxed bg-bg-primary/50 p-3 rounded-lg">
          {material.prompt}
        </p>
      )}
      {material.requirements && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Requirements</h5>
          <ul className="list-disc list-inside text-xs text-text-secondary space-y-0.5">
            {material.requirements.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
      {material.rubric && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Rubric</h5>
          {material.rubric.map((r: any, i: number) => (
            <div key={i} className="flex items-baseline gap-2 text-xs text-text-secondary">
              <span className="font-medium text-text-primary">{r.category}</span>
              <span className="text-accent-yellow">{r.points}pts</span>
              <span>{r.criteria}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderReadingGuide(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.before_reading && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Before Reading</h5>
          <ul className="list-disc list-inside text-xs text-text-secondary space-y-0.5">
            {material.before_reading.map((q: string, i: number) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}
      {material.during_reading && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">During Reading</h5>
          {material.during_reading.map((q: any, i: number) => (
            <div key={i} className="text-xs text-text-secondary ml-2">
              <span className="text-text-muted">[{q.page_or_section}]</span> {q.question}
            </div>
          ))}
        </div>
      )}
      {material.after_reading && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">After Reading</h5>
          <ul className="list-disc list-inside text-xs text-text-secondary space-y-0.5">
            {material.after_reading.map((q: string, i: number) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function renderJeopardy(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.setup && (
        <p className="text-xs text-text-secondary italic">{material.setup}</p>
      )}
      {material.categories?.map((cat: any, ci: number) => (
        <div key={ci} className="space-y-1.5">
          <h5 className="text-xs font-semibold text-accent uppercase tracking-wider">
            {cat.name}
          </h5>
          {cat.questions?.map((q: any, qi: number) => (
            <div key={qi} className="flex items-start gap-3 rounded-lg bg-bg-primary/50 p-2.5">
              <span className="text-xs font-bold text-accent-yellow shrink-0 w-8">
                ${q.points}
              </span>
              <div className="flex-1">
                <p className="text-xs text-text-primary">{q.question}</p>
                <p className="text-xs text-accent-green mt-0.5">{q.answer}</p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function renderGame(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.setup && (
        <div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
          <h5 className="text-xs font-semibold text-accent mb-1">Setup Instructions</h5>
          <p className="text-xs text-text-secondary">{material.setup}</p>
        </div>
      )}
      {material.rules && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Rules</h5>
          <ul className="list-disc list-inside text-xs text-text-secondary space-y-0.5">
            {material.rules.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
      {material.items?.map((item: any, i: number) => (
        <div key={i} className="rounded-lg bg-bg-primary/50 p-2.5">
          <p className="text-sm text-text-primary">{i + 1}. {item.prompt}</p>
          {item.answer && (
            <p className="text-xs text-accent-green mt-0.5 ml-4">Answer: {item.answer}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function renderSentenceDressup(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.instructions && (
        <p className="text-xs text-text-secondary italic">{material.instructions}</p>
      )}
      {material.sentences?.map((s: any, i: number) => (
        <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-1">
          <p className="text-sm text-text-primary">{i + 1}. {s.base}</p>
          <p className="text-xs text-accent ml-4">Technique: {s.technique}</p>
          <p className="text-xs text-accent-green ml-4">Example: {s.example}</p>
        </div>
      ))}
    </div>
  );
}

function renderFlashcards(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.instructions && (
        <p className="text-xs text-text-secondary italic">{material.instructions}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {material.cards?.map((card: any, i: number) => (
          <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-1">
            <p className="text-sm font-semibold text-accent">{card.front}</p>
            <p className="text-sm text-text-primary">{card.back}</p>
            {card.pronunciation && (
              <p className="text-xs text-text-muted italic">[{card.pronunciation}]</p>
            )}
            {card.example_sentence && (
              <p className="text-xs text-text-secondary">{card.example_sentence}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderConjugationDrill(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.instructions && (
        <p className="text-xs text-text-secondary italic">{material.instructions}</p>
      )}
      {material.verbs?.map((v: any, i: number) => (
        <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-accent">{v.infinitive}</span>
            <span className="text-xs text-text-muted">({v.english})</span>
          </div>
          {v.conjugations && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs ml-2">
              {Object.entries(v.conjugations).map(([pronoun, form]) => (
                <div key={pronoun} className="flex gap-2">
                  <span className="text-text-muted w-14">{pronoun}</span>
                  <span className="text-text-primary">{form as string}</span>
                </div>
              ))}
            </div>
          )}
          {v.example && (
            <p className="text-xs text-text-secondary italic ml-2">{v.example}</p>
          )}
        </div>
      ))}
      {material.exercises && material.exercises.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Exercises</h5>
          {material.exercises.map((ex: any, i: number) => (
            <div key={i} className="text-xs text-text-secondary ml-2">
              {i + 1}. {ex.prompt}
              {ex.answer && <span className="text-accent-green ml-2">({ex.answer})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderDialogueBuilder(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.scenario && (
        <p className="text-xs text-text-secondary italic">{material.scenario}</p>
      )}
      {material.vocabulary && material.vocabulary.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Key Vocabulary</h5>
          <div className="flex flex-wrap gap-1.5">
            {material.vocabulary.map((v: any, i: number) => (
              <span key={i} className="text-xs bg-bg-primary/50 rounded px-2 py-0.5 text-text-secondary">
                <span className="text-accent">{v.french}</span> = {v.english}
              </span>
            ))}
          </div>
        </div>
      )}
      {material.model_dialogue && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Model Dialogue</h5>
          <div className="space-y-1.5 ml-2">
            {material.model_dialogue.map((line: any, i: number) => (
              <div key={i} className={`text-xs rounded-lg p-2 ${
                line.speaker === 'A' ? 'bg-accent/10 ml-0 mr-8' : 'bg-bg-primary/50 ml-8 mr-0'
              }`}>
                <span className="font-semibold text-text-muted">Speaker {line.speaker}: </span>
                <span className="text-text-primary">{line.french}</span>
                <span className="text-text-muted ml-2">({line.english})</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {material.practice_prompts && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Practice</h5>
          <ul className="list-disc list-inside text-xs text-text-secondary space-y-0.5">
            {material.practice_prompts.map((p: string, i: number) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function renderCulturalActivity(material: any) {
  return (
    <div className="space-y-4">
      {material.title && (
        <h4 className="text-sm font-bold text-text-primary">{material.title}</h4>
      )}
      {material.topic && (
        <p className="text-xs text-accent font-semibold uppercase">{material.topic}</p>
      )}
      {material.background && (
        <p className="text-xs text-text-secondary leading-relaxed">{material.background}</p>
      )}
      {material.activities?.map((a: any, i: number) => (
        <div key={i} className="rounded-lg bg-bg-primary/50 p-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[0.65rem] text-text-muted uppercase">{a.type}</span>
          </div>
          <p className="text-sm text-text-primary">{a.description}</p>
          <p className="text-xs text-text-secondary">{a.instructions}</p>
        </div>
      ))}
      {material.vocabulary && material.vocabulary.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-accent mb-1">Vocabulary</h5>
          <div className="flex flex-wrap gap-1.5">
            {material.vocabulary.map((v: any, i: number) => (
              <span key={i} className="text-xs bg-bg-primary/50 rounded px-2 py-0.5 text-text-secondary">
                <span className="text-accent">{v.french}</span> = {v.english}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderMaterialPreview(material: any, materialType: MaterialType) {
  // Quiz / Test types
  if (['quiz', 'vocabulary_test', 'grammar_test'].includes(materialType) && material.questions) {
    return renderQuizTest(material);
  }
  // Sentence dressup
  if (materialType === 'sentence_dressup' && material.sentences) {
    return renderSentenceDressup(material);
  }
  // Worksheet
  if (materialType === 'worksheet' && material.sections) {
    return renderWorksheet(material);
  }
  // Discussion questions
  if (materialType === 'discussion_questions' && material.questions) {
    return renderDiscussionQuestions(material);
  }
  // Writing prompt
  if (materialType === 'writing_prompt' && material.prompt) {
    return renderWritingPrompt(material);
  }
  // Reading guide
  if (materialType === 'reading_guide') {
    return renderReadingGuide(material);
  }
  // Jeopardy
  if (materialType === 'jeopardy' && material.categories) {
    return renderJeopardy(material);
  }
  // Other games
  if (['dice_game', 'card_match', 'relay_race', 'buzzer_quiz', 'guess_who', 'four_corners', 'vocab_bingo'].includes(materialType)) {
    return renderGame(material);
  }
  // Flashcards
  if (materialType === 'flashcard_set' && material.cards) {
    return renderFlashcards(material);
  }
  // Conjugation drill
  if (materialType === 'conjugation_drill' && material.verbs) {
    return renderConjugationDrill(material);
  }
  // Dialogue builder
  if (materialType === 'dialogue_builder') {
    return renderDialogueBuilder(material);
  }
  // Cultural activity
  if (materialType === 'cultural_activity') {
    return renderCulturalActivity(material);
  }

  // Fallback: pretty-printed JSON
  return (
    <pre className="text-xs text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
      {JSON.stringify(material, null, 2)}
    </pre>
  );
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MaterialGeneratorPanel({
  activity,
  onClose,
  onSaved,
}: MaterialGeneratorPanelProps) {
  const [selectedType, setSelectedType] = useState<MaterialType | null>(null);
  const [teacherNotes, setTeacherNotes] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedMaterial, setGeneratedMaterial] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const className = activity.classes?.name || 'Unknown Class';
  const isFrench = className.toLowerCase().includes('french');

  const categories: MaterialCategory[] = [ASSESSMENTS, WORKSHEETS, GAMES];
  if (isFrench) categories.push(FRENCH);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const generate = useCallback(async (type: MaterialType, notes?: string) => {
    setGenerating(true);
    setError(null);
    setGeneratedMaterial(null);
    setSelectedType(type);

    try {
      const res = await fetch('/api/materials/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: activity.id,
          material_type: type,
          teacher_notes: notes || teacherNotes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Generation failed' }));
        throw new Error(data.error || 'Generation failed');
      }

      const data = await res.json();
      setGeneratedMaterial(data.material);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [activity.id, teacherNotes]);

  async function saveToActivity() {
    if (!generatedMaterial) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_status: 'ready',
          material_content: generatedMaterial,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(data.error || 'Save failed');
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function markReadyNoMaterials() {
    setSaving(true);
    try {
      await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material_status: 'ready' }),
      });
      onSaved();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  async function markUploadReady() {
    setSaving(true);
    try {
      await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material_status: 'ready' }),
      });
      onSaved();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  function handleCustomGenerate() {
    if (!customPrompt.trim()) return;
    // Default to worksheet if no type selected yet
    const type = selectedType || 'worksheet';
    generate(type, customPrompt.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in"
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-[500px] bg-bg-card border-l border-border shadow-2xl flex flex-col animate-panel-in">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-text-primary truncate">
              Material Generator
            </h2>
            <p className="text-sm text-accent mt-0.5 truncate">{activity.title}</p>
            <p className="text-xs text-text-muted mt-0.5">
              {className}
              {activity.date && <span> &middot; {activity.date}</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-hover transition-colors ml-2 shrink-0"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Show generated content if we have it */}
          {generatedMaterial && selectedType ? (
            <div className="space-y-4">
              {/* Preview header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                  Generated Preview
                </h3>
                <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                  {selectedType.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Material preview */}
              <div className="rounded-xl bg-bg-secondary border border-border p-4 max-h-[50vh] overflow-y-auto">
                {renderMaterialPreview(generatedMaterial, selectedType)}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={saveToActivity}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-accent-green text-white rounded-lg font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save to Activity'}
                </button>
                <button
                  onClick={() => generate(selectedType)}
                  disabled={generating}
                  className="px-4 py-2.5 bg-accent/15 text-accent rounded-lg font-semibold text-sm hover:bg-accent/25 transition-colors disabled:opacity-50"
                >
                  {generating ? 'Regenerating...' : 'Regenerate'}
                </button>
                <button
                  onClick={() => {
                    setGeneratedMaterial(null);
                    setSelectedType(null);
                    setError(null);
                  }}
                  className="px-4 py-2.5 bg-bg-input text-text-secondary rounded-lg font-semibold text-sm hover:bg-hover hover:text-text-primary transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Material type grid */}
              {categories.map(cat => (
                <div key={cat.label}>
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    {cat.label}
                  </h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {cat.types.map(t => (
                      <button
                        key={t.key}
                        onClick={() => generate(t.key)}
                        disabled={generating}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all text-left
                          ${selectedType === t.key && generating
                            ? 'bg-accent/20 border-accent text-accent'
                            : 'bg-bg-secondary border-border text-text-secondary hover:border-accent hover:text-accent hover:bg-accent/10'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {selectedType === t.key && generating ? (
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            Generating...
                          </span>
                        ) : (
                          t.label
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Teacher notes */}
              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1.5">
                  Teacher Notes (optional)
                </label>
                <textarea
                  value={teacherNotes}
                  onChange={e => setTeacherNotes(e.target.value)}
                  placeholder="Add specific instructions, topics to cover, difficulty level..."
                  rows={3}
                  className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm placeholder:text-text-muted focus:border-accent focus:outline-none resize-none"
                />
              </div>

              {/* OR section divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-text-muted font-semibold uppercase">OR</span>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* Alternative actions */}
              <div className="space-y-2">
                <button
                  onClick={markUploadReady}
                  disabled={saving}
                  className="w-full px-3 py-2.5 text-left text-sm text-text-secondary bg-bg-secondary border border-border rounded-lg hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                    Upload a file
                    <span className="text-xs text-text-muted ml-auto">(marks ready)</span>
                  </span>
                </button>

                <button
                  onClick={markReadyNoMaterials}
                  disabled={saving}
                  className="w-full px-3 py-2.5 text-left text-sm text-text-secondary bg-bg-secondary border border-border rounded-lg hover:border-accent-green hover:text-accent-green transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Mark as ready &mdash; no materials needed
                  </span>
                </button>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCustomGenerate()}
                    placeholder="Custom: describe what you need..."
                    className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm placeholder:text-text-muted focus:border-accent focus:outline-none"
                  />
                  <button
                    onClick={handleCustomGenerate}
                    disabled={generating || !customPrompt.trim()}
                    className="px-3 py-2 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    Go
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Loading state */}
          {generating && !generatedMaterial && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-text-secondary">Generating {selectedType?.replace(/_/g, ' ')}...</p>
              <p className="text-xs text-text-muted">This usually takes 10-20 seconds</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="rounded-lg bg-accent-red/15 border border-accent-red/30 p-4">
              <p className="text-accent-red text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-accent-red/70 hover:text-accent-red mt-1 underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-bg-input text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
