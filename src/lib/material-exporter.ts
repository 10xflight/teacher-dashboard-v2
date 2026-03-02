import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Shared helpers ────────────────────────────────────────────

function studentHeader(): Paragraph[] {
  return [
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: 'Name: ', size: 22 }),
        new TextRun({ text: '________________________________', size: 22 }),
        new TextRun({ text: '     Date: ', size: 22 }),
        new TextRun({ text: '________________', size: 22 }),
        new TextRun({ text: '     Period: ', size: 22 }),
        new TextRun({ text: '________', size: 22 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' } },
      children: [],
    }),
  ];
}

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
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' } },
    children: [new TextRun({ text, bold: true, size: 26 })],
  });
}

function body(text: string, opts?: { bold?: boolean; indent?: number; italic?: boolean; color?: string }): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    indent: opts?.indent ? { left: opts.indent } : undefined,
    children: [new TextRun({ text, size: 22, bold: opts?.bold, italics: opts?.italic, color: opts?.color })],
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

function answerBlank(): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    indent: { left: 720 },
    children: [new TextRun({ text: '________________________________________', size: 22, color: '999999' })],
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

function wordBankBox(words: string[]): (Paragraph | Table)[] {
  if (!words || words.length === 0) return [];
  const cell = new TableCell({
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
      left: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
      right: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
    },
    children: [
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: 'WORD BANK', bold: true, size: 18, color: '666666' })],
      }),
      new Paragraph({
        children: [new TextRun({ text: words.join('     '), size: 22 })],
      }),
    ],
  });
  return [
    new Table({
      rows: [new TableRow({ children: [cell] })],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
    blankLine(),
  ];
}

// ── Type-specific builders ────────────────────────────────────

function buildQuiz(m: any, includeAnswers: boolean): (Paragraph | Table)[] {
  const ps: (Paragraph | Table)[] = [];
  ps.push(...studentHeader());
  if (m.title) ps.push(title(m.title));
  if (m.instructions) ps.push(subtitle(m.instructions));
  ps.push(...wordBankBox(m.word_bank));
  ps.push(blankLine());

  for (let i = 0; i < (m.questions?.length || 0); i++) {
    const q = m.questions[i];
    const pts = q.points ? ` (${q.points} pts)` : '';
    ps.push(body(`${i + 1}. ${q.question}${pts}`, { bold: true }));
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
    } else {
      // Short answer — blank line
      ps.push(answerBlank());
    }
    if (includeAnswers && q.explanation) {
      ps.push(answerLine('Explanation', q.explanation));
    }
    ps.push(blankLine());
  }
  return ps;
}

function buildWorksheet(m: any, includeAnswers: boolean): (Paragraph | Table)[] {
  const ps: (Paragraph | Table)[] = [];
  ps.push(...studentHeader());
  if (m.title) ps.push(title(m.title));
  if (m.instructions) ps.push(subtitle(m.instructions));
  ps.push(...wordBankBox(m.word_bank));
  ps.push(blankLine());

  for (const section of m.sections || []) {
    ps.push(heading(`${section.heading}${section.type ? ` (${section.type})` : ''}`));
    for (let i = 0; i < (section.items?.length || 0); i++) {
      const item = section.items[i];
      ps.push(body(`${i + 1}. ${item.prompt}`));
      if (includeAnswers && item.answer) {
        ps.push(answerLine('Answer', item.answer));
      } else {
        ps.push(answerBlank());
      }
      ps.push(blankLine());
    }
  }

  if (m.extension) {
    ps.push(heading('Early Finishers'));
    ps.push(body(m.extension));
  }
  return ps;
}

function buildDiscussion(m: any): (Paragraph | Table)[] {
  const ps: (Paragraph | Table)[] = [];
  ps.push(...studentHeader());
  if (m.title) ps.push(title(m.title));
  ps.push(blankLine());

  for (let i = 0; i < (m.questions?.length || 0); i++) {
    const q = m.questions[i];
    ps.push(body(`${i + 1}. ${q.question}`, { bold: true }));
    if (q.follow_up) ps.push(body(`   Follow-up: ${q.follow_up}`, { indent: 720, italic: true }));
    if (q.type) ps.push(new Paragraph({
      indent: { left: 720 },
      spacing: { after: 40 },
      children: [new TextRun({ text: `[${q.type}]`, size: 18, color: '999999', italics: true })],
    }));
    // Student writing space
    ps.push(answerBlank());
    ps.push(answerBlank());
    ps.push(blankLine());
  }
  return ps;
}

