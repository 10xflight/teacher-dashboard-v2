import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Shared helpers ────────────────────────────────────────────

function title(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text, bold: true, size: 32 })],
  });
}

function subtitle(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, italics: true, size: 22, color: '666666' })],
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26 })],
  });
}

function body(text: string, opts?: { bold?: boolean; indent?: number }): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    indent: opts?.indent ? { left: opts.indent } : undefined,
    children: [new TextRun({ text, size: 22, bold: opts?.bold })],
  });
}

function answerLine(label: string, text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    indent: { left: 720 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22, color: '228B22' }),
      new TextRun({ text, size: 22, color: '228B22' }),
    ],
  });
}

function blankLine(): Paragraph {
  return new Paragraph({ spacing: { after: 200 }, children: [] });
}

function separator(): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
    children: [],
  });
}

// ── Type-specific builders ────────────────────────────────────

function buildQuiz(m: any, includeAnswers: boolean): Paragraph[] {
  const ps: Paragraph[] = [];
  if (m.title) ps.push(title(m.title));
  if (m.instructions) ps.push(subtitle(m.instructions));
  ps.push(blankLine());

  for (let i = 0; i < (m.questions?.length || 0); i++) {
    const q = m.questions[i];
    ps.push(body(`${i + 1}. ${q.question}`, { bold: true }));
    if (q.choices) {
      for (const c of q.choices) {
        const isCorrect = includeAnswers && c.startsWith(q.correct);
        ps.push(new Paragraph({
          spacing: { after: 40 },
          indent: { left: 720 },
          children: [new TextRun({
            text: `    ${c}`,
            size: 22,
            bold: isCorrect,
            color: isCorrect ? '228B22' : undefined,
          })],
        }));
      }
    }
    if (includeAnswers && q.explanation) {
      ps.push(answerLine('Explanation', q.explanation));
    }
    ps.push(blankLine());
  }
  return ps;
}

function buildWorksheet(m: any, includeAnswers: boolean): Paragraph[] {
  const ps: Paragraph[] = [];
  if (m.title) ps.push(title(m.title));
  if (m.instructions) ps.push(subtitle(m.instructions));
  ps.push(blankLine());

  for (const section of m.sections || []) {
    ps.push(heading(`${section.heading}${section.type ? ` (${section.type})` : ''}`));
    for (let i = 0; i < (section.items?.length || 0); i++) {
      const item = section.items[i];
      ps.push(body(`${i + 1}. ${item.prompt}`));
      if (includeAnswers && item.answer) {
        ps.push(answerLine('Answer', item.answer));
      } else {
        // Blank line for student to write
        ps.push(body('________________________________________', { indent: 720 }));
      }
      ps.push(blankLine());
    }
  }
  return ps;
}

function buildDiscussion(m: any): Paragraph[] {
  const ps: Paragraph[] = [];
  if (m.title) ps.push(title(m.title));
  ps.push(blankLine());

  for (let i = 0; i < (m.questions?.length || 0); i++) {
    const q = m.questions[i];
    ps.push(body(`${i + 1}. ${q.question}`, { bold: true }));
    if (q.follow_up) ps.push(body(`   Follow-up: ${q.follow_up}`, { indent: 720 }));
    if (q.type) ps.push(new Paragraph({
      indent: { left: 720 },
      spacing: { after: 40 },
      children: [new TextRun({ text: `[${q.type}]`, size: 18, color: '999999', italics: true })],
    }));
    ps.push(blankLine());
  }
  return ps;
}

function buildWritingPrompt(m: any): Paragraph[] {
  const ps: Paragraph[] = [];
  if (m.title) ps.push(title(m.title));
  ps.push(blankLine());
  if (m.prompt) ps.push(body(m.prompt));
  ps.push(blankLine());

  if (m.requirements?.length > 0) {
    ps.push(heading('Requirements'));
    for (const r of m.requirements) {
      ps.push(body(`• ${r}`, { indent: 360 }));
    }
  }

  if (m.rubric?.length > 0) {
    ps.push(heading('Rubric'));
    for (const r of m.rubric) {
      ps.push(body(`${r.category} (${r.points} pts): ${r.criteria}`, { indent: 360 }));
    }
  }
  return ps;
}

function buildReadingGuide(m: any): Paragraph[] {
  const ps: Paragraph[] = [];
  if (m.title) ps.push(title(m.title));
  ps.push(blankLine());

  if (m.before_reading?.length > 0) {
    ps.push(heading('Before Reading'));
    for (const q of m.before_reading) ps.push(body(`• ${q}`, { indent: 360 }));
    ps.push(blankLine());
  }
  if (m.during_reading?.length > 0) {
    ps.push(heading('During Reading'));
    for (const q of m.during_reading) {
      ps.push(body(`[${q.page_or_section}] ${q.question}`, { indent: 360 }));
    }
    ps.push(blankLine());
  }
  if (m.after_reading?.length > 0) {
    ps.push(heading('After Reading'));
    for (const q of m.after_reading) ps.push(body(`• ${q}`, { indent: 360 }));
  }
  return ps;
}

function buildJeopardy(m: any): Paragraph[] {
  const ps: Paragraph[] = [];
  if (m.title) ps.push(title(m.title));
  if (m.setup) ps.push(subtitle(m.setup));
  ps.push(blankLine());

  for (const cat of m.categories || []) {
    ps.push(heading(cat.name));
    for (const q of cat.questions || []) {
      ps.push(body(`$${q.points}: ${q.question}`, { bold: true }));
      ps.push(answerLine('Answer', q.answer));
    }
    ps.push(blankLine());
  }
  return ps;
}

