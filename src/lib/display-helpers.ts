import { TYPE_LABELS, type PromptCard, type PromptBankEntry } from './types';
import promptsBank from '@/data/prompts-bank.json';

/**
 * Pull prompts of different types from the bank to fill the journal grid.
 * Ported from display.py get_companion_prompts()
 */
export function getCompanionPrompts(mainType: string, count = 3): PromptCard[] {
  const bank = promptsBank as PromptBankEntry[];

  // Group by type, excluding mainType and emoji_story_starter
  const byType: Record<string, PromptBankEntry[]> = {};
  for (const p of bank) {
    const t = p.type || '';
    if (t !== mainType && t !== 'emoji_story_starter') {
      if (!byType[t]) byType[t] = [];
      byType[t].push(p);
    }
  }

  const chosen: PromptCard[] = [];
  const preferredTypes = [
    'quote', 'creative', 'reflective', 'descriptive',
    'critical_thinking', 'poetry', 'emoji', 'list', 'visual',
  ];

  // Shuffle preferred types for variety
  for (let i = preferredTypes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [preferredTypes[i], preferredTypes[j]] = [preferredTypes[j], preferredTypes[i]];
  }

  for (const t of preferredTypes) {
    if (t === mainType || !byType[t]) continue;

    const options = byType[t];
    const prompt = options[Math.floor(Math.random() * options.length)];
    let text = prompt.prompt || '';

    // For quotes, combine quote + writing prompt
    if (t === 'quote' && prompt.writing_prompt) {
      text = `${prompt.prompt}\n\n${prompt.writing_prompt}`;
    }

    chosen.push({
      type: t,
      label: TYPE_LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1),
      text,
      image: null,
    });

    if (chosen.length >= count) break;
  }

  return chosen;
}
