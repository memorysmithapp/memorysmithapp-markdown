/**
 * What a link of a note becomes on the page, under the host contract: a note
 * the host resolves, a pending link, a refused address, a choice between
 * notes, a file the notebook keeps, and the notice of what a note fetched.
 */

import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { LinkChoices } from '../src/index.js';
import { draw, html } from './render.js';

const notes: Record<string, string> = { 'Lei 14.133': '/notes/lei', Ação: '/notes/acao' };
const resolve = (name: string): string | null => notes[name] ?? null;

async function click(element: Element | null | undefined): Promise<void> {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  });
  await act(async () => new Promise((done) => setTimeout(done, 200)));
}

describe('a wikilink to a note the host resolves', () => {
  it("is drawn through the host's router, at the address the host gave", () => {
    const out = html('Ver [[Lei 14.133]] e [[Lei 14.133|a nova lei]].', {
      resolve,
      renderLink: ({ href, className, children }) => (
        <a data-router="" className={className} href={href}>
          {children}
        </a>
      ),
    });
    expect(out).toContain('<a data-router="" class="wikilink" href="/notes/lei">Lei 14.133</a>');
    expect(out).toContain('<a data-router="" class="wikilink" href="/notes/lei">a nova lei</a>');
  });

  it('is resolved by its name after NFC, and by nothing else', () => {
    const asked: string[] = [];
    html('[[Ação]] [[ação]] [[Lei 14.133#Artigo 75]]'.normalize('NFD'), {
      resolve: (name) => {
        asked.push(name);
        return resolve(name);
      },
    });
    expect(asked).toEqual(['Ação', 'ação'.normalize('NFC'), 'Lei 14.133']);
  });

  it('keeps the anchor out of the target and shows the whole text', () => {
    expect(html('[[Lei 14.133#Artigo 75]]', { resolve })).toContain('href="/notes/lei">Lei 14.133#Artigo 75</a>');
  });
});

describe('a wikilink no note answers', () => {
  it('is pending, drawn as such and never as a link, with its title', () => {
    const out = html('Ver [[Uma nota que ninguém escreveu]].', { resolve });
    expect(out).toContain(
      '<span class="wikilink-pending" title="Pending link: the target note does not exist yet.">Uma nota que ninguém escreveu</span>',
    );
  });

  it('is pending when the host resolves nothing at all, which is the safe default', () => {
    expect(html('[[Lei 14.133]]')).toContain('class="wikilink-pending"');
  });

  it('is pending in the words of the host', () => {
    expect(html('[[x]]', { strings: { pendingLink: 'Link pendente' } })).toContain('title="Link pendente"');
  });
});

describe('a wikilink inside code, a fence or a table cell', () => {
  it('stays characters inside a code span and a fence', () => {
    const out = html('Escreva `[[Lei 14.133]]`.\n\n```\n[[Lei 14.133]]\n```', { resolve });
    expect(out).toContain('<code>[[Lei 14.133]]</code>');
    expect(out).toContain('<code>[[Lei 14.133]]\n</code>');
    expect(out).not.toContain('class="wikilink"');
  });

  it('is a link inside a table cell, and its escaped pipe ends the target', () => {
    const out = html('| Regra | Onde |\n|---|---|\n| Geral | [[Lei 14.133\\|art. 75]] |', { resolve });
    expect(out).toContain('<td><a class="wikilink" href="/notes/lei">art. 75</a></td>');
    expect((out.match(/<table>/g) ?? []).length).toBe(1);
  });
});

