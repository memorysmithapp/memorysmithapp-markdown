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
      { slugs: ['um', 'citado', 'dois'], firstBlock: 0, firstProperties: 0, numbers: [null, null, null] },
      { slugs: ['um-1'], firstBlock: 0, firstProperties: 0, numbers: [null] },
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

describe('the figures, tables and attachments of a contents (#175)', () => {
  const kept: Record<string, { mimeType: string; description?: string }> = {
    'fachada.jpg': { mimeType: 'image/jpeg', description: 'Fachada após a reforma' },
    'planta.png': { mimeType: 'image/png' },
    'contrato.pdf': { mimeType: 'application/pdf', description: 'Contrato de obra assinado' },
  };
  const files = {
    keeps: (name: string) => name in kept,
    fileOf: (name: string) => (name in kept ? { ...kept[name]!, bytes: 10, url: `/files/${name}` } : null),
  };
  const LISTS = '```contents\nfigures:\ntables:\nattachments:\n```\n\n';

  it('lists an image alone in its paragraph as a figure, by its title, its description, its name', () => {
    const page = html(`${LISTS}![Rua](https://example.org/rua.jpg "A rua em março")\n\n![[fachada.jpg]]\n\n![](../assets/planta.png)\n\nInline ![x](https://example.org/i.png) is no figure.\n\n![[contrato.pdf]]\n`, files);
    const figures = page.slice(page.indexOf('data-list="figures"'), page.indexOf('data-list="attachments"'));
    expect(figures).toContain('<span class="contents-number">Figure 1</span> A rua em março');
    expect(figures).toContain('<span class="contents-number">Figure 2</span> Fachada após a reforma');
    expect(figures).toContain('<span class="contents-number">Figure 3</span> planta.png');
    expect(figures).not.toContain('Figure 4');
    expect(figures).not.toContain('i.png');
    expect(page).toContain('id="contents-figure-1"');
  });

  it('draws the line under a figure only where its kind is listed', () => {
    const listed = html(`${LISTS}![Rua](https://example.org/rua.jpg "A rua em março")\n`);
    expect(listed).toContain('<span class="figure-caption"><span class="caption-number">Figure 1</span> A rua em março</span>');
    const unlisted = html('```contents\n```\n\n![Rua](https://example.org/rua.jpg "A rua em março")\n');
    expect(unlisted).not.toContain('figure-caption');
    const printOnly = html('```contents\nprint:\n  figures:\n```\n\n![Rua](https://example.org/rua.jpg "A rua")\n');
    expect(printOnly).toContain('<span class="figure-caption" data-media="print">');
  });

  it('counts a kept image a figure without fileOf only when it is written as an image', () => {
    const page = html(`${LISTS}![](../assets/planta.png)\n\n![[fachada.jpg]]\n`, { keeps: files.keeps });
    expect(page).toContain('Figure 1</span> planta.png');
    expect(page).not.toContain('Figure 2');
  });

  it('takes a Table: caption as the caption, drawn without its keyword even with no list', () => {
    const table = '| a | b |\n|---|---|\n| 1 | 2 |\n\nTable: Previsão de [[Despesas]]\n';
    const unlisted = html(table);
    expect(unlisted).toContain('<p class="table-caption">Previsão de ');
    expect(unlisted).not.toContain('Table:');
    expect(unlisted).not.toContain('caption-number');
    const listed = html(`${LISTS}${table}\n| c |\n|---|\n| 3 |\n`);
    expect(listed).toContain('<p class="table-caption"><span class="caption-number">Table 1 </span>Previsão de ');
    expect(listed).toContain('<p class="table-caption"><span class="caption-number">Table 2</span></p>');
    expect(listed).toContain('<span class="contents-number">Table 1</span> Previsão de ');
    expect(listed).toContain('href="#contents-table-2"');
    expect(listed).toContain('<table id="contents-table-1">');
  });

  it('reads a caption only on the paragraph after a blank line, the line under a table being a row', () => {
    const page = html('| a |\n|---|\n| 1 |\nTable: not a caption\n');
    expect(page).not.toContain('table-caption');
    expect(page).toContain('<td>Table: not a caption</td>');
  });

  it('lists each kept file once, by its title, its description, its name, where it is first referenced', () => {
    const page = html(`${LISTS}See ![[contrato.pdf]] and ![[contrato.pdf]].\n\n![Planta](../assets/planta.png "A planta baixa")\n\n![[fachada.jpg]]\n\n![](missing.png)\n`, files);
    const attachments = page.slice(page.indexOf('data-list="attachments"'), page.indexOf('</nav>'));
    expect(attachments).toContain('href="#contents-attachment-1"');
    expect(attachments).toContain('Contrato de obra assinado');
    expect(attachments).toContain('A planta baixa');
    expect(attachments).toContain('Fachada após a reforma');
    expect(attachments).not.toContain('missing.png');
    expect(page.match(/id="contents-attachment-1"/g)).toHaveLength(1);
  });

  it('names a table block by its title, else its table, and leads a printed appendix there', () => {
    const queryTable = async () => ({ schema: { name: 'despesas', columns: [{ name: 'a', kind: 'text' as const }] }, rows: [], count: 0, total: null, readAt: '2026-11-22' });
    const note = `${LISTS}\`\`\`table\ntable: despesas\ntitle: Despesas pendentes\n\`\`\`\n\n\`\`\`table\ntable: receitas\n\`\`\`\n\n| a |\n|---|\n| 1 |\n\nTable: Votação\n`;
    const page = html(note, { queryTable });
    expect(page).toContain('<span class="contents-number">Table 1</span> Despesas pendentes');
    expect(page).toContain('<span class="contents-number">Table 2</span> receitas');
    expect(page).toContain('<div id="contents-table-1" class="table-block-figure">');
    const printed = html(note, { queryTable, printing: true, tablesAsAppendices: true });
    expect(printed).toContain('href="#table-appendix-3"');
    expect(printed).toContain('Appendix 3 — Votação');
    expect(printed).toContain('Appendix 1 — Despesas pendentes');
    // The caption went with its table.
    expect(printed).not.toContain('<p class="table-caption">');
  });

  it('draws no list that has nothing to list, and nothing when no list has (#181)', () => {
    const empty = html('```contents\nheadings:\nfigures:\ntables:\nattachments:\n```\n\n# Only a heading\n');
    expect(empty).toContain('data-list="headings"');
    expect(empty).not.toContain('data-list="figures"');
    expect(empty).not.toContain('data-list="tables"');
    expect(empty).not.toContain('data-list="attachments"');
    expect(empty).not.toContain('>Figures<');
    const none = html('```contents\nheadings:\nfigures:\n```\n\nNo heading, no figure.\n');
    expect(none).not.toContain('<nav');
    expect(none).not.toContain('Contents');
    expect(none).not.toContain('language-contents');
    const printed = html('```contents\nprint:\n  place: start\n```\n\nNo heading.\n', { printing: true });
    expect(printed).not.toContain('<nav');
  });

  it('keeps an empty contents busy and hidden while a figure may still come (#181)', () => {
    const page = html("```contents\nfigures:\n```\n\n![[fachada.jpg]]\n", { keeps: () => true, fileOf: () => new Promise<null>(() => {}) });
    expect(page).toContain('<nav class="contents" aria-busy="true" hidden="">');
    expect(page).not.toContain('contents-title');
  });

  it('lists nothing of an embed', async () => {
    const embedded = '---\nname: Capítulo\n---\n![Rua](https://example.org/rua.jpg "A rua")\n\n| a |\n|---|\n| 1 |\n';
    mounted = await draw(`${LISTS}![[Capítulo]]\n`, {
      resolve: (name) => (name === 'Capítulo' ? '/notes/capitulo' : null),
      loadNote: async () => ({ name: 'Capítulo', address: '/notes/capitulo', markdown: embedded }),
    });
    await act(async () => {});
    expect(mounted.container.querySelectorAll('.contents-entry')).toHaveLength(0);
    expect(mounted.container.querySelector('.embed .figure-caption')).toBeNull();
    expect(mounted.container.querySelector('.embed .table-caption')).toBeNull();
  });
});
