/**
 * The reading surface, run against the specification.
 *
 * The specification declares a set of notations under the `reading-surface`
 * reader, and an indexer decides none of them: they are behaviour of a
 * renderer. A rendering assertion cannot live in a JSON file — what a callout
 * looks like is not something the suite can state — so the entries come from
 * `@memorysmithapp/markdown-spec`, never from a copy, and the expectation is
 * written here, once per entry, against the real component.
 *
 * **The entries asserted are those the specification ADDS to what a base
 * parser already does, and that is a decision, not a filter.** Which entries
 * are exempt is `DELEGATED_TO_THE_BASE_PARSER`, with its reason; what the
 * restated base forms did bring is the **crossings**, the places where the
 * specification changes what CommonMark means, and those are proved at the
 * bottom of this file, one case each and named.
 *
 * What this test guarantees is coverage as much as behaviour. A notation
 * declared under `reading-surface` that is neither expected here nor delegated
 * fails it, so the specification cannot grow an entry this renderer silently
 * does not implement. `conformance-coverage.test.ts` proves that by running
 * this file against a specification with one entry added.
 *
 * Rendered to static markup, which runs no effects: the mermaid block renders
 * its container before the library is imported, and an embed its frame before
 * the host answers. Both are the assertion: the notation left the text and
 * became an element.
 */

import { readFileSync } from 'node:fs';
import { cases, spec as packaged, type Spec } from '@memorysmithapp/markdown-spec';
import { describe, expect, it } from 'vitest';
import { DELEGATED_TO_THE_BASE_PARSER, unclassified } from '../src/delegated.js';
import { html } from './render.js';

/**
 * The specification under test: the package's, or a fixture named by
 * `MARKDOWN_SPEC_FIXTURE`, which is how the coverage test runs this file
 * against a specification that declares one entry more.
 */
const spec: Spec = process.env['MARKDOWN_SPEC_FIXTURE']
  ? (JSON.parse(readFileSync(process.env['MARKDOWN_SPEC_FIXTURE'], 'utf8')) as Spec)
  : packaged;

/** A writable note, as MemorySmith's reading page draws one for a reader who may write. */
const render = (markdown: string): string => html(markdown, { writable: true, onToggleTask: () => undefined });

/** What each declared entry has to be true of, once rendered. */
const EXPECTED: Record<string, (html: string) => void> = {
  'raw-html': (html) => {
    // Not rendered: the tag is text. This is the security boundary, and the
    // `<script>` case below is the one that matters.
    expect(html).toContain('&lt;b&gt;read the act&lt;/b&gt;');
    expect(html).not.toContain('<b>read the act</b>');
  },
  table: (html) => {
    expect(html).toContain('<table>');
    expect(html).toContain('<th>');
    expect(html).toContain('<td>');
    // The delimiter row is structure and never a row of its own.
    expect(html).not.toContain('---');
  },
  strikethrough: (html) => {
    // Two tildes and only two: `~~revoked~~` is struck and `H~2~O` is not. A
    // renderer accepting the single tilde would strike the middle of the
    // second one — a wrong answer where the specification promises none at
    // all, and the reason `singleTilde` is off.
    expect(html).toContain('<del>');
    expect(html).toContain('revoked');
    expect(html).toContain('H~2~O');
    expect(html).not.toContain('~~');
  },
  footnote: (html) => {
    // A link to a note at the end of the note, and a way back — and neither
    // leaves the page.
    expect(html).toMatch(/<a href="#user-content-fn-rup"[^>]*data-footnote-ref/);
    expect(html).toContain('<section data-footnotes="true" class="footnotes">');
    expect(html).toContain('id="user-content-fn-rup"');
    expect(html).toMatch(/<a href="#user-content-fnref-rup"[^>]*data-footnote-backref/);
    expect(html).not.toMatch(/href="#[^"]*"[^>]*target="_blank"/);
    expect(html).not.toContain('[^rup]');
    // The label is a heading a reader sees, in the reader's words.
    expect(html).toContain('class="footnotes-label"');
    expect(html).not.toContain('>Footnotes<');
    // What react-markdown hands a component is not an attribute of the page.
    expect(html).not.toContain('node="[object Object]"');
  },
  'task-list': (html) => {
    // A box per item, carrying the state written in the source, both ways
    // round. One box per item and not two, which is what dropping GFM's own
    // is for.
    expect((html.match(/type="checkbox"/g) ?? []).length).toBe(3);
    expect((html.match(/checked=""/g) ?? []).length).toBe(1);
    expect(html).toContain('Price research');
    expect(html).toContain('Three quotes gathered');
    expect(html).not.toContain('[ ]');
    expect(html).not.toContain('[x]');
    // A nested item is a task like any other, and `[X]`, the capital form
    // GFM accepts, leaves the page too.
    expect(html).not.toContain('[X]');
    // The box is ours, and it answers to a click where the host allows it.
    expect((html.match(/class="[^"]*task-item[^"]*"/g) ?? []).length).toBe(3);
    expect(html).not.toContain('disabled=""');
  },
  transclusion: (html) => {
    // The embed left the prose and became a region of its own. Which region
    // depends on the host's answer, which has not arrived in a static render;
    // that it is no longer the literal `![[...]]` is what this entry declares.
    expect(html).not.toContain('![[');
    expect(html).toMatch(/embed|status/);
  },
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

const surface = spec.notations.filter(
  (entry) => entry.reader === 'reading-surface' && !DELEGATED_TO_THE_BASE_PARSER.has(entry.id),
);

describe('the reading surface implements the specification', () => {
  it.each(surface)('renders $id as the specification declares', ({ id, example }) => {
    const expected = EXPECTED[id];
    // A declared notation with no expectation here is a failure of this test,
    // not a gap to discover later in a browser.
    expect(expected, `no reading-surface expectation written for "${id}"`).toBeDefined();
    expected?.(render(example));
  });

  it('has an expectation for every declared entry, and none for anything else', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(surface.map((entry) => entry.id).sort());
  });

  it('asserts or delegates every reading-surface entry, and the two sets cover all of them', () => {
    const all = spec.notations.filter((entry) => entry.reader === 'reading-surface').map((entry) => entry.id);
    expect(unclassified(spec.notations, new Set(Object.keys(EXPECTED)))).toEqual([]);
    // The two sets are disjoint, and together they are exactly the entries.
    const asserted = Object.keys(EXPECTED);
    expect(asserted.filter((id) => DELEGATED_TO_THE_BASE_PARSER.has(id))).toEqual([]);
    expect([...asserted, ...DELEGATED_TO_THE_BASE_PARSER].sort()).toEqual([...all].sort());
  });

  it('runs against a surface that exists, so an empty import cannot pass', () => {
    expect(surface.length).toBeGreaterThan(0);
  });
});

