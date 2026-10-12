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
  attachment: (html) => {
    /**
     * A file of the notebook that is not a note. The host of this case keeps
     * NONE — the extension of the name decides nothing — so the reference
     * reaches nothing and is reported the way a pending link is (§5.8). What
     * it must never be is a link: a reader following it would land on a note
     * nobody will ever write.
     */
    expect(html).toContain('engelbart.jpg');
    expect(html).toMatch(/pending/);
    expect(html).not.toContain('![[');
    expect(html).not.toMatch(/<a[^>]*>engelbart/);
  },
  'image-dimensions': (html) => {
    // The pipe carries width and height, and neither it nor the digits reach
    // the page as text.
    expect(html).toContain('width="100"');
    expect(html).toContain('height="145"');
    expect(html).toContain('alt="Engelbart"');
    expect(html).not.toContain('100x145');
    expect(html).not.toContain('Engelbart|');
  },
  'pending-link-display': (html) => {
    expect(html).toContain('wikilink-pending');
    // Visibly pending, never hidden: the text of the target stays on screen.
    expect(html).toContain('A note nobody has written');
    expect(html).not.toContain('[[A note nobody has written]]');
  },
  'autolink-extended': (html) => {
    // Bare, and still a link. External, so it is a plain anchor and never one
    // of ours: `wikilink` is the class this surface puts on an edge.
    expect(html).toContain('href="https://example.org/lei-14133"');
    expect(html).not.toContain('class="wikilink"');
  },
  mermaid: (html) => {
    // The container is rendered before the library is imported, which is the
    // whole point: the fence became a diagram and not a code block.
    expect(html).toContain('mermaid-diagram');
    expect(html).not.toContain('language-mermaid');
    expect(html).not.toContain('flowchart LR');
  },
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

/**
 * Syntax highlighting, which is a product decision and not a conformance
 * obligation: the specification attaches a rendering rule to exactly one info
 * string and §8 leaves every other form to the implementation to draw as it
 * likes. What the specification DOES constrain is everything around it.
 */
