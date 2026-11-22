// The `contents` block (`SPEC.md` §7.17, #173): read as settings, resolved over the host's, and
// drawn as the note's headings, nested, linked to the ids the headings carry.

import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanContents, readContents, resolveBlock, resolveHost } from '../src/contents.js';
import { planOutline, Slugger, slugOf } from '../src/outline.js';
import { html, draw, type Mounted } from './render.js';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const NOTE = (block: string) => `---\nname: Ata\n---\nResumo da reunião.\n\n${block}\n# Abertura\n\nTexto.\n\n# Deliberações\n\n## Orçamento 2027\n\n### Detalhe\n\n#### Mais fundo\n\n# Encerramento\n`;

describe('readContents', () => {
  it('reads an empty block as no settings, which draws the headings', () => {
    expect(readContents('')).toEqual({ settings: {}, problems: [] });
  });

  it('reads groups, options, media, none and place, with case folded', () => {
    const { settings, problems } = readContents('Headings:\n  Title: Sumário\n  depth: 2\nprint:\n  place: START\n  headings:\n    depth: 3\nscreen: NONE\n');
    expect(problems).toEqual([]);
    expect(settings).toEqual({ headings: { title: 'Sumário', depth: 2 }, print: { place: 'start', headings: { depth: 3 } }, screen: 'none' });
  });

  it('keeps the order the lists are written in', () => {
    expect(Object.keys(readContents('headings:\nplace: end\n').settings)).toEqual(['headings', 'place']);
  });

  it('reports an unknown key, a repeat, a line under no group and a bad indent, and reads the rest', () => {
    const { settings, problems } = readContents('colour: blue\nheadings:\n  depth: 2\n  depth: 4\n    title: X\n  wrong\n\tdepth: 1\nscreen:\n  screen:\n');
    expect(settings).toEqual({ headings: { depth: 2 }, screen: {} });
    expect(problems).toEqual([
      { code: 'contents-key-unknown', line: 1 },
      { code: 'contents-key-unknown', line: 4 },
      { code: 'contents-key-unknown', line: 5 },
      { code: 'contents-key-unknown', line: 6 },
      { code: 'contents-key-unknown', line: 7 },
      { code: 'contents-key-unknown', line: 9 },
    ]);
  });

  it('reports a value its key cannot take, and a group written with a value', () => {
    const { settings, problems } = readContents('headings: yes\nplace: middle\nprint: maybe\nscreen:\n  headings:\n    depth: 9\n');
    expect(settings).toEqual({ screen: { headings: {} } });
    expect(problems.map((problem) => [problem.code, problem.line])).toEqual([
      ['contents-value-invalid', 1],
      ['contents-value-invalid', 2],
      ['contents-value-invalid', 3],
      ['contents-value-invalid', 6],
    ]);
  });

  it('does not take depth outside the headings, nor a medium inside a medium', () => {
    expect(readContents('print:\n  print:\n').problems).toEqual([{ code: 'contents-key-unknown', line: 2 }]);
  });
});

