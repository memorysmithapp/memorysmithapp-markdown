/**
 * A drawn block tells the editor how tall it will be before it is drawn (#91), so the document
 * barely grows as the author scrolls: its estimate follows what it draws at the editor's width, and
 * a block drawn once is remembered at the height it was measured at.
 */

import { EditorView, type WidgetType } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { decorationsField, metricsField } from '../../src/edit/live.js';
import { DEFAULT_METRICS, estimateHeight, lineHeightOf, measuredHeight, rememberHeight, withinReason, type BlockMetrics, type LineMetrics } from '../../src/edit/heights.js';
import { mount, type Mounted } from '../render.js';

const DESKTOP: BlockMetrics = { width: 700, lineHeight: 24, charWidth: 7.75 };
const PHONE: BlockMetrics = { width: 358, lineHeight: 24, charWidth: 8.6 };

describe('the estimate of a block', () => {
  it('counts a property row per key of the frontmatter, two lines high where the value goes under the key', () => {
    const front = '---\nname: A note\ntags:\n  - a\n  - b\nstatus: draft\n---';
    // Measured in the default theme: 13 properties drew 487 px on a computer and 884 px on a phone.
    const thirteen = '---\n' + Array.from({ length: 13 }, (_, i) => `key${i}: value`).join('\n') + '\n---';
    expect(estimateHeight('frontmatter', thirteen, DESKTOP)).toBeGreaterThan(487 * 0.9);
    expect(estimateHeight('frontmatter', thirteen, DESKTOP)).toBeLessThan(487 * 1.1);
    expect(estimateHeight('frontmatter', thirteen, PHONE)).toBeGreaterThan(884 * 0.9);
    expect(estimateHeight('frontmatter', thirteen, PHONE)).toBeLessThan(884 * 1.1);
    expect(estimateHeight('frontmatter', front, DESKTOP)).toBe(estimateHeight('frontmatter', '---\nname: x\ntags: [a, b]\nstatus: x\n---', DESKTOP));
  });

  it('wraps a callout\'s text at the width of the editor', () => {
    const callout = '> [!note] A title\n> ' + 'word '.repeat(60).trim();
    const desktop = estimateHeight('callout', callout, DESKTOP);
    const phone = estimateHeight('callout', callout, PHONE);
    expect(desktop).toBeGreaterThanOrEqual(4 * 24);
    expect(phone).toBeGreaterThan(desktop);
  });

  it('gives a table a row per line but its delimiter row', () => {
    // Measured in the default theme on a computer: 117, 150 and 183 px for 3, 4 and 5 rows.
    const table = (rows: number) => ['| A | B |', '| --- | --- |', ...Array.from({ length: rows - 1 }, () => '| a | b |')].join('\n');
    expect([3, 4, 5].map((rows) => estimateHeight('table', table(rows), DESKTOP))).toEqual([117, 150, 183]);
    expect(estimateHeight('table', '| A |\n| --- |\n| ' + 'long words '.repeat(12) + '|', PHONE)).toBeGreaterThan(estimateHeight('table', table(2), PHONE));
  });

  it('is more than a line for every kind', () => {
    for (const kind of ['frontmatter', 'callout', 'table', 'embed', 'diagram', 'preview', 'add-properties'] as const) {
      expect(estimateHeight(kind, 'x', DEFAULT_METRICS), kind).toBeGreaterThan(DEFAULT_METRICS.lineHeight);
    }
  });

  it('assumes the default metrics for any it could not measure', () => {
    expect(withinReason({ width: 0, lineHeight: Number.NaN, charWidth: 9 })).toEqual({ width: 700, lineHeight: 24, charWidth: 9 });
  });
});

describe('a measured block', () => {
  it('is remembered at its width, whatever its place in the note', () => {
    rememberHeight('callout\u0000> [!tip] Kept', DESKTOP, 91);
    expect(measuredHeight('callout\u0000> [!tip] Kept', DESKTOP)).toBe(91);
    expect(measuredHeight('callout\u0000> [!tip] Kept', PHONE)).toBeUndefined();
    rememberHeight('callout\u0000> [!tip] Kept', DESKTOP, 0);
    expect(measuredHeight('callout\u0000> [!tip] Kept', DESKTOP)).toBe(91);
  });
});

