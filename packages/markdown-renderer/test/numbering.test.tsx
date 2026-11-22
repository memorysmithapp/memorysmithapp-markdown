// The numbering of headings (#174): `numbering: decimal` in the notebook's style or a style block
// numbers the outline 1, 1.1, 1.2 from its highest level; `none` numbers nothing and advances no
// counter; the number is drawn, never written, and a contents shows it.

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { NoteEditor } from '../src/edit/index.js';
import { cleanStyle } from '../src/note-style.js';
import { findStyleBlocks } from '../src/style-block.js';
import { numberHeadings } from '../src/outline.js';
import { html, mount, type Mounted } from './render.js';

const NOTE = '# Abertura\n\n## Pauta\n\n## Presentes\n\n### Síndico\n\n# Deliberações\n\n## Orçamento\n';

describe('numberHeadings', () => {
  it('counts from the highest level, a deeper one reset under a new parent', () => {
    const decimal = (levels: number[]) => numberHeadings(levels.map((level) => ({ level, numbering: 'decimal' as const })));
    expect(decimal([1, 2, 2, 3, 1, 2])).toEqual(['1', '1.1', '1.2', '1.2.1', '2', '2.1']);
    expect(decimal([2, 3, 2])).toEqual(['1', '1.1', '2']);
  });

  it('numbers nothing where none, and a heading of none advances no counter', () => {
    expect(numberHeadings([{ level: 1, numbering: 'none' }])).toEqual([null]);
    expect(
      numberHeadings([
        { level: 1, numbering: 'none' },
        { level: 1, numbering: 'decimal' },
        { level: 2, numbering: 'none' },
        { level: 2, numbering: 'decimal' },
      ]),
    ).toEqual([null, '1', null, '1.1']);
  });
});

describe('the numbering key', () => {
  it('is a key of the notebook style and of a style block, and a value it cannot take sets nothing', () => {
    expect(cleanStyle({ numbering: 'decimal' })).toEqual({ numbering: 'decimal' });
    expect(cleanStyle({ numbering: 'roman' } as never)).toEqual({});
    const found = findStyleBlocks(':::{style}\n---\nnumbering: Decimal\n---\n# A\n:::\n');
    expect(found.blocks[0]?.style).toEqual({ numbering: 'decimal' });
    expect(findStyleBlocks(':::{style}\n---\nnumbering: roman\n---\n# A\n:::\n').problems.map((problem) => problem.code)).toEqual(['style-value-invalid']);
  });
});

describe('numbered headings, drawn', () => {
  it('draws no number with no numbering', () => {
    expect(html(NOTE)).not.toContain('heading-number');
  });

  it('draws the number before each heading of the outline, and never writes it', () => {
    const page = html(NOTE, { noteStyle: { numbering: 'decimal' } });
    expect(page).toContain('<h1 data-heading="abertura" data-number="1" id="user-content-abertura"><span class="heading-number">1</span> Abertura</h1>');
    expect(page).toContain('<span class="heading-number">1.2.1</span> Síndico');
    expect(page).toContain('<span class="heading-number">2.1</span> Orçamento');
    // The slug is the heading's text, not its number.
    expect(page).toContain('id="user-content-orçamento"');
  });

  it('numbers no heading outside the outline', () => {
    const page = html('# Um\n\n> ## Citado\n\n## Dois\n', { noteStyle: { numbering: 'decimal' } });
    expect(page).toContain('<span class="heading-number">1.1</span> Dois');
    expect(page).not.toContain('<span class="heading-number">1.1</span> Citado');
  });

  it('lets a style block set the numbering of its passage apart from the notebook', () => {
    const note = '# Um\n\n:::{style}\n---\nnumbering: none\n---\n# Prefácio\n:::\n\n# Dois\n';
    const page = html(note, { noteStyle: { numbering: 'decimal' } });
    expect(page).toContain('<span class="heading-number">1</span> Um');
    expect(page).not.toMatch(/heading-number">[0-9.]+<\/span> Prefácio/);
    expect(page).toContain('<span class="heading-number">2</span> Dois');
    const onlyIn = html('# Um\n\n:::{style}\n---\nnumbering: decimal\n---\n# Anexo\n\n## Parte\n:::\n');
    expect(onlyIn).not.toContain('<span class="heading-number">1</span> Um');
    expect(onlyIn).toContain('<span class="heading-number">1</span> Anexo');
    expect(onlyIn).toContain('<span class="heading-number">1.1</span> Parte');
  });

  it('shows the numbers in the contents', () => {
    const page = html(`\`\`\`contents\n\`\`\`\n\n${NOTE}`, { noteStyle: { numbering: 'decimal' } });
    expect(page).toContain('class="contents-entry"><span class="contents-number">1.1</span> Pauta</a>');
  });

  it('draws the numbers in edit mode, as reading draws them, while the author is elsewhere', async () => {
    let mounted: Mounted | null = null;
    try {
      mounted = await mount(<NoteEditor markdown={NOTE} noteStyle={{ numbering: 'decimal' }} />);
      for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
      const view = EditorView.findFromDOM(mounted.container.querySelector<HTMLElement>('.cm-editor')!)!;
      const numbers = [...view.dom.querySelectorAll('.cm-ms-heading-number')].map((each) => each.textContent?.trim());
      expect(numbers).toEqual(['1', '1.1', '1.2', '1.2.1', '2', '2.1']);
      expect(view.state.doc.toString()).toBe(NOTE);
    } finally {
      mounted?.unmount();
    }
  });
});