describe('a target more than one note answers', () => {
  const choices: LinkChoices = {
    by: 'name',
    notes: [
      { name: 'Visão Geral', address: '/notes/1', trail: ['Código'], folderDescription: 'Como o código se organiza.' },
      { name: 'Visão Geral', address: '/notes/2', trail: [], folderDescription: '' },
    ],
  };
  const several = {
    resolve,
    reaches: (name: string) => (name === 'Visão Geral' ? 2 : resolve(name) ? 1 : 0),
    choose: vi.fn(async () => choices),
    targetAddress: (name: string) => `/links/${encodeURIComponent(name)}`,
  };

  it('is a link that announces the choice it opens, with an address for a new tab', () => {
    const out = html('[[Visão Geral]]', several);
    expect(out).toContain('<span class="link-choice"><a href="/links/Vis%C3%A3o%20Geral" class="wikilink"');
    expect(out).toContain('aria-haspopup="dialog"');
  });

  it('opens the choice in place, leading each option with its folder trail', async () => {
    const note = await draw('[[Visão Geral]]', several);
    await click(note.container.querySelector('.link-choice a'));
    const dialog = note.container.querySelector('dialog.link-choice-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-label')).toBe('The notes the link “Visão Geral” may lead to');
    expect(dialog?.querySelector('h2')?.textContent).toBe('This link leads to more than one note');
    const leads = [...(dialog?.querySelectorAll('.link-choice-lead') ?? [])].map((lead) => lead.textContent);
    expect(leads).toEqual(['/Código', '/']);
    expect(dialog?.querySelector('.link-choice-about')?.textContent).toBe('Como o código se organiza.');
    note.unmount();
  });

  it("follows the option a reader picks through the host's navigation", async () => {
    const navigate = vi.fn();
    const note = await draw('[[Visão Geral]]', { ...several, navigate });
    await click(note.container.querySelector('.link-choice a'));
    await click(note.container.querySelector('a.link-choice-option[href="/notes/2"]'));
    expect(navigate).toHaveBeenCalledWith('/notes/2');
    expect(note.container.querySelector('dialog')).toBeNull();
    note.unmount();
  });

  it('leads with the name when an alias matched', async () => {
    const note = await draw('[[A outra]]', {
      reaches: () => 2,
      choose: async () => ({
        by: 'alias' as const,
        notes: [
          { name: 'Visão Geral', address: '/notes/2', trail: ['f2'], folderDescription: '' },
          { name: null, address: '/notes/3', trail: ['f2'], folderDescription: '' },
        ],
      }),
    });
    await click(note.container.querySelector('.link-choice a'));
    const leads = [...note.container.querySelectorAll('.link-choice-lead')].map((lead) => lead.textContent);
    expect(leads).toEqual(['Visão Geral', 'Unnamed note']);
    expect(note.container.querySelector('.link-choice-explanation')?.textContent).toContain('carry it as an alias');
    note.unmount();
  });

  it('goes straight to the note when one note answers by alias', async () => {
    const navigate = vi.fn();
    const note = await draw('[[LGL]]', {
      choose: async () => ({ by: 'alias' as const, notes: [{ name: 'Lei 14.133', address: '/notes/lei', trail: [], folderDescription: '' }] }),
      navigate,
    });
    const link = note.container.querySelector('.link-choice a');
    // Pending until clicked: no name answers, and only the host knows the aliases.
    expect(link?.className).toBe('wikilink-pending');
    await click(link);
    expect(navigate).toHaveBeenCalledWith('/notes/lei');
    expect(note.container.querySelector('dialog')).toBeNull();
    note.unmount();
  });

  it('says a name nobody carries is free, and offers nothing', async () => {
    const note = await draw('[[Nada ainda]]', { choose: async () => ({ by: null, notes: [] }) });
    await click(note.container.querySelector('.link-choice a'));
    expect(note.container.querySelector('h2')?.textContent).toBe('This link leads nowhere yet');
    expect(note.container.querySelector('.link-choice-explanation')?.textContent).toContain('No note carries the name “Nada ainda” yet');
    expect(note.container.querySelector('.link-choice-option')).toBeNull();
    note.unmount();
  });

  it('says so when the host fails to answer', async () => {
    const note = await draw('[[x]]', { choose: async () => Promise.reject(new Error('offline')) });
    await click(note.container.querySelector('.link-choice a'));
    expect(note.container.querySelector('.link-choice-explanation')?.textContent).toBe('Something went wrong.');
    note.unmount();
  });

  it('shows placeholder rows while the host resolves, so a click is never ignored', async () => {
    const note = await draw('[[x]]', { choose: () => new Promise<LinkChoices>(() => undefined) });
    await click(note.container.querySelector('.link-choice a'));
    expect(note.container.querySelectorAll('.link-choice-option.is-placeholder')).toHaveLength(2);
    note.unmount();
  });

  it('closes on Cancel, and gives the focus back to the link', async () => {
    const note = await draw('[[Visão Geral]]', several);
    const link = note.container.querySelector<HTMLAnchorElement>('.link-choice a');
    await click(link);
    await click(note.container.querySelector('.link-choice-cancel'));
    expect(note.container.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(link);
    note.unmount();
  });

  it('cuts a long folder description on a word, and says it was cut', async () => {
    const long = 'Uma pasta que guarda tudo o que diz respeito à vinificação, da colheita ao engarrafamento, com as notas de cada safra e as decisões tomadas.';
    const note = await draw('[[x]]', {
      reaches: () => 2,
      choose: async () => ({
        by: 'name' as const,
        notes: [
          { name: 'x', address: '/1', trail: ['a'], folderDescription: long },
          { name: 'x', address: '/2', trail: ['b'], folderDescription: '' },
        ],
      }),
    });
    await click(note.container.querySelector('.link-choice a'));
    const about = note.container.querySelector('.link-choice-about')?.textContent ?? '';
    expect(about.endsWith('…')).toBe(true);
    expect(about.length).toBeLessThanOrEqual(121);
    expect(long.startsWith(about.slice(0, -1))).toBe(true);
    expect(note.container.querySelectorAll('.link-choice-about')).toHaveLength(1);
    note.unmount();
  });
});