describe('the blocks of the editor', () => {
  let mounted: Mounted | null = null;
  afterEach(() => {
    mounted?.unmount();
    mounted = null;
  });

  async function open(markdown: string): Promise<EditorView> {
    mounted = await mount(<NoteEditor markdown={markdown} />);
    for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
    return EditorView.findFromDOM(mounted.container.querySelector<HTMLElement>('.cm-editor')!)!;
  }

  /** Every widget the editor lays out, with where it stands. */
  function widgets(view: EditorView): { from: number; widget: WidgetType }[] {
    const found: { from: number; widget: WidgetType }[] = [];
    view.state.field(decorationsField).between(0, view.state.doc.length, (from, _to, decoration) => {
      const widget = decoration.spec.widget as WidgetType | undefined;
      if (widget) found.push({ from, widget });
    });
    return found;
  }

  const CALLOUT = '> [!note] A title\n> Some text in it.';
  const TABLE = '| A | B |\n| --- | --- |\n| a | b |\n| c | d |';
  const NOTE = `---\nname: A note\nstatus: draft\n---\n\n${CALLOUT}\n\n${TABLE}\n\n![A view|320x180](https://example.org/view.png)\n`;

  it('estimates each of them by what it draws, never one line for all', async () => {
    const view = await open(NOTE);
    const heights = widgets(view).map(({ widget }) => widget.estimatedHeight);
    // The editor's own metrics, as it read them once it was laid out.
    const metrics = view.state.field(metricsField);
    expect(heights).toContain(estimateHeight('frontmatter', '---\nname: A note\nstatus: draft\n---', metrics));
    expect(heights).toContain(estimateHeight('callout', CALLOUT, metrics));
    expect(heights).toContain(estimateHeight('table', TABLE, metrics));
    // The image declares its height, and its line is as tall.
    expect(heights).toContain(180);
  });

  it('draws an image at the dimensions it declares, with its description as its text', async () => {
    const view = await open(NOTE);
    const image = view.dom.querySelector<HTMLImageElement>('img.cm-ms-image')!;
    expect(image.getAttribute('alt')).toBe('A view');
    expect(image.getAttribute('width')).toBe('320');
    expect(image.getAttribute('height')).toBe('180');
  });

  it('starts a block at the height it was drawn at before, once an edit above it moved it', async () => {
    const view = await open(NOTE);
    const metrics = DEFAULT_METRICS;
    rememberHeight(`callout\u0000${CALLOUT}`, metrics, 321);
    await act(async () => view.dispatch({ changes: { from: NOTE.indexOf('> [!note]'), insert: 'Above.\n\n' } }));
    expect(widgets(view).map(({ widget }) => widget.estimatedHeight)).toContain(321);
  });

  it('says how tall each line of text is, so no line is left to the estimate of a gap (#94)', async () => {
    const note = '# A title\n\nA line.\n\nAnother line, and a third.\n';
    const view = await open(note);
    const estimates = widgets(view).filter(({ widget }) => widget.constructor.name === 'LineEstimate');
    const lines = estimates.map(({ from }) => view.state.doc.lineAt(from).number);
    // Every line with text, the heading included where headings were measured; never a blank one.
    expect(lines).toEqual(expect.arrayContaining([3, 5]));
    expect(lines).not.toContain(2);
    expect(lines).not.toContain(4);
  });

  it('makes a block again with the height learned for it, keeping what it drew (#94)', async () => {
    const view = await open(NOTE);
    const metrics = view.state.field(metricsField);
    const drawn = view.dom.querySelector('.cm-ms-block .callout')?.closest('.cm-ms-block');
    rememberHeight(`callout\u0000${CALLOUT}`, metrics, 432);
    // Any rebuild of the page reads the height learned.
    await act(async () => view.dispatch({ selection: { anchor: 0 } }));
    expect(widgets(view).map(({ widget }) => widget.estimatedHeight)).toContain(432);
    if (drawn) expect(view.dom.querySelector('.cm-ms-block .callout')?.closest('.cm-ms-block')).toBe(drawn);
  });
});

describe('an embedded note (#94)', () => {
  let mounted: Mounted | null = null;
  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    vi.unstubAllGlobals();
  });

  it('is drawn out of sight as the editor opens, and let go once it is drawn', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
    let answer: (note: { markdown: string; name: string; address: null }) => void = () => undefined;
    const loadNote = vi.fn(() => new Promise<{ markdown: string; name: string; address: null }>((done) => (answer = done)));
    mounted = await mount(<NoteEditor markdown={'Text.\n\n![[Other]]\n'} loadNote={loadNote} reaches={() => 1} />);
    const settle = async () => {
      for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
    };
    await settle();
    // Asked for once by the page, and once ahead of it, out of sight and hidden from a reader.
    expect(loadNote).toHaveBeenCalledWith('Other');
    const hidden = mounted.container.querySelector<HTMLElement>('.cm-ms-premeasure');
    expect(hidden?.getAttribute('aria-hidden')).toBe('true');
    expect(hidden?.style.visibility).toBe('hidden');
    await act(async () => answer({ markdown: '# Other\n\nIts text.\n', name: 'Other', address: null }));
    await settle();
    expect(mounted.container.querySelector('.cm-ms-premeasure')).toBeNull();
  });
});

describe('the estimate of a line (#94)', () => {
  const HEADING: LineMetrics = { lineHeight: 36, charWidth: 14, padding: 14, inset: 0 };
  const CODE: LineMetrics = { lineHeight: 21, charWidth: 7.5, padding: 0, inset: 16 };
  const metrics = (width: number): BlockMetrics => ({ width, lineHeight: 24, charWidth: 8.6, headings: [HEADING, HEADING, HEADING, HEADING, HEADING, HEADING], code: CODE });

  it('wraps a line of text at the width of the column, which a phone reaches sooner', () => {
    // Measured in the default theme: a line of 60 characters is one line on a computer, two on a phone.
    expect(lineHeightOf('text', 60, metrics(700))).toBe(24);
    expect(lineHeightOf('text', 60, metrics(358))).toBe(48);
  });

  it('draws a heading at its own size, with the space above it', () => {
    expect(lineHeightOf({ heading: 1 }, 10, metrics(700))).toBe(14 + 36);
    expect(lineHeightOf({ heading: 1 }, 40, metrics(358))).toBe(14 + 2 * 36);
  });

  it('wraps a line of code at the width its sides leave', () => {
    expect(lineHeightOf('code', 60, metrics(700))).toBe(21);
    expect(lineHeightOf('code', 60, metrics(358))).toBe(42);
  });

  it('says nothing of a kind of line that was not measured', () => {
    expect(lineHeightOf({ heading: 2 }, 10, DEFAULT_METRICS)).toBeNull();
    expect(lineHeightOf('code', 10, DEFAULT_METRICS)).toBeNull();
  });
});
