/**
 * A note edited on the page that draws it (#48, ADR-006).
 *
 * The editor holds the note's bytes and nothing else: CodeMirror keeps the text, the live page
 * (`live.ts`) draws it as the reading surface would, and every change the author makes — typed,
 * from the toolbar, in a table's cell or in the properties form — is a change to those bytes,
 * handed to the host with `onChange`. What the author did not touch is never rewritten, so the
 * host receives a note that differs from the one it gave only where it was edited (#50).
 */

import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands';
import { markdown, markdownKeymap } from '@codemirror/lang-markdown';
import { Annotation, Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { HOST_KEYS, HostProvider, resolveHost, type NoteHost, type ResolvedHost } from '../host.js';
import { rootStyle } from '../theme.js';
import { ICONS } from './blocks.js';
import {
  BLOCKS,
  command,
  headingLevel,
  insertBlock,
  insertFootnote,
  insertLink,
  insertWikilink,
  setHeading,
  toggleComment,
  toggleList,
  toggleMark,
  toggleQuote,
  type Command,
} from './commands.js';
import { analysisField, editorEnvironment, livePage } from './live.js';

export interface NoteEditorProps extends Omit<NoteHost, 'writable' | 'onToggleTask'> {
  /** The note as the host keeps it, frontmatter included. A new value that differs from the editor's is taken in. */
  readonly markdown: string;
  /** The note after each change the author makes, byte for byte the original wherever it was not edited. */
  readonly onChange?: (markdown: string) => void;
  /** Whether the author may change the note. Defaults to `true`. */
  readonly editable?: boolean;
  /** What sits at the top right of the note, such as the switch back to reading. */
  readonly corner?: ReactNode;
  /** Whether the editor takes the focus when it opens. */
  readonly autoFocus?: boolean;
}

/**
 * The line break a note is written with, which the editor writes back: `\n` or `\r\n`. `null`
 * for a note that mixes them, or has a lone `\r`, which the editor cannot keep byte for byte.
 */
export function lineBreakOf(text: string): '\n' | '\r\n' | null {
  if (!text.includes('\r')) return '\n';
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const cr = (text.match(/\r/g) ?? []).length;
  const lf = (text.match(/\n/g) ?? []).length;
  return crlf === cr && crlf === lf ? '\r\n' : null;
}

/** The change a host's new text makes to the editor's: the middle that differs, prefix and suffix kept. */
function difference(current: string, next: string): { from: number; to: number; insert: string } | null {
  if (current === next) return null;
  let start = 0;
  while (start < current.length && start < next.length && current[start] === next[start]) start++;
  let end = 0;
  while (end < current.length - start && end < next.length - start && current[current.length - 1 - end] === next[next.length - 1 - end]) end++;
  return { from: start, to: current.length - end, insert: next.slice(start, next.length - end) };
}

/** A change that came from the host, which is not handed back to it. */
const fromHost = Annotation.define<boolean>();

/** The names a host suggests after `[[`, completed with the closing brackets. */
function wikilinkCompletion(host: () => ResolvedHost) {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const typed = context.matchBefore(/\[\[[^\]|#\n]*$/);
    const suggest = host().suggest;
    if (!typed || !suggest) return null;
    const query = typed.text.slice(2);
    const names = await suggest(query);
    const closed = context.state.sliceDoc(context.pos, context.pos + 2) === ']]';
    return {
      from: typed.from + 2,
      options: names.map((name) => ({ label: name, apply: closed ? name : `${name}]]` })),
      validFor: /^[^\]|#\n]*$/,
    };
  };
}

const shortcuts = (view: () => EditorView | null): Extension =>
  keymap.of([
    { key: 'Mod-b', run: command((state) => toggleMark(state, '**')) },
    { key: 'Mod-i', run: command((state) => toggleMark(state, '_')) },
    { key: 'Mod-Shift-x', run: command((state) => toggleMark(state, '~~')) },
    { key: 'Mod-Shift-h', run: command((state) => toggleMark(state, '==')) },
    { key: 'Mod-e', run: command((state) => toggleMark(state, '`')) },
    { key: 'Mod-k', run: command(insertLink) },
    { key: 'Mod-Shift-k', run: command(insertWikilink) },
    { key: 'Mod-Shift-7', run: command((state) => toggleList(state, 'ordered')) },
    { key: 'Mod-Shift-8', run: command((state) => toggleList(state, 'bullet')) },
    { key: 'Mod-Shift-9', run: command((state) => toggleList(state, 'task')) },
    { key: 'Mod-Shift-.', run: command(toggleQuote) },
    { key: 'Mod-/', run: command(toggleComment) },
    ...[0, 1, 2, 3, 4, 5, 6].map((level) => ({ key: `Mod-Alt-${level}`, run: command((state) => setHeading(state, level)) })),
    { key: 'Escape', run: () => (view()?.contentDOM.blur(), true) },
  ]);

/** The toolbar of the editor: the marks, the blocks and the history, each a command. */
function Toolbar({ view, host }: { view: EditorView | null; host: ResolvedHost }) {
  const words = host.strings.editor;
  const disabled = !view || view.state.readOnly;
  const run = (action: Command) => () => view && action(view);
  const button = (name: keyof typeof ICONS & keyof typeof words, action: Command, shortcut?: string) => (
    <button
      key={name}
      type="button"
      className="edit-control"
      title={shortcut ? `${words[name]} (${shortcut})` : words[name]}
      aria-label={words[name]}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={run(action)}
    >
      {ICONS[name]}
    </button>
  );
  const block = (name: keyof typeof BLOCKS & keyof typeof ICONS & keyof typeof words) =>
    button(name, command((state) => insertBlock(state, BLOCKS[name].text, BLOCKS[name].cursor)));
  const level = view ? headingLevel(view.state) : 0;
  return (
    <div className="edit-toolbar" role="toolbar" aria-label={words.toolbar}>
      <span className="edit-toolbar-group">
        {button('undo', undo, 'Mod-Z')}
        {button('redo', redo, 'Mod-Shift-Z')}
      </span>
      <span className="edit-toolbar-group">
        <select
          className="edit-heading"
          aria-label={words.heading}
          title={words.heading}
          value={level}
          disabled={disabled}
          onChange={(event) => view && command((state) => setHeading(state, Number(event.target.value)))(view)}
        >
          <option value={0}>{words.paragraph}</option>
          {[1, 2, 3, 4, 5, 6].map((each) => (
            <option key={each} value={each}>
              {`${words.heading} ${each}`}
            </option>
          ))}
        </select>
      </span>
      <span className="edit-toolbar-group">
        {button('bold', command((state) => toggleMark(state, '**')), 'Mod-B')}
        {button('italic', command((state) => toggleMark(state, '_')), 'Mod-I')}
        {button('strikethrough', command((state) => toggleMark(state, '~~')), 'Mod-Shift-X')}
        {button('highlight', command((state) => toggleMark(state, '==')), 'Mod-Shift-H')}
        {button('code', command((state) => toggleMark(state, '`')), 'Mod-E')}
      </span>
      <span className="edit-toolbar-group">
        {button('link', command(insertLink), 'Mod-K')}
        {button('wikilink', command(insertWikilink), 'Mod-Shift-K')}
        {button('footnote', command(insertFootnote))}
        {button('comment', command(toggleComment), 'Mod-/')}
      </span>
      <span className="edit-toolbar-group">
        {button('bulletList', command((state) => toggleList(state, 'bullet')), 'Mod-Shift-8')}
        {button('orderedList', command((state) => toggleList(state, 'ordered')), 'Mod-Shift-7')}
        {button('taskList', command((state) => toggleList(state, 'task')), 'Mod-Shift-9')}
        {button('quote', command(toggleQuote), 'Mod-Shift-.')}
      </span>
      <span className="edit-toolbar-group">
        {block('callout')}
        {block('table')}
        {block('codeBlock')}
        {block('math')}
        {block('diagram')}
        {block('rule')}
      </span>
    </div>
  );
}

/**
 * Edits a note on the page that draws it. Exported at `@memorysmithapp/markdown-renderer/edit`
 * for a host that edits without the switch of `NoteBody`; `NoteBody` loads it on demand.
 */
export function NoteEditor({ markdown: given, onChange, editable = true, corner, autoFocus = false, ...host }: NoteEditorProps) {
  const resolved = useMemo(
    () => resolveHost(host),
    // Every member of the contract, so a host that passes the same functions keeps the same host.
    HOST_KEYS.map((key) => (host as NoteHost)[key]),
  );
  const parent = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const environment = useRef(new Compartment());
  const access = useRef(new Compartment());
  const latest = useRef({ onChange, host: resolved });
  latest.current = { onChange, host: resolved };
  const lineBreak = lineBreakOf(given);
  const readOnly = !editable || lineBreak === null;
  /**
   * The editor splits its text on any line break, so a paste or a block written with `\n` is lines
   * like any other, and writes the note back with the break it was written with: what a host
   * receives is CRLF throughout when the note was.
   */
  const written = useRef(lineBreak ?? '\n');
  written.current = lineBreak ?? written.current;
  const output = (state: EditorState): string => state.doc.sliceString(0, state.doc.length, written.current);

  useEffect(() => {
    if (!parent.current) return;
    const created: EditorView = new EditorView({
      parent: parent.current,
      state: EditorState.create({
        doc: given,
        extensions: [
          access.current.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
          environment.current.of(editorEnvironment.of({ host: resolved })),
          history(),
          markdown(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-multiline': 'true', spellcheck: 'true' }),
          livePage(),
          autocompletion({ override: [wikilinkCompletion(() => latest.current.host)], icons: false }),
          shortcuts(() => created),
          keymap.of([...markdownKeymap, ...historyKeymap, indentWithTab, ...defaultKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !update.transactions.some((transaction) => transaction.annotation(fromHost))) {
              latest.current.onChange?.(output(update.state));
            }
            if (update.docChanged || update.selectionSet || update.focusChanged) redraw();
          }),
        ],
      }),
    });
    setView(created);
    if (autoFocus) {
      // The cursor starts where the body does, so the frontmatter stays drawn as the form.
      created.dispatch({ selection: { anchor: created.state.field(analysisField).bodyFrom } });
      created.focus();
    }
    return () => created.destroy();
    // The editor is made once; what changes later reaches it through the effects below.
  }, []);

  useEffect(() => {
    view?.dispatch({ effects: environment.current.reconfigure(editorEnvironment.of({ host: resolved })) });
  }, [view, resolved]);

  useEffect(() => {
    view?.dispatch({ effects: access.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]) });
  }, [view, readOnly]);

  // A note the host changed — a tick saved, another device — is taken in as the change it is.
  useEffect(() => {
    if (!view) return;
    const change = difference(output(view.state), given);
    if (change) view.dispatch({ changes: change, annotations: [fromHost.of(true)] });
  }, [view, given]);

  return (
    <HostProvider value={resolved}>
      <div
        className={`markdown markdown-theme-${resolved.theme.name} markdown-editing`}
        data-theme={resolved.scheme}
        style={rootStyle(resolved.theme, resolved.scheme)}
      >
        {corner}
        <Toolbar view={view} host={resolved} />
        {lineBreak === null && <p className="edit-unavailable">{resolved.strings.editUnavailable}</p>}
        <div ref={parent} className="markdown-editor" />
      </div>
    </HostProvider>
  );
}
