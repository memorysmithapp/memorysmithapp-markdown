/**
 * The frontmatter is content: read as the specification reads it (§6), and
 * drawn above the body as the theme decides — the default theme's title and
 * properties, or whatever a theme's `properties` slot draws, or nothing.
 */

import { act } from 'react';
import { cases } from '@memorysmithapp/markdown-spec';
import { describe, expect, it, vi } from 'vitest';
import { defineTheme, readProperties, type PropertiesSlotProps } from '../src/index.js';
import { notebook } from './notebook.js';
import { draw, html } from './render.js';

const front = (lines: string) => `---\n${lines}\n---\n\nThe body.`;

describe('the name of a note, as the conformance suite states it (§5.3, §6.5)', () => {
  const named = cases.filter((testCase) => testCase.name !== undefined);

  it('has name cases to read', () => {
    expect(named.length).toBeGreaterThan(10);
  });

  it.each(named.map((testCase) => [testCase.id, testCase.markdown, testCase.name] as const))('%s', (_id, markdown, name) => {
    expect(readProperties(markdown).name).toBe(name);
  });

  it('draws a name carrying a # as no name, as the kernel reads it (#41)', () => {
    const out = html('---\nname: Incident #4711 · Region loss\n---\n\nBody.');
    expect(out).toContain('<h1 class="note-title note-unnamed">Unnamed note</h1>');
    expect(out).not.toContain('Incident #4711');
  });
});

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
          'none: []',
        ].join('\n'),
      ),
    );
    expect(entries).toEqual([
      { key: 'created', shape: 'date', values: ['2026-09-03'] },
      { key: 'stamped', shape: 'date', values: ['2026-09-03T10:00:00Z'] },
      { key: 'reviewed', shape: 'boolean', values: ['Yes'] },
      { key: 'draft', shape: 'boolean', values: ['false'] },
      { key: 'maturity', shape: 'text', values: ['evergreen'] },
      { key: 'summary', shape: 'prose', values: ['a sentence that runs well past forty characters'] },
      { key: 'tags', shape: 'list', values: ['medida', 'analise'] },
      { key: 'one', shape: 'list', values: ['only'] },
      { key: 'steps', shape: 'list', values: ['first', 'second'] },
      { key: 'blank', shape: 'empty', values: [] },
      { key: 'none', shape: 'empty', values: [] },
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
    ['name: Índice de Polifenóis', 'tipo: medida', 'tags: [medida, analise]', 'reviewed: true', 'updated: 2026-03-30', 'aliases: [IPT]', 'vazio: []'].join('\n'),
  );

  it("draws the name as the title, and the properties as MemorySmith's page does, above the body", () => {
    const out = html(NOTE);
    expect(out).toContain('<h1 class="note-title">Índice de Polifenóis</h1><details class="properties-box" open=""><summary>Properties</summary>');
    // The reserved keys first, in the order of the specification, then the rest as written; an empty one is not drawn.
    const keys = [...out.matchAll(/<span class="metadata-property-key">([^<]+)<\/span>/g)].map((match) => match[1]);
    expect(keys).toEqual(['aliases', 'tags', 'tipo', 'reviewed', 'updated']);
    expect(out).toContain(
      '<div class="metadata-property" data-property-type="list"><span class="metadata-property-key">tags</span><span class="metadata-property-value"><span class="prop-tags"><span class="prop-tag">medida</span><span class="prop-tag">analise</span></span></span></div>',
    );
    expect(out).toContain('data-property-type="checkbox"><span class="metadata-property-key">reviewed</span><span class="metadata-property-value"><span title="true">Yes</span>');
    expect(out).toContain('data-property-type="date"><span class="metadata-property-key">updated</span><span class="metadata-property-value"><time dateTime="2026-03-30" title="2026-03-30">Mar 30, 2026</time>');
    expect(out.indexOf('</details>')).toBeLessThan(out.indexOf('The body.'));
  });

  it("writes a boolean in the reader's words and a date in the reader's locale", () => {
    const out = html(front('reviewed: no\nupdated: 2026-03-30'), { strings: { no: 'Não', locale: 'pt-BR' } });
    expect(out).toContain('<span title="no">Não</span>');
    expect(out).toContain('<time dateTime="2026-03-30" title="2026-03-30">30 de mar. de 2026</time>');
  });

  it('names a note with no name as unnamed, as MemorySmith does', () => {
    expect(html('Just a body.')).toContain('<h1 class="note-title note-unnamed">Unnamed note</h1>');
    expect(html('Just a body.')).not.toContain('properties-box');
  });

  it('draws a value carrying markup as its text', () => {
    const out = html(front('tipo: <script>alert(1)</script>'));
    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;script&gt;');
  });

  it('draws a wikilink, a Markdown link and a bare address in a value as links', () => {
    const out = html(
      front('autor: "[[Ana]]"\nfontes: ["[[Livro|o livro]]", "[[Nada]]"]\nsite: "[a política](https://example.org/p)"\nurl: https://example.org/x\nmau: "[x](javascript:alert(1))"'),
      notebook({ Ana: '', Livro: '' }),
    );
    expect(out).toContain('<span class="metadata-property-value"><a class="wikilink" href="/notes/Ana">Ana</a></span>');
    expect(out).toContain('<span class="prop-tag"><a class="wikilink" href="/notes/Livro">o livro</a></span>');
    expect(out).toMatch(/<span class="prop-tag"><span class="wikilink-pending"[^>]*>Nada<\/span><\/span>/);
    expect(out).toContain('<a href="https://example.org/p" target="_blank" rel="noreferrer">a política</a>');
    expect(out).toContain('<a href="https://example.org/x" target="_blank" rel="noreferrer">https://example.org/x</a>');
    expect(out).not.toContain('href="javascript:');
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