function buildWritingPrompt(m: any): (Paragraph | Table)[] {
  const ps: (Paragraph | Table)[] = [];
  ps.push(...studentHeader());
  if (m.title) ps.push(title(m.title));
  ps.push(blankLine());

  // Prompt in a bordered box
  if (m.prompt) {
    const promptCell = new TableCell({
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
        left: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
        right: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
      },
      shading: { fill: 'F5F5F5' },
      children: [new Paragraph({ children: [new TextRun({ text: m.prompt, size: 22 })] })],
    });
    ps.push(new Table({
      rows: [new TableRow({ children: [promptCell] })],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
    ps.push(blankLine());
  }

  if (m.requirements?.length > 0) {
    ps.push(heading('Requirements'));
    for (const r of m.requirements) {
      ps.push(body(`• ${r}`, { indent: 360 }));
    }
  }

  if (m.word_count) {
    ps.push(body(`Word Count: ${m.word_count}`, { bold: true }));
    ps.push(blankLine());
  }

  // Rubric as table
  if (m.rubric?.length > 0) {
    ps.push(heading('Rubric'));
    const headerRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Category', bold: true, size: 20 })] })], shading: { fill: 'EEEEEE' } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Points', bold: true, size: 20 })] })], shading: { fill: 'EEEEEE' }, width: { size: 15, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Criteria', bold: true, size: 20 })] })], shading: { fill: 'EEEEEE' } }),
      ],
    });
    const dataRows = m.rubric.map((r: any) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.category, size: 20, bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(r.points), size: 20 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.criteria, size: 20 })] })] }),
      ],
    }));
    const totalPts = m.rubric.reduce((sum: number, r: any) => sum + (Number(r.points) || 0), 0);
    const totalRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Total', bold: true, size: 20 })] })] }),
        new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(totalPts), size: 20, bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [] })] }),
      ],
    });
    ps.push(new Table({
      rows: [headerRow, ...dataRows, totalRow],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }
  return ps;
}

function buildReadingGuide(m: any): (Paragraph | Table)[] {
  const ps: (Paragraph | Table)[] = [];
  ps.push(...studentHeader());
  if (m.title) ps.push(title(m.title));
  ps.push(blankLine());

  if (m.before_reading?.length > 0) {
    ps.push(heading('Before Reading'));
    for (let i = 0; i < m.before_reading.length; i++) {
      ps.push(body(`${i + 1}. ${m.before_reading[i]}`));
      ps.push(answerBlank());
    }
    ps.push(blankLine());
  }
  if (m.during_reading?.length > 0) {
    ps.push(heading('During Reading'));
    for (let i = 0; i < m.during_reading.length; i++) {
      const q = m.during_reading[i];
      ps.push(new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: `[${q.page_or_section}] `, bold: true, size: 22 }),
          new TextRun({ text: q.question, size: 22 }),
        ],
      }));
      ps.push(answerBlank());
    }
    ps.push(blankLine());
  }
  if (m.after_reading?.length > 0) {
    ps.push(heading('After Reading'));
    for (let i = 0; i < m.after_reading.length; i++) {
      ps.push(body(`${i + 1}. ${m.after_reading[i]}`));
      ps.push(answerBlank());
    }
  }
  return ps;
}