/**
 * The `$` that is not math. A price and a shell variable are text, and the
 * specification says so in as many words, so the negatives are asserted next
 * to the positives rather than left to the library.
 */
/** The callout cases of the suite, drawn: what they say of links holds only if the marker left the page. */
describe('every callout of the conformance suite is drawn as a callout', () => {
  const callouts = cases.filter((testCase) => testCase.notation === 'callout');

  it('has callout cases to draw', () => {
    expect(callouts.length).toBeGreaterThan(0);
  });

  it.each(callouts.map((testCase) => [testCase.id, testCase.markdown] as const))('%s', (_id, markdown) => {
    const html = render(markdown);
    const type = /^> \[!([^\]]+)\]/.exec(markdown)?.[1] ?? '';

    expect(html).toContain(`data-callout="${type.normalize('NFC').toLowerCase()}"`);
    expect(html).not.toContain(`[!${type}]`);
    expect(html).not.toContain('<blockquote>');
  });
});

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

/**
 * The three places an embed cannot expand, and the one answer to all of them
 * (§7.3): where expansion cannot happen the embed becomes a link, and it is
 * never dropped.
 */
describe('an embed where no block fits', () => {
  const TABLE = '| Rule | Where |\n|---|---|\n| The general one | ![[Lei 14.133]] |\n';

  it('keeps the table whole, with the embed inside the cell', () => {
    const html = render(TABLE);

    expect(html).toContain('<table>');
    expect((html.match(/<table>/g) ?? []).length).toBe(1);
    expect(html).toContain('The general one');
    expect(html).not.toMatch(/<p>\s*\|\s*<\/p>/);
    expect(html).not.toContain('<td></td>');
  });

  it('draws the embed in the cell as a link, and never drops it', () => {
    const html = render(TABLE);

    expect(html).toContain('Lei 14.133');
    expect(html).not.toContain('![[');
    expect(html).not.toContain('[[Lei 14.133]]');
    expect(html).toMatch(/wikilink/);
  });

  it('still expands an embed written outside the table in the same note', () => {
    const html = render(`${TABLE}\n![[Another note]]\n`);

    expect(html).toContain('<table>');
    expect(html).toMatch(/embed|status/);
    expect(html).not.toContain('![[');
  });

  it('leaves an embed written inside a fence alone, table or no table', () => {
    const html = render('```\n| A | B |\n|---|---|\n| x | ![[Lei 14.133]] |\n```\n');

    expect(html).toContain('![[Lei 14.133]]');
    expect(html).not.toContain('<table>');
  });
});

