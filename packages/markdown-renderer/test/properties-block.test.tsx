// The `properties` block (`SPEC.md` §7.18, #172): which keys of the frontmatter are drawn, under
// which title, folded or open, where, and in which medium; and the host's settings for a note that
// declares none.

import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { defineTheme } from '../src/index.js';
import { cleanProperties, readPropertiesBlock, resolvePropertiesBlock, resolvePropertiesHost } from '../src/properties-block.js';
import { draw, html, type Mounted } from './render.js';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const FRONT = '---\nname: Ata de novembro\nstatus: aprovada\ndata: 2026-11-20\nresponsavel: Síndico\ntags: [condominio, ata]\n---\n';

describe('readPropertiesBlock', () => {
  it('reads keys, title, fold, place and the media, with case folded', () => {
    const { settings, problems } = readPropertiesBlock('keys: status, responsavel\nFold: CLOSED\nprint:\n  place: end\n  keys: [status, "data"]\n  title: Registro\nscreen: none\n');
    expect(problems).toEqual([]);
    expect(settings).toEqual({ keys: ['status', 'responsavel'], fold: 'closed', print: { place: 'end', keys: ['status', 'data'], title: 'Registro' }, screen: 'none' });
  });

  it('reports an unknown key, a repeat, a bad indent and a value its key cannot take, and reads the rest', () => {
    const { settings, problems } = readPropertiesBlock('colour: blue\nfold: half\nkeys: status\nkeys: data\nprint: maybe\nscreen:\n  screen:\n    fold: open\n');
    expect(settings).toEqual({ keys: ['status'], screen: {} });
    expect(problems.map((problem) => `${problem.code}@${problem.line}`)).toEqual([
      'properties-key-unknown@1',
      'properties-value-invalid@2',
      'properties-key-unknown@4',
      'properties-value-invalid@5',
      'properties-key-unknown@7',
      'properties-key-unknown@8',
    ]);
  });

  it('resolves the block over the host, its place never the host', () => {
    const host = cleanProperties({ title: 'Dados', place: 'end', print: { fold: 'open' } });
    const block = readPropertiesBlock('keys: status\nfold: closed\n').settings;
    expect(resolvePropertiesBlock(block, host, 'screen')).toEqual({ keys: ['status'], title: 'Dados', fold: 'closed', place: null });
    expect(resolvePropertiesBlock(block, host, 'print')).toEqual({ keys: ['status'], title: 'Dados', fold: 'closed', place: null });
    expect(resolvePropertiesBlock(readPropertiesBlock('print: none\n').settings, host, 'print')).toBeNull();
    expect(resolvePropertiesHost(null, 'screen')).toEqual({ keys: null, title: null, fold: null, place: 'start' });
    expect(resolvePropertiesHost(host, 'print')).toEqual({ keys: null, title: 'Dados', fold: 'open', place: 'end' });
    expect(resolvePropertiesHost(cleanProperties({ print: 'none' }), 'print')).toBeNull();
  });
});

describe('the properties drawn', () => {
  it('draws a note with no block and no settings exactly as before', () => {
    const page = html(`${FRONT}Body.\n`);
    expect(page).toMatch(/<h1 class="note-title">Ata de novembro<\/h1><details class="properties-box" open=""><summary>Properties<\/summary>/);
    expect(page.match(/metadata-property-key/g)).toHaveLength(4);
  });

  it('draws only the keys a block names, in its order, where it is written, the name staying the title', () => {
    const page = html(`${FRONT}Antes.\n\n\`\`\`properties\nkeys: responsavel, status, local\ntitle: Registro\n\`\`\`\n\nDepois.\n`);
    expect(page).toMatch(/<h1 class="note-title">Ata de novembro<\/h1><div class="markdown"><p>Antes.<\/p>/);
    const box = page.slice(page.indexOf('<details'));
    expect(box).toMatch(/^<details class="properties-box" open=""><summary>Registro<\/summary>/);
    expect([...box.matchAll(/metadata-property-key">([^<]+)</g)].map((match) => match[1])).toEqual(['responsavel', 'status']);
    expect(page.indexOf('<details')).toBeGreaterThan(page.indexOf('Antes.'));
    expect(page.indexOf('<details')).toBeLessThan(page.indexOf('Depois.'));
    expect(page).not.toContain('language-properties');
  });

  it('folds and moves the entries as a block says, per medium, and prints the print alone', () => {
    const block = '```properties\nkeys: status\nfold: closed\nprint:\n  place: end\n  keys: status, data\n```\n';
    const page = html(`${FRONT}${block}\nBody.\n`);
    expect(page).toContain('<details class="properties-box" data-media="screen"><summary>Properties</summary>');
    expect(page.indexOf('data-media="print"')).toBeGreaterThan(page.indexOf('Body.'));
    const printed = html(`${FRONT}${block}\nBody.\n`, { printing: true });
    expect(printed).not.toContain('data-media');
    expect(printed.indexOf('<details')).toBeGreaterThan(printed.indexOf('Body.'));
    expect([...printed.matchAll(/metadata-property-key">([^<]+)</g)].map((match) => match[1])).toEqual(['status', 'data']);
  });

  it('draws the host settings for a note with no block, and never beside a block', () => {
    const settings = { keys: ['status'], print: { place: 'end' as const } };
    const page = html(`${FRONT}Body.\n`, { properties: settings, printing: true });
    expect(page).toMatch(/<h1 class="note-title">Ata de novembro<\/h1><div class="markdown">/);
    expect(page.indexOf('<details')).toBeGreaterThan(page.indexOf('Body.'));
    const declined = html(`${FRONT}\`\`\`properties\nprint: none\n\`\`\`\n\nBody.\n`, { properties: settings, printing: true });
    expect(declined).not.toContain('<details');
    const none = html(`${FRONT}Body.\n`, { properties: { print: 'none' }, printing: true });
    expect(none).not.toContain('<details');
    expect(none).toContain('<h1 class="note-title">Ata de novembro</h1>');
  });

  it('hands the theme slot the chosen keys and the options, and a slot that draws nothing still wins', () => {
    const calls: unknown[] = [];
    const theme = defineTheme({
      name: 'spy',
      components: {
        properties: (props) => {
          calls.push({ name: props.name, keys: props.entries.map((entry) => entry.key), part: props.part, title: props.title, fold: props.fold });
          return null;
        },
      },
    });
    const page = html(`${FRONT}\`\`\`properties\nkeys: status\ntitle: Registro\n\`\`\`\n`, { theme });
    expect(calls).toEqual([
      { name: 'Ata de novembro', keys: [], part: 'name', title: undefined, fold: undefined },
      { name: null, keys: ['status'], part: 'entries', title: 'Registro', fold: undefined },
    ]);
    expect(page).not.toContain('metadata-property');
  });

  it('draws nothing inside an embed', async () => {
    mounted = await draw('![[Capítulo]]\n', {
      resolve: (name) => (name === 'Capítulo' ? '/notes/capitulo' : null),
      loadNote: async () => ({ name: 'Capítulo', address: '/notes/capitulo', markdown: `${FRONT}\`\`\`properties\n\`\`\`\n` }),
    });
    await act(async () => {});
    expect(mounted.container.querySelector('.embed details, .embed pre')).toBeNull();
  });
});