function buildJeopardy(m: any): (Paragraph | Table)[] {
  const ps: (Paragraph | Table)[] = [];
  if (m.title) ps.push(title(m.title));
  if (m.setup) {
    const setupCell = new TableCell({
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
        left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
        right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
      },
      shading: { fill: 'F5F5F5' },
      children: [
        new Paragraph({ children: [new TextRun({ text: 'TEACHER SETUP', bold: true, size: 18, color: '666666' })] }),
        new Paragraph({ children: [new TextRun({ text: m.setup, size: 22 })] }),
      ],
    });
    ps.push(new Table({
      rows: [new TableRow({ children: [setupCell] })],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }
  ps.push(blankLine());

  // Build Jeopardy grid as a table
  const categories = m.categories || [];
  const maxQs = Math.max(...categories.map((c: any) => c.questions?.length || 0), 0);

  if (categories.length > 0) {
    const headerRow = new TableRow({
      children: categories.map((cat: any) => new TableCell({
        shading: { fill: '1a237e' },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: cat.name, bold: true, size: 18, color: 'FFFFFF' })],
        })],
      })),
    });

    const dataRows = Array.from({ length: maxQs }).map((_, row) => new TableRow({
      children: categories.map((cat: any) => {
        const q = cat.questions?.[row];
        return new TableCell({
          children: q ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `$${q.points}`, bold: true, size: 24, color: '1a237e' })],
            }),
          ] : [new Paragraph({ children: [] })],
        });
      }),
    }));

    ps.push(new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }

  // Answer key section
  ps.push(blankLine());
  ps.push(heading('Answer Key'));
  for (const cat of categories) {
    ps.push(body(cat.name, { bold: true }));
    for (const q of cat.questions || []) {
      ps.push(new Paragraph({
        spacing: { after: 40 },
        indent: { left: 360 },
        children: [
          new TextRun({ text: `$${q.points}: `, bold: true, size: 20 }),
          new TextRun({ text: q.question, size: 20 }),
          new TextRun({ text: ` → ${q.answer}`, size: 20, color: '228B22' }),
        ],
      }));
    }
  }

  if (m.final_jeopardy) {
    ps.push(blankLine());
    ps.push(heading('Final Jeopardy'));
    ps.push(body(m.final_jeopardy.question || m.final_jeopardy.clue || ''));
    if (m.final_jeopardy.answer) {
      ps.push(answerLine('Answer', m.final_jeopardy.answer));
    }
  }
  return ps;
}

