/**
 * The commands of the toolbar and the shortcuts (#52, #53, #57, #59): each writes the notation of
 * what it does around the selection, and nothing else of the note moves.
 */

import { EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import {
  BLOCKS,
  insertBlock,
  insertFootnote,
  insertLink,
  insertWikilink,
  setHeading,
  toggleComment,
  toggleList,
  toggleMark,
  toggleQuote,
  toggleTaskBox,
} from '../../src/edit/commands.js';

/** A state with the selection between the two `|` of the text, or at the one `|`. */
function at(text: string): EditorState {
  const first = text.indexOf('|');
  const second = text.indexOf('|', first + 1);
  const doc = text.replace(/\|/g, '');
  const selection = second === -1 ? EditorSelection.cursor(first) : EditorSelection.range(first, second - 1);
  return EditorState.create({ doc, selection: EditorSelection.create([selection]), extensions: EditorState.allowMultipleSelections.of(true) });
}

const run = (state: EditorState, spec: (state: EditorState) => TransactionSpec | null): string => {
  const transaction = spec(state);
  return transaction ? state.update(transaction).state.doc.toString() : state.doc.toString();
};

describe('inline marks', () => {
  it('wraps a selection and unwraps it again, from inside or outside', () => {
    expect(run(at('a |word| b'), (state) => toggleMark(state, '**'))).toBe('a **word** b');
    expect(run(at('a **|word|** b'), (state) => toggleMark(state, '**'))).toBe('a word b');
    expect(run(at('a |**word**| b'), (state) => toggleMark(state, '**'))).toBe('a word b');
    expect(run(at('a |word| b'), (state) => toggleMark(state, '=='))).toBe('a ==word== b');
  });

  it('writes an empty pair at a cursor, the cursor between', () => {
    const state = at('a | b');
    const next = state.update(toggleMark(state, '_')).state;
    expect(next.doc.toString()).toBe('a __ b');
    expect(next.selection.main.head).toBe(3);
  });
});

describe('lines', () => {
  it('sets and clears a heading, a quotation\'s markers kept', () => {
    expect(run(at('Ti|tle'), (state) => setHeading(state, 2))).toBe('## Title');
    expect(run(at('### Ti|tle'), (state) => setHeading(state, 1))).toBe('# Title');
    expect(run(at('## Ti|tle'), (state) => setHeading(state, 0))).toBe('Title');
    expect(run(at('> Ti|tle'), (state) => setHeading(state, 3))).toBe('> ### Title');
  });

  it('makes lines a list of a kind, and back to paragraphs', () => {
    expect(run(at('|one\ntwo|'), (state) => toggleList(state, 'bullet'))).toBe('- one\n- two');
    expect(run(at('|one\ntwo|'), (state) => toggleList(state, 'ordered'))).toBe('1. one\n2. two');
    expect(run(at('|- one\n- two|'), (state) => toggleList(state, 'task'))).toBe('- [ ] one\n- [ ] two');
    expect(run(at('|- [x] one\n- [ ] two|'), (state) => toggleList(state, 'task'))).toBe('one\ntwo');
    expect(run(at('  |- one|'), (state) => toggleList(state, 'bullet'))).toBe('  one');
  });

  it('starts a list of each kind on a blank line, the cursor after its marker (#74)', () => {
    const cases = [
      ['bullet', '- '],
      ['ordered', '1. '],
      ['task', '- [ ] '],
    ] as const;
    for (const [kind, marker] of cases) {
      const state = at('Text.\n\n|\n\nMore.');
      const next = state.update(toggleList(state, kind)).state;
      expect(next.doc.toString()).toBe(`Text.\n\n${marker}\n\nMore.`);
      expect(next.selection.main.head).toBe(7 + marker.length);
    }
    // In a quotation, after its marker; and blank lines among items are still left alone.
    expect(run(at('> |'), (state) => toggleList(state, 'bullet'))).toBe('> - ');
    expect(run(at('|one\n\ntwo|'), (state) => toggleList(state, 'bullet'))).toBe('- one\n\n- two');
  });

  it('quotes and unquotes lines', () => {
    expect(run(at('|a\nb|'), toggleQuote)).toBe('> a\n> b');
    expect(run(at('|> a\n> b|'), toggleQuote)).toBe('a\nb');
  });

  it('leaves a cursor at a line\'s start after the marker it writes, so typing goes in it (#82)', () => {
    const after = (text: string, spec: (state: EditorState) => TransactionSpec) => {
      const state = at(text);
      const next = state.update(spec(state)).state;
      return `${next.doc.sliceString(0, next.selection.main.head)}|${next.doc.sliceString(next.selection.main.head)}`;
    };
    expect(after('Text.\n\n|\n\nMore.', toggleQuote)).toBe('Text.\n\n> |\n\nMore.');
    expect(after('|one', toggleQuote)).toBe('> |one');
    expect(after('|one', (state) => setHeading(state, 2))).toBe('## |one');
    expect(after('|one', (state) => toggleList(state, 'bullet'))).toBe('- |one');
    // A cursor elsewhere in the line keeps its place in the text, and one stays there when the marker goes.
    expect(after('on|e', toggleQuote)).toBe('> on|e');
    expect(after('> on|e', toggleQuote)).toBe('on|e');
    // Before a quotation's marker, a list's goes after it, and so does the cursor.
    expect(after('|> one', (state) => toggleList(state, 'bullet'))).toBe('> - |one');
  });

  it('flips a task box as toggleTaskAt does', () => {
    expect(run(at('- [ ] a'), (state) => toggleTaskBox(state, 2))).toBe('- [x] a');
    expect(run(at('- [X] a'), (state) => toggleTaskBox(state, 2))).toBe('- [ ] a');
    expect(toggleTaskBox(at('- a'), 2)).toBeNull();
  });
});

describe('blocks', () => {
  it('replaces a blank line with a block, and puts one after a paragraph with blank lines around', () => {
    expect(run(at('Text\n|\nMore'), (state) => insertBlock(state, BLOCKS.math.text, BLOCKS.math.cursor))).toBe('Text\n\n$$\n\n$$\n\nMore');
    expect(run(at('Te|xt\nstill\n\nNext'), (state) => insertBlock(state, BLOCKS.rule.text, BLOCKS.rule.cursor))).toBe('Text\nstill\n\n---\n\nNext');
    expect(run(at('Te|xt'), (state) => insertBlock(state, BLOCKS.callout.text, BLOCKS.callout.cursor))).toBe('Text\n\n> [!note]\n> ');
    // A blank line before a rule, which right under a paragraph would make it a heading.
    expect(run(at('Text\n|'), (state) => insertBlock(state, BLOCKS.rule.text, BLOCKS.rule.cursor))).toBe('Text\n\n---\n');
  });

  it('puts the cursor where the block says, or on the line after it', () => {
    const rule = at('Te|xt');
    const after = rule.update(insertBlock(rule, BLOCKS.rule.text, BLOCKS.rule.cursor)).state;
    expect(after.doc.toString()).toBe('Text\n\n---\n');
    expect(after.selection.main.head).toBe(after.doc.length);
    const code = at('|');
    const inside = code.update(insertBlock(code, BLOCKS.codeBlock.text, BLOCKS.codeBlock.cursor)).state;
    expect(inside.doc.lineAt(inside.selection.main.head).number).toBe(2);
  });
});

describe('links, footnotes and comments', () => {
  it('makes a link and a wikilink of the selection', () => {
    expect(run(at('see |this| now'), insertLink)).toBe('see [this](https://) now');
    expect(run(at('see |Note| now'), insertWikilink)).toBe('see [[Note]] now');
    expect(run(at('see | now'), insertWikilink)).toBe('see [[]] now');
  });

  it('numbers a new footnote after the highest one and defines it at the end', () => {
    expect(run(at('One[^1] and two|.\n\n[^1]: First.\n'), insertFootnote)).toBe('One[^1] and two[^2].\n\n[^1]: First.\n\n[^2]: ');
    expect(run(at('Plain|'), insertFootnote)).toBe('Plain[^1]\n\n[^1]: ');
  });

  it('wraps a selection in a comment and takes it out again', () => {
    expect(run(at('a |secret| b'), toggleComment)).toBe('a %%secret%% b');
    expect(run(at('a |%%secret%%| b'), toggleComment)).toBe('a secret b');
    expect(run(at('a | b'), toggleComment)).toBe('a %%  %% b');
  });
});