describe('a fenced block that names its language', () => {
  it('is highlighted, in tokens and not in one flat run of text', () => {
    const html = render('```sql\nselect 1 from notes;\n```\n');

    expect(html).toContain('language-sql');
    expect(html).toContain('token');
    expect(html).toContain('select');
  });

  it('renders an unknown language as plain code, never as nothing', () => {
    const html = render('```brainfuck\n+++[->+++<]\n```\n');

    expect(html).toContain('+++[-&gt;+++&lt;]');
    expect(html).not.toContain('class="token');
  });

  it('renders a fence with no info string exactly as before', () => {
    const html = render('```\nplain text\n```\n');

    expect(html).toContain('plain text');
    expect(html).not.toContain('class="token');
  });

  it('leaves mermaid to the diagram, which is the one info string with a rule', () => {
    const html = render('```mermaid\ngraph TD\n  A --> B\n```\n');

    expect(html).toContain('mermaid-diagram');
    expect(html).not.toContain('language-mermaid');
    expect(html).not.toContain('class="token');
  });

  it('does not change the bytes, only how they are drawn', () => {
    // Strip the spans the highlighter added, and what is left has to be the
    // source, character for character.
    const code = '{\n    "a":   1,\n\t"b": [ 2 ]\n}';
    const html = render('```json\n' + code + '\n```\n');

    const inside = /<code[^>]*language-json[^>]*>([\s\S]*?)<\/code>/.exec(html)?.[1] ?? '';
    const text = inside
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

    expect(text).toBe(code);
  });

  it('never injects note-derived markup as HTML', () => {
    const html = render('```javascript\nconst x = "<script>window.stolen = 1</script>";\n```\n');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('highlights a code span never, because a span has no info string', () => {
    const html = render('Write `select 1` in the console.');

    expect(html).toContain('select 1');
    expect(html).not.toContain('class="token');
  });
});

/** Code is told apart once for each case: inline code by its face, a block by a frame with the verb that copies it, and a diagram by neither. */
describe('a block of code has a frame and a Copy button, and inline code has neither', () => {
  it('frames a fenced block, highlighted or not, with the button inside the frame', () => {
    for (const fence of ['```ts\nconst a = 1;\n```\n', '```\nplain\n```\n']) {
      const html = render(fence);
      expect(html).toMatch(/<div class="code-block"><pre>[\s\S]*<\/pre><button[^>]*code-copy/);
      expect(html).toMatch(/aria-label="Copy"/);
    }
  });

  it('leaves inline code in the sentence, with no frame and nothing to copy', () => {
    const html = render('Run `pnpm test` first.\n');
    expect(html).toContain('<code>pnpm test</code>');
    expect(html).not.toContain('code-block');
    expect(html).not.toContain('code-copy');
  });

  it('leaves a diagram unframed, with nothing to copy', () => {
    const html = render('```mermaid\ngraph TD\n  A --> B\n```\n');
    expect(html).toContain('mermaid-diagram');
    expect(html).not.toContain('code-block');
    expect(html).not.toContain('code-copy');
  });
});

/**
 * A public image is content, and an address is a decision: what this surface
 * will and will not follow is part of rendering a picture.
 */
describe('a picture in a note, and the addresses around it', () => {
  it('renders a public image, with the description the author wrote', () => {
    const html = render('![The maturation curve](https://example.org/curve.png "Serra Gaucha")');

    expect(html).toContain('src="https://example.org/curve.png"');
    expect(html).toContain('alt="The maturation curve"');
    expect(html).toContain('title="Serra Gaucha"');
  });

  it('renders one inside a callout, where a note actually puts it', () => {
    const html = render('> [!tip] The curve\n> ![The curve](https://example.org/c.png)\n');

    expect(html).toContain('class="callout"');
    expect(html).toContain('src="https://example.org/c.png"');
  });

  it('follows a link to the web and to a person', () => {
    expect(render('[The text](https://example.org/x)')).toContain('href="https://example.org/x"');
    expect(render('[Write](mailto:a@example.org)')).toContain('href="mailto:a@example.org"');
  });

  it('leaves an address it does not follow as text, and never as a link', () => {
    const html = render('[Open it](obsidian://open?vault=Notas&file=Lei)');

    expect(html).toContain('Open it');
    expect(html).toContain('link-refused');
    expect(html).not.toContain('<a');
    expect(html).not.toContain('obsidian://');
  });

  it('does the same with a page carried inside the address', () => {
    const html = render('[Click](data:text/html;base64,PHNjcmlwdD4=)');

    expect(html).toContain('link-refused');
    expect(html).not.toContain('data:text/html');
  });

  it('still draws the pending link, which is the scheme all of this was for', () => {
    const html = render('[[A note nobody has written]]');

    expect(html).toContain('wikilink-pending');
    expect(html).toContain('A note nobody has written');
  });
});

/**
 * §7.10: an image whose destination names a host is a request to that host,
 * made when the note is opened, by whoever opens it. A Reader MUST state
 * whether that happens; only silence does not conform. This surface fetches
 * and says so, exactly where it is true.
 */
describe('a note that fetches from another site says so', () => {
  it('names the host when an image reaches outside', () => {
    const html = render('![A curve](https://example.org/curve.png)');

    expect(html).toContain('remote-notice');
    expect(html).toContain('example.org');
  });

  it('says nothing when nothing is fetched', () => {
    const html = render('![A curve](./curve.png)\n\nAnd [a link](https://example.org).');

    expect(html).not.toContain('remote-notice');
  });

  it('keeps the alt text, which is what a person gets when the image does not load', () => {
    const html = render('![Fourteen minutes against thirty](https://example.org/x.png)');

    expect(html).toContain('alt="Fourteen minutes against thirty"');
  });

  it('does not count an image written inside a fence, which fetches nothing', () => {
    const html = render('```\n![A curve](https://example.org/curve.png)\n```\n');

    expect(html).not.toContain('remote-notice');
  });

  it('names each host once, however many images came from it', () => {
    const html = render(
      '![One](https://example.org/a.png)\n\n![Two](https://example.org/b.png)\n\n![Three](https://cdn.example.net/c.png)\n',
    );

    // Asserted on the notice and not on the whole page, which also carries the
    // host in each `src` and in the preload React emits for it.
    const notice = /<p class="remote-notice">(.*?)<\/p>/.exec(html)?.[1] ?? '';

    expect(notice).toContain('example.org');
    expect(notice).toContain('cdn.example.net');
    expect((notice.match(/(^|[^.])example\.org/g) ?? []).length).toBe(1);
  });
});
