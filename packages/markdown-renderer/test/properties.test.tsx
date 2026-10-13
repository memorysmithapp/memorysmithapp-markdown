/**
 * The frontmatter is content: read as the specification reads it (§6), and
 * drawn above the body as the theme decides — the default theme's title and
 * properties, or whatever a theme's `properties` slot draws, or nothing.
 */

import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { defineTheme, readProperties, type PropertiesSlotProps } from '../src/index.js';
import { notebook } from './notebook.js';
import { draw, html } from './render.js';

const front = (lines: string) => `---\n${lines}\n---\n\nThe body.`;

describe('reading the frontmatter', () => {
  it('reads each value by its shape (§6.3)', () => {
    const { entries } = readProperties(
      front(
        [
          'created: 2026-09-03',
          'stamped: 2026-09-03T10:00:00Z',
          'reviewed: Yes',
          'draft: false',
          'maturity: evergreen',
          `summary: ${'a sentence that runs well past forty characters'}`,
          'tags: [medida, "analise"]',
          'one: [only]',
          'steps:',
          '  - first',
          "  - 'second'",
          'blank:',
        ].join('\n'),
      ),
    );
    expect(entries).toEqual([
      { key: 'created', shape: 'date', values: ['2026-09-03'] },
      { key: 'stamped', shape: 'date', values: ['2026-09-03'] },
      { key: 'reviewed', shape: 'boolean', values: ['true'] },
      { key: 'draft', shape: 'boolean', values: ['false'] },
      { key: 'maturity', shape: 'text', values: ['evergreen'] },
      { key: 'summary', shape: 'prose', values: ['a sentence that runs well past forty characters'] },
      { key: 'tags', shape: 'list', values: ['medida', 'analise'] },
      { key: 'one', shape: 'list', values: ['only'] },
      { key: 'steps', shape: 'list', values: ['first', 'second'] },
      { key: 'blank', shape: 'empty', values: [] },
    ]);
  });

  it('takes `name` apart, and only as a single text value (§6.5)', () => {
    expect(readProperties(front('name: "Plano de continuidade"\ntipo: medida')).name).toBe('Plano de continuidade');
    expect(readProperties(front('name: [a, b]')).name).toBeNull();
    expect(readProperties(front('tipo: medida')).name).toBeNull();
    expect(readProperties(front('name: X')).entries).toEqual([]);
  });

  it('keeps a wikilink whole, quoted or not, alone or in a list', () => {
    const { entries } = readProperties(front('autor: "[[Ana Souza]]"\nfonte: [[Livro]]\nrelated: ["[[A, B]]", "[[C|see C]]"]'));
    expect(entries).toEqual([
      { key: 'autor', shape: 'text', values: ['[[Ana Souza]]'] },
      { key: 'fonte', shape: 'text', values: ['[[Livro]]'] },
      { key: 'related', shape: 'list', values: ['[[A, B]]', '[[C|see C]]'] },
    ]);
  });

  it('reads nothing from a note with no block, or a block never closed', () => {
    expect(readProperties('Just a body.')).toEqual({ name: null, entries: [] });
    expect(readProperties('---\nname: x\nno end')).toEqual({ name: null, entries: [] });
  });
});

describe('the default theme', () => {
  const NOTE = front(
    ['name: Índice de Polifenóis', 'tags: [medida, analise]', 'reviewed: true', 'updated: 2026-03-30', 'tipo: medida'].join('\n'),
  );

  it('draws the name as the title and each entry by its shape, above the body', () => {
    const out = html(NOTE);
    expect(out).toContain('<header class="note-properties"><h1 class="note-title">Índice de Polifenóis</h1>');
    expect(out).toContain('<dl class="properties" aria-label="Properties">');
    expect(out).toContain(
      '<div class="property" data-shape="list"><dt>tags</dt><dd><span class="property-chip">medida</span><span class="property-chip">analise</span></dd></div>',
    );
    expect(out).toContain('<dd><span class="property-boolean" data-value="true">Yes</span></dd>');
    expect(out).toContain('<dd><time dateTime="2026-03-30">2026-03-30</time></dd>');
    expect(out).toContain('<dt>tipo</dt><dd>medida</dd>');
    expect(out.indexOf('</header>')).toBeLessThan(out.indexOf('The body.'));
  });

  it('says a boolean in the reader’s words', () => {
    expect(html(front('reviewed: false'), { strings: { no: 'Não' } })).toContain('data-value="false">Não</span>');
  });

  it('draws a value carrying markup as its text', () => {
    const out = html(front('tipo: <script>alert(1)</script>'));
    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;script&gt;');
  });

  it('draws a wikilink in a value as a link where the host resolved it, or as pending', () => {
    const out = html(front('autor: "[[Ana]]"\nfontes: ["[[Livro|o livro]]", "[[Nada]]"]'), notebook({ Ana: '', Livro: '' }));
    expect(out).toContain('<dt>autor</dt><dd><a class="wikilink" href="/notes/Ana">Ana</a></dd>');
    expect(out).toContain('<span class="property-chip"><a class="wikilink" href="/notes/Livro">o livro</a></span>');
    expect(out).toMatch(/<span class="property-chip"><span class="wikilink-pending"[^>]*>Nada<\/span><\/span>/);
  });

  it('draws nothing for a note with no frontmatter', () => {
    expect(html('Just a body.')).not.toContain('note-properties');
  });
});

describe('a theme decides how the frontmatter is drawn', () => {
  it('hands the properties slot the name, the entries and a way to draw a value', async () => {
    const properties = vi.fn(({ name, entries, value }: PropertiesSlotProps) => (
      <pre className="yaml">
        {`name: ${name}\n`}
        {entries.map((entry) => (
          <span key={entry.key}>
            {entry.key}: {value(entry.values.join(', '))}
          </span>
        ))}
      </pre>
    ));
    const theme = defineTheme({ name: 'yaml', components: { properties } });
    const note = await draw(front('name: Nota\nautor: "[[Ana]]"'), { ...notebook({ Ana: '' }), theme });
    expect(properties).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Nota', entries: [{ key: 'autor', shape: 'text', values: ['[[Ana]]'] }] }),
      undefined,
    );
    expect(note.container.querySelector('pre.yaml a.wikilink')?.getAttribute('href')).toBe('/notes/Ana');
    expect(note.container.querySelector('.note-properties')).toBeNull();
    note.unmount();
  });

  it('may draw nothing, as a host that shows properties elsewhere does', () => {
    const out = html(front('name: Nota\ntipo: medida'), { theme: defineTheme({ name: 'host', components: { properties: () => null } }) });
    expect(out).not.toContain('Nota');
    expect(out).not.toContain('medida');
    expect(out).toContain('The body.');
  });

  it("draws a value's wikilink through the theme's wikilink slot too", () => {
    const theme = defineTheme({ name: 'arrows', components: { wikilink: ({ link, children }) => link(<>→ {children}</>) } });
    expect(html(front('autor: "[[Ana]]"'), { ...notebook({ Ana: '' }), theme })).toContain('<a class="wikilink" href="/notes/Ana">→ Ana</a>');
  });

  it('leaves the task ordinals counted over the whole note', async () => {
    const ticks: number[] = [];
    const note = await draw(front('tags: [a]').replace('The body.', '- [ ] one\n- [ ] two'), {
      writable: true,
      onToggleTask: (ordinal) => ticks.push(ordinal),
    });
    const boxes = [...note.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    await act(async () => boxes[1]!.click());
    expect(ticks).toEqual([1]);
    note.unmount();
  });
});