function buildGame(m: any): (Paragraph | Table)[] {
  const ps: (Paragraph | Table)[] = [];
  if (m.title) ps.push(title(m.title));
  ps.push(blankLine());

  if (m.setup) {
    ps.push(heading('Setup'));
    ps.push(body(m.setup));
    ps.push(blankLine());
  }
  if (m.materials_needed?.length > 0) {
    ps.push(heading('Materials Needed'));
    for (const item of m.materials_needed) ps.push(body(`• ${item}`, { indent: 360 }));
    ps.push(blankLine());
  }
  if (m.rules?.length > 0) {
    ps.push(heading('Rules'));
    for (let i = 0; i < m.rules.length; i++) {
      ps.push(body(`${i + 1}. ${m.rules[i]}`, { indent: 360 }));
    }
    ps.push(blankLine());
  }
  if (m.items?.length > 0) {
    ps.push(heading('Game Cards'));
    // Build as 2-column table
    const rows: TableRow[] = [];
    for (let i = 0; i < m.items.length; i += 2) {
      const cells = [m.items[i], m.items[i + 1]].map((item) => {
        if (!item) return new TableCell({ children: [new Paragraph({ children: [] })] });
        return new TableCell({
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
            left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
            right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
          },
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.prompt, size: 22, bold: true })] }),
          ],
        });
      });
      rows.push(new TableRow({ children: cells }));
    }
    ps.push(new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));

    // Answer key
    ps.push(blankLine());
    ps.push(heading('Answer Key'));
    for (let i = 0; i < m.items.length; i++) {
      if (m.items[i].answer) {
        ps.push(new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${i + 1}. ${m.items[i].prompt}`, size: 20 }),
            new TextRun({ text: ` → ${m.items[i].answer}`, size: 20, color: '228B22' }),
          ],
        }));
      }
    }
  }
  return ps;
}

function buildSentenceDressup(m: any, includeAnswers: boolean): (Paragraph | Table)[] {
  const ps: (Paragraph | Table)[] = [];
  ps.push(...studentHeader());
  if (m.title) ps.push(title(m.title));
  if (m.instructions) ps.push(subtitle(m.instructions));
  ps.push(blankLine());

  for (let i = 0; i < (m.sentences?.length || 0); i++) {
    const s = m.sentences[i];
    ps.push(body(`${i + 1}. ${s.base}`, { bold: true }));
    ps.push(body(`Technique: ${s.technique}`, { indent: 720, italic: true }));
    if (includeAnswers) {
      ps.push(answerLine('Example', s.example));
    } else {
      ps.push(answerBlank());
      ps.push(answerBlank());
    }
    ps.push(blankLine());
  }
  return ps;
}

function buildFlashcards(m: any): (Paragraph | Table)[] {
  const ps: (Paragraph | Table)[] = [];
  if (m.title) ps.push(title(m.title));
  if (m.instructions) ps.push(subtitle(m.instructions));
  ps.push(blankLine());

  // Build flashcard grid as 2-column table
  const rows: TableRow[] = [];
  for (let i = 0; i < (m.cards?.length || 0); i += 2) {
    const cells = [m.cards[i], m.cards?.[i + 1]].map((card) => {
      if (!card) return new TableCell({ children: [new Paragraph({ children: [] })] });
      const children: Paragraph[] = [
        new Paragraph({ children: [new TextRun({ text: card.front, bold: true, size: 22 })] }),
        new Paragraph({ children: [new TextRun({ text: card.back, size: 22 })] }),
      ];
      if (card.pronunciation) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `[${card.pronunciation}]`, italics: true, size: 20, color: '888888' })],
        }));
      }
      if (card.example_sentence) {
        children.push(new Paragraph({
          spacing: { before: 40 },
          border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
          children: [new TextRun({ text: card.example_sentence, size: 20, color: '666666' })],
        }));
      }
      return new TableCell({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
          left: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
          right: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
        },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children,
      });
    });
    rows.push(new TableRow({ children: cells }));
  }
  if (rows.length > 0) {
    ps.push(new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  }
  return ps;
}

function buildConjugationDrill(m: any, includeAnswers: boolean): (Paragraph | Table)[] {
  const ps: (Paragraph | Table)[] = [];
  ps.push(...studentHeader());
  if (m.title) ps.push(title(m.title));
  if (m.instructions) ps.push(subtitle(m.instructions));
  ps.push(blankLine());

  for (const v of m.verbs || []) {
    ps.push(body(`${v.infinitive} (${v.english})`, { bold: true }));
    if (v.conjugations) {
      // Build conjugation as table
      const conjRows = Object.entries(v.conjugations).map(([pronoun, form]) => new TableRow({
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: pronoun, size: 22, color: '666666' })] })],
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({
                text: includeAnswers ? (form as string) : '________________',
                size: 22,
                bold: includeAnswers,
              })],
            })],
          }),
        ],
      }));
      ps.push(new Table({
        rows: conjRows,
        width: { size: 60, type: WidthType.PERCENTAGE },
      }));
    }
    if (v.example) ps.push(body(v.example, { indent: 360, italic: true, color: '666666' }));
    ps.push(blankLine());
  }

  if (m.exercises?.length > 0) {
    ps.push(heading('Exercises'));
    for (let i = 0; i < m.exercises.length; i++) {
      const ex = m.exercises[i];
      ps.push(body(`${i + 1}. ${ex.prompt}`));
      if (includeAnswers && ex.answer) {
        ps.push(answerLine('Answer', ex.answer));
      } else {
        ps.push(answerBlank());
      }
    }
  }
  return ps;
}

function buildGeneric(m: any): (Paragraph | Table)[] {
  const ps: (Paragraph | Table)[] = [];
  if (m.title) ps.push(title(m.title));
  ps.push(blankLine());

  for (const [key, val] of Object.entries(m)) {
    if (key === 'title' || key === 'material_type') continue;
    if (typeof val === 'string') {
      ps.push(body(`${key.replace(/_/g, ' ')}: ${val}`));
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
  let children: (Paragraph | Table)[];

  switch (materialType) {
    case 'quiz':
    case 'vocabulary_test':
    case 'grammar_test':
      children = buildQuiz(material, includeAnswers);
      break;
    case 'worksheet':
      children = buildWorksheet(material, includeAnswers);
      break;
    case 'discussion_questions':
      children = buildDiscussion(material);
      break;
    case 'writing_prompt':
      children = buildWritingPrompt(material);
      break;
    case 'reading_guide':
      children = buildReadingGuide(material);
      break;
    case 'jeopardy':
      children = buildJeopardy(material);
      break;
    case 'sentence_dressup':
      children = buildSentenceDressup(material, includeAnswers);
      break;
    case 'flashcard_set':
      children = buildFlashcards(material);
      break;
    case 'conjugation_drill':
      children = buildConjugationDrill(material, includeAnswers);
      break;
    case 'dice_game':
    case 'card_match':
    case 'relay_race':
    case 'buzzer_quiz':
    case 'guess_who':
    case 'four_corners':
    case 'vocab_bingo':
      children = buildGame(material);
      break;
    default:
      children = buildGeneric(material);
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = activityTitle.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_').slice(0, 40);
  const suffix = includeAnswers ? '_answer_key' : '_student';
  saveAs(blob, `${safeName}${suffix}.docx`);
}