describe('a file the notebook keeps', () => {
  const keeps = (name: string): boolean => name === 'engelbart.jpg';

  it('is drawn by the host, with the dimensions the embed declared', () => {
    const out = html('![[engelbart.jpg|100x145]] e ![[engelbart.jpg|120]]', {
      keeps,
      renderAttachment: ({ name, width, height }) => <img data-kept={name} width={width ?? undefined} height={height ?? undefined} />,
    });
    expect(out).toContain('<img data-kept="engelbart.jpg" width="100" height="145"/>');
    expect(out).toContain('<img data-kept="engelbart.jpg" width="120"/>');
  });

  it('is never reached by a link of the same name', () => {
    const out = html('[[engelbart.jpg]]', { keeps, renderAttachment: () => <img /> });
    expect(out).not.toContain('<img');
    expect(out).toContain('wikilink-pending');
  });

  it('is reported missing when the notebook keeps nothing under the name', () => {
    expect(html('![[foto.jpg]]', { keeps })).toContain('class="wikilink-pending"');
    expect(html('[x](attachment:foto.jpg)', { keeps })).toContain(
      '<span class="attachment-missing" title="This notebook keeps no file under that name.">foto.jpg</span>',
    );
  });

  it('is its name when the host keeps it and draws nothing', () => {
    expect(html('![[engelbart.jpg]]', { keeps })).toContain('<span class="attachment-loading">engelbart.jpg</span>');
  });

  it('is reached by no embed when the host says nothing about files, which is the safe default', () => {
    const out = html('![[engelbart.jpg]]', { renderAttachment: () => <img /> });
    expect(out).not.toContain('<img');
  });
});

describe('a note that fetches from another site says so', () => {
  it('names the hosts once, under the body, in the words of the host', () => {
    const out = html('![a](https://example.org/a.png)\n\n![b](https://example.org/b.png)\n\n![c](https://cdn.example.net/c.png)', {
      strings: { remoteImages: (hosts) => `Imagens de ${hosts.join(' e ')}.` },
    });
    expect(out).toContain('<p class="remote-notice">Imagens de example.org e cdn.example.net.</p>');
  });

  it('says nothing when nothing is fetched', () => {
    expect(html('![a](./a.png)\n\n[um link](https://example.org)\n\n```\n![x](https://example.org/x.png)\n```')).not.toContain('remote-notice');
  });

  it('leaves the disclosure to a host that turns the notice off', () => {
    expect(html('![a](https://example.org/a.png)', { remoteNotice: false })).not.toContain('remote-notice');
  });
});