/**
 * A form the specification does not describe is read as nothing (§8), and the
 * reading surface is where a rejection is most easily undone by accident:
 * drawing a chip around `#subject` would promise a grouping that does not
 * exist, and an affordance without the function it promises is worse than the
 * raw text.
 */
describe('a notation the specification does not declare is rendered as what it is: text', () => {
  it('renders an inline #tag as plain text, with no chip and nothing to click', () => {
    const html = render('The decision touches #procurement and #contracts.');

    expect(html).toContain('#procurement');
    expect(html).toContain('#contracts');
    expect(html).not.toMatch(/<a[^>]*>#/);
    expect(html).not.toMatch(/class="[^"]*tag[^"]*"/);
  });

  it('does not read a heading as a tag either', () => {
    const html = render('# Direct contracting\n\nThe rule.\n');

    expect(html).toContain('<h1>Direct contracting</h1>');
    expect(html).not.toContain('#');
  });

  it('renders an external link as a link and never as a wikilink of ours', () => {
    const html = render('See [the official text](https://example.org/lei-14133).');

    expect(html).toContain('href="https://example.org/lei-14133"');
    expect(html).not.toContain('class="wikilink"');
    expect(html).not.toContain('wikilink-pending');
  });

  it('renders a subscript and a superscript as the characters they are', () => {
    const html = render('The formula is H~2~O, and the area is 3 m^2^.');

    expect(html).toContain('H~2~O');
    expect(html).toContain('m^2^');
    expect(html).not.toContain('<sub>');
    expect(html).not.toContain('<sup>');
    expect(html).not.toContain('<del>');
  });
});

/**
 * The raw HTML policy is a **security boundary** and not a rendering
 * preference, which is why it is asserted with the payload that would matter
 * rather than with a `<b>`.
 */
describe('raw HTML in a note is text, and stays text', () => {
  it('does not render a script tag', () => {
    const html = render('Before. <script>window.stolen = document.cookie</script> After.');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Before.');
    expect(html).toContain('After.');
  });

  it('does not render an event handler smuggled onto an element', () => {
    const html = render('<img src="x" onerror="window.stolen = 1">');

    // The whole tag is text, so the handler is characters on a page and not
    // an attribute of anything: there is no element for it to be on.
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('onerror=&quot;');
  });

  it('does not render an iframe', () => {
    const html = render('<iframe src="https://example.org"></iframe>');

    expect(html).not.toContain('<iframe');
  });
});

/**
 * The crossings: where the specification changes what an inherited form means.
 * Each one is a place where knowing CommonMark is not enough to predict what
 * happens here.
 */
describe('a base notation that means something different here', () => {
  it('renders an image as an image, and an embed as neither', () => {
    const html = render('![The curve](https://example.org/curve.png)\n\n![[A note]]\n');

    expect(html).toContain('alt="The curve"');
    expect(html).not.toContain('![[');
    expect(html).not.toContain('alt="[[A note]]"');
  });

  it('keeps the alt text of an image, which is the description and not decoration', () => {
    const html = render('![Fourteen minutes against thirty](https://example.org/x.png)');

    expect(html).toContain('alt="Fourteen minutes against thirty"');
  });

  it('leaves a wikilink inside a code span as characters', () => {
    const html = render('Write `[[Target]]` to link to it.');

    expect(html).toContain('[[Target]]');
    expect(html).not.toContain('class="wikilink"');
  });

  it('leaves every notation inside a fenced block alone', () => {
    const html = render('```\n[[Target]] and ==marked== and > [!warning] x\n```\n');

    expect(html).toContain('[[Target]]');
    expect(html).toContain('==marked==');
    expect(html).not.toContain('<mark>');
    expect(html).not.toContain('class="callout"');
  });

  it('reads three dashes under a paragraph as a heading and not as frontmatter', () => {
    const html = render('Serra Gaucha\n---\n\nThe rest.\n');

    expect(html).toContain('<h2>Serra Gaucha</h2>');
    expect(html).not.toContain('<hr');
  });

  it('does not strike a single tilde, which is where this surface leaves GFM', () => {
    const html = render('Water is H~2~O, and the rule is ~~revoked~~.');

    expect(html).toContain('H~2~O');
    expect(html).toContain('<del>revoked</del>');
  });
});
