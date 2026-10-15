/**
 * The editor's reading of a note (ADR-006): every construct the page draws, found as ranges of
 * the note's own bytes, so the editor can hide notation and draw blocks without touching them.
 */

import { describe, expect, it } from 'vitest';
import { analyze, type Construct } from '../../src/edit/analyze.js';

const of = (text: string, kind: Construct['kind']) => analyze(text).constructs.filter((each) => each.kind === kind);
const slice = (text: string, span: { from: number; to: number }) => text.slice(span.from, span.to);

describe('analyze', () => {
  it('finds the frontmatter and starts the body after it', () => {
    const text = '---\nname: A\n---\n# Title\n';
    const analysis = analyze(text);
    expect(analysis.bodyFrom).toBe(16);
    expect(of(text, 'frontmatter')).toEqual([{ kind: 'frontmatter', from: 0, to: 16 }]);
    const [heading] = of(text, 'heading');
    expect(heading).toMatchObject({ level: 1 });
    expect(heading && heading.kind === 'heading' && slice(text, heading.marker)).toBe('# ');
  });

  it('finds inline marks with their delimiters', () => {
    const text = 'a **b** _c_ ~~d~~ ==e== `f` ``g`h``\n';
    const marks = of(text, 'mark').map((each) => (each.kind === 'mark' ? [each.mark, slice(text, each.open), slice(text, each.close)] : []));
    expect(marks).toEqual([
      ['strong', '**', '**'],
      ['em', '_', '_'],
      ['strike', '~~', '~~'],
      ['highlight', '==', '=='],
      ['code', '`', '`'],
      ['code', '``', '``'],
    ]);
  });

  it('reads a wikilink once, with its alias as its label, and nothing inside it again', () => {
    const text = 'See [[Some **note**#Part|the part]] and [[Other]].\n';
    const links = of(text, 'wikilink');
    expect(links.map((each) => (each.kind === 'wikilink' ? [each.target, slice(text, each.label)] : []))).toEqual([
      ['Some **note**', 'the part'],
      ['Other', 'Other'],
    ]);
    expect(of(text, 'mark')).toEqual([]);
  });

  it('leaves code alone: no wikilink, no mark, no comment inside a fence or a span', () => {
    const text = '```md\n[[A]] **b** %%c%%\n```\n\n`[[D]]`\n';
    expect(of(text, 'wikilink')).toEqual([]);
    expect(of(text, 'comment')).toEqual([]);
    const [fence] = of(text, 'code');
    expect(fence).toMatchObject({ language: 'md', code: '[[A]] **b** %%c%%' });
    expect(fence && fence.kind === 'code' && fence.close && slice(text, fence.close)).toBe('```');
  });

  it('tells a callout from a quotation, and gives each quotation line its markers', () => {
    const text = '> [!warning]- Careful\n> body\n\n> plain\n> quote\n';
    const [callout] = of(text, 'callout');
    expect(callout).toMatchObject({ type: 'warning', fold: '-' });
    expect(callout && callout.kind === 'callout' && slice(text, callout.marker)).toBe('[!warning]-');
    expect(of(text, 'quoteMarker').map((each) => slice(text, each))).toEqual(['> ', '> ']);
  });

  it('finds list markers and task boxes', () => {
    const text = '- [ ] one\n- [x] two\n1. three\n';
    const markers = of(text, 'listMarker');
    expect(markers.map((each) => (each.kind === 'listMarker' ? [slice(text, each), each.ordered, each.task?.checked ?? null] : []))).toEqual([
      ['- ', false, false],
      ['- ', false, true],
      ['1. ', true, null],
    ]);
  });

  it('keeps a price whole, by the dollar rule', () => {
    expect(of('R$100 e o frete R$200\n', 'inlineMath')).toEqual([]);
    expect(of('so $x^2$ is\n', 'inlineMath')).toMatchObject([{ tex: 'x^2' }]);
    expect(of('$$\na+b\n$$\n', 'mathBlock')).toMatchObject([{ tex: 'a+b' }]);
  });

  it('finds an embed alone on its line as a block, and one in a sentence as a link', () => {
    const text = '![[Note#Part]]\n\nSee ![[file.png]] here.\n';
    expect(of(text, 'embed')).toMatchObject([{ target: 'Note', anchor: 'Part' }]);
    expect(of(text, 'wikilink')).toMatchObject([{ target: 'Note', embed: true }, { target: 'file.png', embed: true }]);
  });

  it('finds tables, rules, footnotes, comments, block identifiers and raw HTML', () => {
    const text = '| a |\n|---|\n| b |\n\n---\n\nText[^1] %%hidden%% ^block-1\n\n[^1]: The note.\n\n<div>x</div>\n';
    expect(of(text, 'table').map((each) => slice(text, each))).toEqual(['| a |\n|---|\n| b |']);
    expect(of(text, 'rule').map((each) => slice(text, each))).toEqual(['---']);
    expect(of(text, 'footnoteRef')).toMatchObject([{ label: '1' }]);
    expect(of(text, 'footnoteDef')).toMatchObject([{ label: '1' }]);
    expect(of(text, 'comment').map((each) => slice(text, each))).toEqual(['%%hidden%%']);
    expect(of(text, 'blockId').map((each) => slice(text, each))).toEqual(['^block-1']);
    expect(of(text, 'html').map((each) => slice(text, each))).toEqual(['<div>x</div>']);
  });
});
