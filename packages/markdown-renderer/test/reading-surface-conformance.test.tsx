/**
 * The reading surface, run against the specification.
 *
 * The specification declares a set of notations under the `reading-surface`
 * reader. A rendering assertion cannot live in a JSON file — what a callout
 * looks like is not something the suite can state — so the entries come from
 * `@memorysmithapp/markdown-spec`, never from a copy, and the expectation is
 * written here, once per entry, against the real component.
 */

import { spec } from '@memorysmithapp/markdown-spec';
import { describe, expect, it } from 'vitest';
import { html } from './render.js';

const render = (markdown: string): string => html(markdown);

/** What each declared entry has to be true of, once rendered. */
const EXPECTED: Record<string, (html: string) => void> = {
  callout: (html) => {
    // A callout is an element with its type on it, not a blockquote with a
    // marker left in front of the text.
    expect(html).toContain('class="callout"');
    expect(html).toContain('data-callout="warning"');
    expect(html).toContain('callout-title');
    expect(html).not.toContain('[!warning]');
    expect(html).not.toContain('<blockquote>');
  },
  highlight: (html) => {
    expect(html).toContain('<mark>');
    expect(html).toContain('only for the cases listed in article 75');
    // The `==` never reaches the screen.
    expect(html).not.toContain('==');
  },
  comment: (html) => {
    // It leaves the PAGE. That the bytes are untouched is the host's: nothing
    // here rewrites a note.
    expect(html).not.toContain('check this against the 2027 revision');
    expect(html).not.toContain('%%');
    // What was written around it stays.
    expect(html).toContain('The rule holds.');
  },
  'block-id': (html) => {
    // The identifier names the block for an embed to resolve to, and is never
    // rendered as text.
    expect(html).toContain('The rule is stated once, here.');
    expect(html).not.toContain('^article-75');
  },
  'math-inline': (html) => {
    // The example carries both halves: two prices that must survive as text,
    // and one formula that must render.
    expect(html).toContain('katex');
    expect(html).not.toContain('$n');
    expect(html).toContain('R$100 e o frete R$200');
  },
  'math-block': (html) => {
    expect(html).toContain('katex');
    expect(html).not.toContain('$$');
  },
};

const entries = spec.notations.filter((entry) => entry.reader === 'reading-surface' && entry.id in EXPECTED);

describe('the reading surface implements the specification', () => {
  it.each(entries)('renders $id as the specification declares', ({ id, example }) => {
    EXPECTED[id]?.(render(example));
  });

  it('finds every entry it asserts in the specification', () => {
    expect(entries.map((entry) => entry.id).sort()).toEqual(Object.keys(EXPECTED).sort());
  });
});

/**
 * The `$` that is not math. A price and a shell variable are text, and the
 * specification says so in as many words, so the negatives are asserted next
 * to the positives rather than left to the library.
 */
describe('a dollar sign that is not opening a formula stays a dollar sign', () => {
  it('leaves a price alone when a space separates it from the amount', () => {
    // The outside edge: a `$` followed by whitespace does not open, and one
    // preceded by whitespace does not close.
    const html = render('The licence costs $30 a month, and the plan $60.');

    expect(html).toContain('$30');
    expect(html).toContain('$60');
    expect(html).not.toContain('katex');
  });

  it('leaves two prices alone when nothing separates them from the amount', () => {
    // The INSIDE edge. Neither `$` here sits next to a space, so the outside
    // edge alone decides nothing and the sentence lost its middle: `100 e o
    // frete R` came out typeset as mathematics, with the `R` and the `200`
    // stranded either side. It is an ordinary sentence in pt-BR, where a price
    // is written `R$`.
    const html = render('O item custa R$100 e o frete R$200, e nada disso é fórmula.');

    expect(html).toContain('R$100 e o frete R$200');
    expect(html).not.toContain('katex');
  });

  it('renders a real formula in the same sentence as two prices', () => {
    const html = render('O item custa R$100 e o frete R$200, e a complexidade é $n \\log n$.');

    expect(html).toContain('R$100 e o frete R$200');
    expect(html).toContain('katex');
    expect(html).not.toContain('$n');
  });

  it('does not open a formula written immediately after a word character', () => {
    // The declared cost of protecting the price: `2 $x$` is the form that works.
    const plain = render('A largura é 2$x$ do total.');
    const spaced = render('A largura é 2 $x$ do total.');

    expect(plain).not.toContain('katex');
    expect(plain).toContain('2$x$');
    expect(spaced).toContain('katex');
  });

  it('does not close a formula on a delimiter followed by a digit', () => {
    const html = render('Custa $50 hoje e $60 amanhã.');

    expect(html).toContain('$50');
    expect(html).toContain('$60');
    expect(html).not.toContain('katex');
  });

  it('leaves a shell variable alone', () => {
    const html = render('Run it with $HOME set.');

    expect(html).toContain('$HOME');
    expect(html).not.toContain('katex');
  });

  it('protects two shell variables in one sentence through a code span', () => {
    const html = render('Run it with `$HOME` and `$PATH` set.');

    expect(html).toContain('$HOME');
    expect(html).toContain('$PATH');
    expect(html).not.toContain('katex');
  });
});