describe('the resolution', () => {
  const host = cleanContents({ headings: { title: 'Índice', depth: 4 }, print: { place: 'start', headings: { depth: 6 } } });

  it('takes the note medium, then the note root, then the host medium, then the host root, then the default', () => {
    const block = readContents('headings:\n  depth: 2\n').settings;
    expect(resolveBlock(block, host, 'screen')).toEqual({ lists: [{ kind: 'headings', title: 'Índice', depth: 2 }], place: null });
    expect(resolveBlock(block, host, 'print')).toEqual({ lists: [{ kind: 'headings', title: 'Índice', depth: 2 }], place: null });
    expect(resolveBlock({}, null, 'screen')).toEqual({ lists: [{ kind: 'headings', title: null, depth: 3 }], place: null });
    expect(resolveBlock({}, host, 'print')).toEqual({ lists: [{ kind: 'headings', title: 'Índice', depth: 6 }], place: null });
  });

  it('never inherits the host place, and takes the block own', () => {
    expect(resolveBlock({}, host, 'print')?.place).toBeNull();
    expect(resolveBlock(readContents('print:\n  place: end\n').settings, host, 'print')?.place).toBe('end');
    expect(resolveBlock(readContents('place: start\nprint:\n  place: end\n').settings, null, 'screen')?.place).toBe('start');
  });

  it('draws nothing in a medium the block says none', () => {
    expect(resolveBlock(readContents('screen: none\n').settings, host, 'screen')).toBeNull();
    expect(resolveBlock(readContents('screen: none\n').settings, host, 'print')).not.toBeNull();
  });

  it('draws the host contents in the media it names, at the start unless it says', () => {
    const printOnly = cleanContents({ print: { headings: null } });
    expect(resolveHost(printOnly, 'screen')).toBeNull();
    expect(resolveHost(printOnly, 'print')).toEqual({ lists: [{ kind: 'headings', title: null, depth: 3 }], place: 'start' });
    expect(resolveHost(cleanContents({ headings: null, place: 'end', print: 'none' }), 'screen')?.place).toBe('end');
    expect(resolveHost(cleanContents({ headings: null, print: 'none' }), 'print')).toBeNull();
    expect(resolveHost(null, 'screen')).toBeNull();
  });

  it('leaves out of the host settings what they cannot mean', () => {
    expect(cleanContents({ headings: { depth: 9, title: '' }, colour: 'blue', place: 'middle', print: { print: {} } })).toEqual({ headings: {}, print: {} });
    expect(cleanContents('contents')).toBeNull();
  });
});

describe('the outline', () => {
  it('slugs a heading as GitHub does, a repeat taking -1 and -2', () => {
    expect(slugOf('Orçamento 2027: o plano!')).toBe('orçamento-2027-o-plano');
    const slugger = new Slugger();
    expect(['Notas', 'Notas', 'Notas', 'Notas 1'].map((text) => slugger.slug(text))).toEqual(['notas', 'notas-1', 'notas-2', 'notas-1-1']);
  });

  it('counts the slugs across the runs, and lists only the headings at the top level', () => {
    const outline = planOutline(['# Um\n\n> ## Citado\n\n## Dois\n', '# Um\n\n```contents\n```\n']);
    expect(outline.runs).toEqual([
      { slugs: ['um', 'citado', 'dois'], firstBlock: 0, numbers: [null, null, null] },
      { slugs: ['um-1'], firstBlock: 0, numbers: [null] },
    ]);
    expect(outline.headings.map((heading) => [heading.id, heading.level])).toEqual([
      ['user-content-um', 1],
      ['user-content-dois', 2],
      ['user-content-um-1', 1],
    ]);
    expect(outline.blocks).toEqual(['']);
  });
});

