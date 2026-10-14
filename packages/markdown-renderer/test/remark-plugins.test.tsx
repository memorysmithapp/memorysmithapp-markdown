/**
 * The plugins of the notation the base parsers do not draw, each at the level
 * where it decides: callouts (§7.1), marked text (§7.5), comments (§7.6),
 * block identifiers (§7.7) and the dollar rule of mathematics (§7.8).
 *
 * Every one of them works on the tree and not on the string, so each is also
 * asserted inside code, where the notation is characters and nothing else.
 */

import { describe, expect, it } from 'vitest';
import { html } from './render.js';

describe('a callout', () => {
  it('becomes an element with its kind on it, titled by what follows the marker', () => {
    const out = html('> [!warning] O que pode dar errado\n> O corpo do aviso.');
    expect(out).toContain('<div class="callout" data-callout="warning">');
    expect(out).toContain('<div class="callout-title">O que pode dar errado</div>');
    expect(out).toContain('<p>O corpo do aviso.</p>');
    expect(out).not.toContain('<blockquote>');
    expect(out).not.toContain('[!warning]');
  });

  it('is titled by the host when it has no title of its own', () => {
    const out = html('> [!tip]\n> Corpo.', { strings: { callouts: { tip: 'Dica' } } });
    expect(out).toContain('<div class="callout-title">Dica</div>');
  });

  it("is titled in MemorySmith's English when the host gives no words", () => {
    expect(html('> [!tldr]\n> Corpo.')).toContain('<div class="callout-title">TL;DR</div>');
  });

  it('titles a kind nobody translated with the kind itself, capitalised', () => {
    // The vocabulary is open (§7.1), and a word nobody translated is still a word.
    expect(html('> [!receita]\n> Corpo.')).toContain('<div class="callout-title">Receita</div>');
    expect(html('> [!constructor]\n> Corpo.')).toContain('<div class="callout-title">Constructor</div>');
  });

  it('reads the kind case-insensitively, and takes the fold marker off the page', () => {
    const out = html('> [!NOTE]- Recolhido\n> Corpo.');
    expect(out).toContain('data-callout="note"');
    expect(out).toContain('<div class="callout-title">Recolhido</div>');
    expect(html('> [!faq]+ Aberto\n> Corpo.')).toContain('<div class="callout-title">Aberto</div>');
  });

  it('keeps emphasis in its title and cuts the title at the first line break', () => {
    const out = html('> [!info] Um *título* com ênfase\n> E o corpo, na linha seguinte.');
    expect(out).toContain('<div class="callout-title">Um <em>título</em> com ênfase</div>');
    expect(out).toContain('<p>E o corpo, na linha seguinte.</p>');
  });

  it('carries every block after its first paragraph', () => {
    const out = html('> [!example] Exemplo\n>\n> - um\n> - dois');
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>um</li>');
  });

  it('is a quotation when the marker is not on its first line', () => {
    const out = html('> Uma citação.\n> [!warning] não é marcador aqui');
    expect(out).toContain('<blockquote>');
    expect(out).not.toContain('class="callout"');
  });

  it('nests inside another callout', () => {
    const out = html('> [!note] Fora\n> > [!warning] Dentro\n> > Corpo.');
    expect(out).toContain('data-callout="note"');
    expect(out).toContain('data-callout="warning"');
  });

  it('is not read inside code', () => {
    const out = html('```\n> [!warning] x\n```');
    expect(out).not.toContain('class="callout"');
  });
});

describe('marked text', () => {
  it('becomes <mark>, and the == never reaches the page', () => {
    const out = html('A regra vale ==só para os casos do artigo 75==, e nada mais.');
    expect(out).toContain('<mark>só para os casos do artigo 75</mark>');
    expect(out).not.toContain('==');
  });

  it('marks two runs in one paragraph', () => {
    expect(html('==um== e ==dois==')).toContain('<mark>um</mark> e <mark>dois</mark>');
  });

  it('is not read inside a code span or a fence', () => {
    expect(html('Escreva `==x==` para marcar.')).toContain('<code>==x==</code>');
    expect(html('```\n==x==\n```')).not.toContain('<mark>');
  });
});