function buildGame(m: any): Paragraph[] {
  const ps: Paragraph[] = [];
  if (m.title) ps.push(title(m.title));
  ps.push(blankLine());

  if (m.setup) {
    ps.push(heading('Setup'));
    ps.push(body(m.setup));
    ps.push(blankLine());
  }
  if (m.rules?.length > 0) {
    ps.push(heading('Rules'));
    for (const r of m.rules) ps.push(body(`• ${r}`, { indent: 360 }));
    ps.push(blankLine());
  }
  if (m.items?.length > 0) {
    ps.push(heading('Items'));
    for (let i = 0; i < m.items.length; i++) {
      const item = m.items[i];
      ps.push(body(`${i + 1}. ${item.prompt}`));
      if (item.answer) ps.push(answerLine('Answer', item.answer));
    }
  }
  return ps;
}

function buildSentenceDressup(m: any): Paragraph[] {
  const ps: Paragraph[] = [];
  if (m.title) ps.push(title(m.title));
  if (m.instructions) ps.push(subtitle(m.instructions));
  ps.push(blankLine());

  for (let i = 0; i < (m.sentences?.length || 0); i++) {
    const s = m.sentences[i];
    ps.push(body(`${i + 1}. ${s.base}`, { bold: true }));
    ps.push(body(`   Technique: ${s.technique}`, { indent: 720 }));
    ps.push(answerLine('Example', s.example));
    ps.push(blankLine());
  }
  return ps;
}

function buildFlashcards(m: any): Paragraph[] {
  const ps: Paragraph[] = [];
  if (m.title) ps.push(title(m.title));
  if (m.instructions) ps.push(subtitle(m.instructions));
  ps.push(blankLine());

  for (const card of m.cards || []) {
    ps.push(body(card.front, { bold: true }));
    ps.push(body(card.back, { indent: 360 }));
    if (card.pronunciation) ps.push(new Paragraph({
      indent: { left: 360 },
      spacing: { after: 40 },
      children: [new TextRun({ text: `[${card.pronunciation}]`, size: 20, italics: true, color: '888888' })],
    }));
    if (card.example_sentence) ps.push(body(card.example_sentence, { indent: 360 }));
    ps.push(separator());
  }
  return ps;
}

function buildConjugationDrill(m: any): Paragraph[] {
  const ps: Paragraph[] = [];
  if (m.title) ps.push(title(m.title));
  if (m.instructions) ps.push(subtitle(m.instructions));
  ps.push(blankLine());

  for (const v of m.verbs || []) {
    ps.push(body(`${v.infinitive} (${v.english})`, { bold: true }));
    if (v.conjugations) {
      for (const [pronoun, form] of Object.entries(v.conjugations)) {
        ps.push(body(`  ${pronoun}: ${form}`, { indent: 720 }));
      }
    }
    if (v.example) ps.push(body(v.example, { indent: 720 }));
    ps.push(blankLine());
  }

  if (m.exercises?.length > 0) {
    ps.push(heading('Exercises'));
    for (let i = 0; i < m.exercises.length; i++) {
      const ex = m.exercises[i];
      ps.push(body(`${i + 1}. ${ex.prompt}`));
      if (ex.answer) ps.push(answerLine('Answer', ex.answer));
    }
  }
  return ps;
}

function buildGeneric(m: any): Paragraph[] {
  const ps: Paragraph[] = [];
  if (m.title) ps.push(title(m.title));
  ps.push(blankLine());

  // Render all string fields
  for (const [key, val] of Object.entries(m)) {
    if (key === 'title' || key === 'material_type') continue;
    if (typeof val === 'string') {
      ps.push(body(`${key}: ${val}`));
    }
  }
  return ps;
}

// ── Main export function ──────────────────────────────────────

export async function exportToDocx(
  material: any,
  materialType: string,
  activityTitle: string,
  includeAnswers: boolean,
) {
  let paragraphs: Paragraph[];

  switch (materialType) {
    case 'quiz':
    case 'vocabulary_test':
    case 'grammar_test':
      paragraphs = buildQuiz(material, includeAnswers);
      break;
    case 'worksheet':
      paragraphs = buildWorksheet(material, includeAnswers);
      break;
    case 'discussion_questions':
      paragraphs = buildDiscussion(material);
      break;
    case 'writing_prompt':
      paragraphs = buildWritingPrompt(material);
      break;
    case 'reading_guide':
      paragraphs = buildReadingGuide(material);
      break;
    case 'jeopardy':
      paragraphs = buildJeopardy(material);
      break;
    case 'sentence_dressup':
      paragraphs = buildSentenceDressup(material);
      break;
    case 'flashcard_set':
      paragraphs = buildFlashcards(material);
      break;
    case 'conjugation_drill':
      paragraphs = buildConjugationDrill(material);
      break;
    case 'dice_game':
    case 'card_match':
    case 'relay_race':
    case 'buzzer_quiz':
    case 'guess_who':
    case 'four_corners':
    case 'vocab_bingo':
      paragraphs = buildGame(material);
      break;
    default:
      paragraphs = buildGeneric(material);
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: paragraphs,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = activityTitle.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_').slice(0, 40);
  const suffix = includeAnswers ? '_key' : '';
  saveAs(blob, `${safeName}${suffix}.docx`);
}