describe('the contents drawn', () => {
  it('lists the whole note, nested, to the depth, linked to the ids of its headings', () => {
    const page = html(NOTE('```contents\n```\n'));
    expect(page).toContain('<nav class="contents">');
    expect(page).toContain('<p class="contents-title">Contents</p>');
    expect(page).toContain('<h1 data-heading="abertura" id="user-content-abertura">Abertura</h1>');
    expect(page).toContain('href="#user-content-deliberações"');
    expect(page).toContain('href="#user-content-detalhe"');
    expect(page).not.toContain('href="#user-content-mais-fundo"');
    // Orçamento sits under Deliberações.
    expect(page).toMatch(/Deliberações<\/a><ol class="contents-entries"><li class="contents-item"><a href="#user-content-orçamento-2027"/);
    // The block is no code block.
    expect(page).not.toContain('language-contents');
  });

  it('draws the title and the depth a block writes, and the headings above it too', () => {
    const page = html(`# Antes\n\n\`\`\`contents\nheadings:\n  title: Sumário\n  depth: 1\n\`\`\`\n\n# Depois\n\n## Fundo\n`);
    expect(page).toContain('<p class="contents-title">Sumário</p>');
    expect(page).toContain('href="#user-content-antes"');
    expect(page).toContain('href="#user-content-depois"');
    expect(page).not.toContain('href="#user-content-fundo"');
  });

  it('draws an entry as its heading: marks kept, a link its text, a footnote reference gone', () => {
    const page = html('```contents\n```\n\n# A **lei** e [o artigo](https://example.org)[^1]\n\n[^1]: Nota.\n');
    expect(page).toMatch(/class="contents-entry">A <strong>lei<\/strong> e o artigo<\/a>/);
  });

  it('draws a block where it is written, and moves it where place says', () => {
    const page = html(NOTE('```contents\nplace: end\n```\n'));
    expect(page.indexOf('<nav class="contents"')).toBeGreaterThan(page.indexOf('Encerramento</h1>'));
  });

  it('marks each medium where they differ, and draws the print alone when the host prints', () => {
    const block = '```contents\nheadings:\n  depth: 1\nprint:\n  headings:\n    depth: 2\n```\n';
    const page = html(NOTE(block));
    expect(page).toContain('<nav class="contents" data-media="screen">');
    expect(page).toContain('<nav class="contents" data-media="print">');
    const printed = html(NOTE(block), { printing: true });
    expect(printed).not.toContain('data-media');
    expect(printed).toContain('href="#user-content-orçamento-2027"');
  });

  it('draws nothing on the screen for a block that says none there', () => {
    const page = html(NOTE('```contents\nscreen: none\n```\n'));
    expect(page).not.toContain('data-media="screen"');
    expect(page).toContain('<nav class="contents" data-media="print">');
  });

  it('draws the host contents where a note has no block, and never beside a block', () => {
    const contents = { print: { place: 'start' as const, headings: null } };
    const page = html(NOTE(''), { contents, printing: true });
    expect(page.indexOf('<nav class="contents"')).toBeLessThan(page.indexOf('Resumo da reunião'));
    expect(page.indexOf('<nav class="contents"')).toBeGreaterThan(page.indexOf('Ata'));
    const declined = html(NOTE('```contents\nprint: none\n```\n'), { contents, printing: true });
    expect(declined).not.toContain('<nav class="contents"');
    expect(html(NOTE(''), { contents })).toContain('data-media="print"');
  });

  it('takes the host options as the defaults of a block', () => {
    const page = html(NOTE('```contents\n```\n'), { contents: { headings: { title: 'Índice', depth: 1 } } });
    expect(page).toContain('<p class="contents-title">Índice</p>');
    expect(page).not.toContain('href="#user-content-orçamento-2027"');
  });

  it('draws nothing inside an embed, whose headings carry a slug and no id', async () => {
    const embedded = '---\nname: Capítulo\n---\n```contents\n```\n\n# Abertura\n';
    mounted = await draw('# Abertura\n\n![[Capítulo]]\n', {
      resolve: (name) => (name === 'Capítulo' ? '/notes/capitulo' : null),
      loadNote: async () => ({ name: 'Capítulo', address: '/notes/capitulo', markdown: embedded }),
    });
    await act(async () => {});
    const embed = mounted.container.querySelector('.embed')!;
    expect(embed.querySelector('nav.contents')).toBeNull();
    expect(embed.querySelector('pre')).toBeNull();
    expect(embed.querySelector('h1')?.getAttribute('data-heading')).toBe('abertura');
    expect(embed.querySelector('h1')?.hasAttribute('id')).toBe(false);
    expect(mounted.container.querySelector('h1[data-heading]')?.id).toBe('user-content-abertura');
  });

  it('scrolls to a heading from its entry and from a link written as #slug', async () => {
    mounted = await draw('```contents\n```\n\nSee [the end](#fim).\n\n# Fim\n');
    const heading = mounted.container.querySelector('h1[data-heading]')!;
    let scrolled = 0;
    heading.scrollIntoView = () => {
      scrolled++;
    };
    act(() => (mounted!.container.querySelector('.contents-entry') as HTMLElement).click());
    act(() => (mounted!.container.querySelector('a[href="#fim"]') as HTMLElement).click());
    expect(scrolled).toBe(2);
  });
});