describe('a comment', () => {
  it('leaves the page and keeps what was written around it', () => {
    const out = html('A regra vale. %%conferir com a revisão de 2027%% E segue.');
    expect(out).not.toContain('conferir');
    expect(out).not.toContain('%%');
    expect(out).toContain('A regra vale.');
    expect(out).toContain('E segue.');
  });

  it('leaves nothing behind when it was the whole paragraph', () => {
    // MemorySmith's reading page leaves an empty paragraph where the comment was.
    const out = html('Antes.\n\n%%só um comentário%%\n\nDepois.');
    expect(out).not.toContain('só um comentário');
    expect(out).toMatch(/<p>Antes\.<\/p>\s*<p>Depois\.<\/p>/);
  });

  it('hides whatever it holds: markup, raw HTML, a link, an embed, a footnote reference', () => {
    // MemorySmith's reading page hides a comment inside one run of text only, and drew all of these.
    const out = html(
      'A regra %%*rever*, <b>já</b>, [[Outra nota]], ![[Anexo]], [^n] e [x](https://example.org)%% vale.\n\n[^n]: Fonte.\n',
      { resolve: () => '/notes/x' },
    );
    expect(out).not.toContain('%%');
    expect(out).not.toContain('rever');
    expect(out).not.toContain('já');
    expect(out).not.toContain('Outra nota');
    expect(out).not.toContain('Anexo');
    expect(out).not.toContain('example.org');
    expect(out).toContain('A regra  vale.');
  });

  it('hides blank lines and the blocks between its markers', () => {
    const out = html('Antes.\n\n%%\n# Rascunho\n\n- um item\n\nOutro parágrafo.\n%%\n\nDepois.');
    expect(out).not.toContain('Rascunho');
    expect(out).not.toContain('um item');
    expect(out).not.toContain('Outro parágrafo');
    expect(out).toMatch(/<p>Antes\.<\/p>\s*<p>Depois\.<\/p>/);
  });

  it('on lines of its own inside a list, leaves the list tight', () => {
    expect(html('- um\n%% nota %%\n- dois')).toContain('<li>um</li>');
  });

  it('is not read inside code, and a lone %% is text', () => {
    expect(html('Use `%%x%%` para comentar.')).toContain('<code>%%x%%</code>');
    expect(html('```\n%% fica %%\n```')).toContain('%% fica %%');
    expect(html('Taxa de 5%% ao mês.')).toContain('5%% ao mês');
  });
});

describe('a block identifier', () => {
  it('names its block and is never rendered as text', () => {
    const out = html('A regra é enunciada uma vez, aqui. ^artigo-75');
    expect(out).toContain('<p>A regra é enunciada uma vez, aqui.</p>');
    expect(out).not.toContain('^artigo-75');
  });

  it('leaves a caret in the middle of a line alone', () => {
    expect(html('O expoente ^2 se escreve assim.')).toContain('O expoente ^2 se escreve assim.');
  });

  it('is taken off the end of a list item too', () => {
    const out = html('- um item ^item-1');
    expect(out).toContain('<li>um item</li>');
  });
});

describe('mathematics', () => {
  it('typesets an inline formula and a block one', () => {
    expect(html('A complexidade é $n \\log n$.')).toContain('class="katex"');
    const block = html('$$\n\\sum_{i=1}^{n} i\n$$');
    expect(block).toContain('katex-display');
    expect(block).not.toContain('$$');
  });

  it('shows the source of a formula KaTeX cannot typeset, never an error', () => {
    const out = html('Uma fórmula quebrada: $\\frac{1}{$ e o texto segue.');
    expect(out).toContain('e o texto segue');
    expect(out).toContain('katex-error');
  });
});

describe('the dollar rule', () => {
  it('keeps two prices whole when nothing separates them from the amount', () => {
    // The case it was written for: `100 e o frete R` must not be typeset.
    const out = html('O item custa R$100 e o frete R$200.');
    expect(out).toContain('R$100 e o frete R$200');
    expect(out).not.toContain('katex');
  });

  it('keeps a price whole when a space separates it from the amount', () => {
    const out = html('A licença custa $30 por mês, e o plano $60.');
    expect(out).toContain('$30');
    expect(out).toContain('$60');
    expect(out).not.toContain('katex');
  });

  it('does not close a formula on a delimiter followed by a digit', () => {
    expect(html('Custa $50 hoje e $60 amanhã.')).not.toContain('katex');
  });

  it('does not open a formula immediately after a word character', () => {
    expect(html('A largura é 2$x$ do total.')).not.toContain('katex');
    expect(html('A largura é 2 $x$ do total.')).toContain('katex');
  });

  it('accepts a formula in the same sentence as two prices', () => {
    const out = html('O item custa R$100 e o frete R$200, e a complexidade é $n \\log n$.');
    expect(out).toContain('R$100 e o frete R$200');
    expect(out).toContain('katex');
  });
});
