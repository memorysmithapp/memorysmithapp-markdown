/**
 * The component and the host contract: a host draws a note with nothing but
 * the package and React — no router, no i18n library, no query client — and
 * every default is the safe one.
 */

import { describe, expect, it } from 'vitest';
import { draw, html } from './render.js';

describe('a host with nothing but the package', () => {
  it('draws a note inside .markdown', () => {
    const out = html('# Título\n\nUm parágrafo com *ênfase*.');
    expect(out).toMatch(/^<div class="markdown markdown-theme-default" data-theme="light"><div class="markdown">/);
    expect(out).toContain('<h1>Título</h1>');
    expect(out).toContain('<em>ênfase</em>');
  });

  it('does not draw the frontmatter, which a host shows as properties', () => {
    const out = html('---\nname: Uma nota\ntags: [a, b]\n---\n\nO corpo.');
    expect(out).not.toContain('name:');
    expect(out).toContain('<p>O corpo.</p>');
  });

  it('reads a note written with CRLF as the same note', () => {
    expect(html('Uma linha\r\n\r\nOutra')).toBe(html('Uma linha\n\nOutra'));
  });
});

describe('no raw HTML, which is a security boundary', () => {
  it('draws a <script> in a note as text', async () => {
    const note = await draw('Antes\n\n<script>window.__ran = true</script>\n\nDepois <b onclick="x()">negrito</b>');
    expect(note.container.querySelector('script')).toBeNull();
    expect(note.container.querySelector('b')).toBeNull();
    expect(note.container.textContent).toContain('<script>window.__ran = true</script>');
    expect((window as { __ran?: boolean }).__ran).toBeUndefined();
    note.unmount();
  });

  it('draws an HTML block as its text', () => {
    const out = html('<div class="x">conteúdo</div>');
    expect(out).not.toContain('<div class="x">');
    expect(out).toContain('&lt;div class=&quot;x&quot;&gt;conteúdo&lt;/div&gt;');
  });
});

describe('the addresses the surface follows', () => {
  it('keeps a refused address as text with its title', () => {
    const out = html('[abrir](javascript:alert(1)) e [cofre](obsidian://open?vault=x)');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('<span class="link-refused" title="This address is not one the reading surface follows, so the text stays and the link does not.">abrir</span>');
  });

  it('opens the web in a new tab, telling it nothing about the page', () => {
    expect(html('[lei](https://example.org/lei)')).toContain(
      '<a href="https://example.org/lei" target="_blank" rel="noreferrer">lei</a>',
    );
  });

  it("draws an internal address through the host's router", () => {
    const out = html('[a nota](/notebooks/x/notes/y)', {
      renderLink: ({ href, className, children }) => (
        <a data-router="yes" className={className} href={href}>
          {children}
        </a>
      ),
    });
    expect(out).toContain('<a data-router="yes" class="wikilink" href="/notebooks/x/notes/y">a nota</a>');
  });

  it('draws an internal address as a plain anchor when the host has no router', () => {
    expect(html('[a nota](/x)')).toContain('<a class="wikilink" href="/x">a nota</a>');
  });

  it('scrolls to an anchor inside the note and never navigates', async () => {
    const note = await draw('Texto[^1].\n\n[^1]: A nota de rodapé.');
    const reference = note.container.querySelector<HTMLAnchorElement>('a[data-footnote-ref]');
    expect(reference).not.toBeNull();
    expect(reference?.getAttribute('target')).toBeNull();
    let scrolled = false;
    HTMLElement.prototype.scrollIntoView = function () {
      scrolled = true;
    };
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    reference?.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(scrolled).toBe(true);
    note.unmount();
  });
});

describe('footnotes', () => {
  it('head the notes with the label the host gives, and the way back with its words', () => {
    const out = html('Texto[^a].\n\n[^a]: Uma nota.', {
      strings: { footnotes: 'Notas', footnoteBack: (n) => `Voltar à referência ${n}` },
    });
    expect(out).toContain('class="footnotes-label"');
    expect(out).toContain('>Notas</h2>');
    expect(out).toContain('aria-label="Voltar à referência 1"');
  });

  it("fall back to MemorySmith's English", () => {
    const out = html('Texto[^a].\n\n[^a]: Uma nota.');
    expect(out).toContain('>Notes</h2>');
    expect(out).toContain('aria-label="Back to reference 1"');
  });
});

describe('images', () => {
  it('take the dimensions the alt text declares, and keep the description', () => {
    const out = html('![Engelbart|100x145](https://example.org/e.jpg)');
    expect(out).toContain('alt="Engelbart"');
    expect(out).toContain('width="100"');
    expect(out).toContain('height="145"');
  });

  it('keep a value that is not a dimension inside the description', () => {
    expect(html('![Engelbart|large](https://example.org/e.jpg)')).toContain('alt="Engelbart|large"');
  });
});

describe('strikethrough takes two tildes and only two', () => {
  it('leaves a single tilde as it was typed', () => {
    const out = html('A fórmula é H~2~O, e ~~isto~~ foi riscado.');
    expect(out).toContain('H~2~O');
    expect(out).toContain('<del>isto</del>');
  });
});
