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
import { Annotation, Compartment, EditorState, type Extension, type TransactionSpec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode, type RefObject } from 'react';
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
import { NoteActions } from '../NoteActions.js';
import { AttachDialog, webImage, type ChosenFile } from './AttachDialog.js';
import { ContextMenu, type MenuGroup, type MenuItem } from './ContextMenu.js';
import { chooseLanguageAt } from './LanguageControl.js';
import { useEditSaves, type EditSaves } from './saves.js';
import { SaveNoticeDialog } from './SaveNoticeDialog.js';

export interface NoteEditorProps extends Omit<NoteHost, 'writable' | 'onToggleTask'> {
  /** The note as the host keeps it, frontmatter included. A new value that differs from the editor's is taken in. */
  readonly markdown: string;
  /**
   * The note after each change the author makes, byte for byte the original wherever it was not
   * edited. A promise answered is the save of that change, which the editor reports (#64); one that
   * resolves with a `SaveOutcome` or rejects with a `SaveRefusal` has the host's words and actions (#86).
   */
  readonly onChange?: (markdown: string) => unknown;
  /** Whether the author may change the note. Defaults to `true`. */
  readonly editable?: boolean;
  /** What sits at the top right of the note, such as the switch back to reading. */
  readonly corner?: ReactNode;
  /** Whether the editor takes the focus when it opens. */
  readonly autoFocus?: boolean;
  /**
   * The author asked to go back to reading. The editor waits for a save in flight, folds its
   * toolbar into the corner, and answers through `onLeave`: `true` once it may go, `false` when
   * the last save failed and the note stays in edit.
   */
  readonly leaving?: boolean;
  readonly onLeave?: (left: boolean) => void;
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

/** The note back to the text edit mode opened, as one change, the least that differs, which Undo reverses (#67). */
function revert(state: EditorState, opened: string): TransactionSpec | null {
  const change = difference(state.doc.toString(), opened);
  return change ? { changes: change, selection: { anchor: Math.min(change.from + change.insert.length, opened.length) } } : null;
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

/** The editing menu's keys: the context-menu key and Shift+F10 open it at the cursor (#81). */
const menuKeys = (open: (view: EditorView) => boolean): Extension =>
  keymap.of([
    { key: 'Shift-F10', run: open },
    { key: 'ContextMenu', run: open },
  ]);

/**
 * Inserts one of the toolbar's blocks; a code block then opens the choice of its language, its
 * search focused, so the author names the language first (#84).
 */
function insertBlockCommand(name: keyof typeof BLOCKS): Command {
  const insert = command((state) => insertBlock(state, BLOCKS[name].text, BLOCKS[name].cursor));
  if (name !== 'codeBlock') return insert;
  return (view) => {
    if (!insert(view)) return false;
    const line = view.state.doc.lineAt(view.state.selection.main.head);
    if (line.number > 1) chooseLanguageAt(view, view.state.doc.line(line.number - 1).from);
    return true;
  };
}

/** Where the files the author attached stand: none in flight, some being kept, or the last one failed. */
type Attaching = 'idle' | 'busy' | 'failed';

/** How long the attach button says a file was not attached, in milliseconds. */
const ATTACH_FAILED_MS = 3000;

/** The toolbar of the editor: the marks, the blocks and the history, each a command. */
function Toolbar({
  view,
  host,
  end,
  opened,
  onAttach,
  attaching,
  attachButton,
}: {
  view: EditorView | null;
  host: ResolvedHost;
  /** What closes the toolbar at its top right: the save's status and the switch (#65). */
  end: ReactNode;
  /** The note as edit mode opened it, with `\n` for its line breaks, which *Undo all changes* gives back (#67). */
  opened: string;
  /** Opens the attach dialog (#75, #78). */
  onAttach: () => void;
  attaching: Attaching;
  attachButton: RefObject<HTMLButtonElement | null>;
}) {
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
  const block = (name: keyof typeof BLOCKS & keyof typeof ICONS & keyof typeof words) => button(name, insertBlockCommand(name));
  const level = view ? headingLevel(view.state) : 0;
  return (
    <div className="edit-toolbar" role="toolbar" aria-label={words.toolbar}>
      <div className="edit-toolbar-tools">
        <span className="edit-toolbar-group">
          <button
            type="button"
            className="edit-control"
            title={words.revert}
            aria-label={words.revert}
            disabled={!view || view.state.readOnly || view.state.doc.toString() === opened}
            onMouseDown={(event) => event.preventDefault()}
            onClick={run(command((state) => revert(state, opened)))}
          >
            {ICONS.revert}
          </button>
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
          <button
            ref={attachButton}
            type="button"
            className="edit-control"
            title={attaching === 'busy' ? words.attaching : attaching === 'failed' ? words.attachFailed : words.attach}
            aria-label={words.attach}
            aria-busy={attaching === 'busy' ? true : undefined}
            data-attach={attaching}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onAttach}
          >
            {attaching === 'busy' ? ICONS.saving : attaching === 'failed' ? ICONS.notSaved : ICONS.attach}
          </button>
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
      {end}
    </div>
  );
}

/**
 * Where the save of the author's last change stands, in the toolbar before the switch: an icon for
 * each state, in a slot of one size, so the toolbar never moves as the author types; its word is
 * its title. A failed save's icon is the button that tries again (#66). When the host said why —
 * an alert on a save that succeeded, or the reason for one it refused — the icon is the button that
 * opens what it said, with the host's title as its tooltip, and the author's choices (#86). Whoever
 * hears the page is told the whole of it, why the note stays in edit included.
 */
function SaveStatus({ saves, blocked, host, onDecided }: { saves: EditSaves; blocked: boolean; host: ResolvedHost; onDecided: () => void }) {
  const { state, notice } = saves;
  const words = host.strings.editor;
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  // A notice the save no longer carries has nothing left to show.
  useEffect(() => {
    if (!notice) setOpen(false);
  }, [notice]);
  const base = state === 'saving' ? words.saving : state === 'saved' ? host.strings.saved : state === 'failed' ? host.strings.notSaved : '';
  const shown = notice ? notice.title : base;
  const said = state === 'failed' && blocked ? (notice ? `${words.stayInEdit}. ${notice.title}` : words.stayInEdit) : shown;
  const icon =
    state === 'saving' ? ICONS.saving : state === 'saved' ? ICONS.saved : state === 'alert' ? ICONS.alert : state === 'failed' ? ICONS.notSaved : null;
  const retryLabel = `${said}. ${words.retry}`;
  return (
    <div className="edit-save" data-save={state} title={state === 'failed' || notice ? undefined : said || undefined}>
      {notice ? (
        <button
          ref={button}
          type="button"
          className="edit-save-icon edit-save-notice"
          title={notice.title}
          aria-label={notice.title}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          {icon}
        </button>
      ) : state === 'failed' ? (
        <button type="button" className="edit-save-icon edit-save-retry" title={retryLabel} aria-label={retryLabel} onClick={saves.retry}>
          {icon}
        </button>
      ) : (
        <span className="edit-save-icon">{icon}</span>
      )}
      <span className="visually-hidden" role="status" aria-live="polite">
        {said}
      </span>
      {open && notice && (
        <SaveNoticeDialog
          notice={notice}
          onClose={() => setOpen(false)}
          onClosed={(chosen) => (chosen ? onDecided() : button.current?.focus())}
          onAction={(action) => {
            setOpen(false);
            saves.run(action);
          }}
        />
      )}
    </div>
  );
}

/**
 * Edits a note on the page that draws it. Exported at `@memorysmithapp/markdown-renderer/edit`
 * for a host that edits without the switch of `NoteBody`; `NoteBody` loads it on demand.
 */
export function NoteEditor({ markdown: given, onChange, editable = true, corner, autoFocus = false, leaving = false, onLeave, ...host }: NoteEditorProps) {
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
  const saves = useEditSaves(onChange);
  const latest = useRef({ hand: saves.hand, host: resolved, onLeave });
  latest.current = { hand: saves.hand, host: resolved, onLeave };
  /**
   * The texts handed to the host that it has not given back yet. A host that saves before it
   * passes the note again gives back a text the editor has since moved past; that echo is not a
   * change, and is never applied over what the author wrote after it.
   */
  const handed = useRef<string[]>([]);
  const bar = useRef<HTMLDivElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [refusals, setRefusals] = useState(0);
  const editorView = useRef<EditorView | null>(null);
  const [attaching, setAttaching] = useState<Attaching>('idle');
  /**
   * Hands each file to the host's `attach`, one after the other, and embeds it as `![[name]]` on a
   * line of its own where the cursor is once the host answered its name; a file the host could not
   * keep writes nothing, and the button says so for a moment (#75).
   */
  const attachFiles = useRef<(files: readonly ChosenFile[], at?: number) => void>(() => undefined);
  attachFiles.current = (files, at) => {
    const attach = resolved.attach;
    const target = editorView.current;
    if (!attach || !target || target.state.readOnly || files.length === 0) return;
    if (at !== undefined) target.dispatch({ selection: { anchor: at } });
    setAttaching('busy');
    void (async () => {
      let failed = false;
      for (const { file, name: wanted, description } of files) {
        try {
          const name = await attach(file, { name: wanted, description });
          insertLine(`![[${name}]]`);
        } catch {
          failed = true;
        }
      }
      if (editorView.current) setAttaching(failed ? 'failed' : 'idle');
    })();
  };
  /** A line of its own at the cursor: an embed, or an image of the web (#78). */
  const insertLine = (text: string) => {
    const current = editorView.current;
    if (current) command((state) => insertBlock(state, text, text.length + 1))(current);
  };
  const attachButton = useRef<HTMLButtonElement>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  /** Where the editing menu is open, in the window's coordinates (#81). */
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const openMenu = useRef((x: number, y: number) => setMenu({ x, y }));
  /** The menu's groups, from the same commands as the toolbar: Format with a selection, Insert, Edit. */
  const menuGroups = (target: EditorView): MenuGroup[] => {
    const words = resolved.strings.editor;
    const item = (name: keyof typeof ICONS & keyof typeof words, action: Command, shortcut?: string): MenuItem => ({
      name,
      label: words[name],
      icon: ICONS[name],
      shortcut,
      run: () => action(target),
    });
    const block = (name: keyof typeof BLOCKS & keyof typeof ICONS & keyof typeof words) => item(name, insertBlockCommand(name));
    const selection = target.state.selection.main;
    const selected = target.state.sliceDoc(selection.from, selection.to);
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    const groups: MenuGroup[] = [];
    if (!selection.empty) {
      groups.push({
        label: words.menuFormat,
        items: [
          item('bold', command((state) => toggleMark(state, '**')), 'Mod-b'),
          item('italic', command((state) => toggleMark(state, '_')), 'Mod-i'),
          item('strikethrough', command((state) => toggleMark(state, '~~')), 'Mod-Shift-x'),
          item('highlight', command((state) => toggleMark(state, '==')), 'Mod-Shift-h'),
          item('code', command((state) => toggleMark(state, '`')), 'Mod-e'),
        ],
      });
    }
    groups.push({
      label: words.menuInsert,
      items: [
        item('link', command(insertLink), 'Mod-k'),
        item('wikilink', command(insertWikilink), 'Mod-Shift-k'),
        item('bulletList', command((state) => toggleList(state, 'bullet')), 'Mod-Shift-8'),
        item('orderedList', command((state) => toggleList(state, 'ordered')), 'Mod-Shift-7'),
        item('taskList', command((state) => toggleList(state, 'task')), 'Mod-Shift-9'),
        item('quote', command(toggleQuote), 'Mod-Shift-.'),
        block('callout'),
        block('table'),
        block('codeBlock'),
        block('math'),
        block('diagram'),
        block('rule'),
        item('footnote', command(insertFootnote)),
        item('comment', command(toggleComment), 'Mod-/'),
        { name: 'attach', label: words.attach, icon: ICONS.attach, run: () => setAttachOpen(true) },
      ],
    });
    groups.push({
      label: words.menuEdit,
      items: [
        {
          name: 'cut',
          label: words.cut,
          icon: ICONS.cut,
          shortcut: 'Mod-x',
          disabled: selection.empty || !clipboard,
          run: () =>
            void clipboard?.writeText(selected).then(() => target.dispatch({ changes: { from: selection.from, to: selection.to }, userEvent: 'delete.cut' })),
        },
        { name: 'copy', label: words.copy, icon: ICONS.copy, shortcut: 'Mod-c', disabled: selection.empty || !clipboard, run: () => void clipboard?.writeText(selected) },
        {
          name: 'paste',
          label: words.paste,
          icon: ICONS.paste,
          shortcut: 'Mod-v',
          disabled: !clipboard?.readText,
          run: () =>
            void clipboard?.readText().then(
              (text) => target.dispatch({ ...target.state.replaceSelection(text), userEvent: 'input.paste', scrollIntoView: true }),
              () => undefined,
            ),
        },
      ],
    });
    return groups;
  };
  /** A pasted or dropped file, kept under its own name and with no description. */
  const asChosen = (files: readonly File[]): ChosenFile[] => files.map((file) => ({ file, name: file.name, description: '' }));
  useEffect(() => {
    if (attaching !== 'failed') return;
    const timer = setTimeout(() => setAttaching('idle'), ATTACH_FAILED_MS);
    return () => clearTimeout(timer);
  }, [attaching]);
  // The note as edit mode opened it, as the editor holds its text: lines joined by `\n`.
  const opened = useRef(given.replace(/\r\n?/g, '\n'));
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
          // A file pasted or dropped is attached, where the host keeps files (#75).
          menuKeys((target) => {
            if (target.state.readOnly) return false;
            const at = target.coordsAtPos(target.state.selection.main.head);
            const box = target.contentDOM.getBoundingClientRect();
            openMenu.current(at?.left ?? box.left, at?.bottom ?? box.top);
            return true;
          }),
          EditorView.domEventHandlers({
            // The editing menu where the pointer is; Shift keeps the browser's, and so do the
            // drawn blocks' own fields, which are the browser's to edit (#81).
            contextmenu: (event, target) => {
              if (event.shiftKey || target.state.readOnly) return false;
              if (event.target instanceof Element && event.target.closest('[data-ms-control]')) return false;
              event.preventDefault();
              const at = target.posAtCoords({ x: event.clientX, y: event.clientY });
              const selection = target.state.selection.main;
              if (at !== null && (at < selection.from || at > selection.to)) target.dispatch({ selection: { anchor: at } });
              openMenu.current(event.clientX, event.clientY);
              return true;
            },
            paste: (event) => {
              const files = [...(event.clipboardData?.files ?? [])];
              if (files.length === 0 || !latest.current.host.attach) return false;
              event.preventDefault();
              attachFiles.current(asChosen(files));
              return true;
            },
            drop: (event, target) => {
              const files = [...(event.dataTransfer?.files ?? [])];
              if (files.length === 0 || !latest.current.host.attach) return false;
              event.preventDefault();
              attachFiles.current(asChosen(files), target.posAtCoords({ x: event.clientX, y: event.clientY }) ?? undefined);
              return true;
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !update.transactions.some((transaction) => transaction.annotation(fromHost))) {
              const text = output(update.state);
              handed.current.push(text);
              if (handed.current.length > 100) handed.current.shift();
              latest.current.hand(text);
            }
            if (update.docChanged || update.selectionSet || update.focusChanged) redraw();
          }),
        ],
      }),
    });
    editorView.current = created;
    setView(created);
    if (autoFocus) {
      // The cursor starts where the body does, so the frontmatter stays drawn as the form.
      created.dispatch({ selection: { anchor: created.state.field(analysisField).bodyFrom } });
      created.focus();
    }
    return () => {
      editorView.current = null;
      created.destroy();
    };
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
    const echo = handed.current.indexOf(given);
    if (echo !== -1) {
      handed.current.splice(0, echo + 1);
      return;
    }
    handed.current = [];
    const change = difference(output(view.state), given);
    if (change) view.dispatch({ changes: change, annotations: [fromHost.of(true)] });
  }, [view, given]);

  /**
   * The toolbar grows out of the switch and shrinks back into it (#65): its clip starts and ends
   * on the corner that holds the switch, measured from the toolbar's top right edge.
   */
  useLayoutEffect(() => {
    const toolbar = bar.current?.querySelector<HTMLElement>('.edit-toolbar');
    const end = toolbar?.querySelector<HTMLElement>('.edit-corner');
    if (!toolbar || !end) return;
    const box = toolbar.getBoundingClientRect();
    const corner = end.getBoundingClientRect();
    // With the toolbar's own padding around it, so the corner alone reads as a box.
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(toolbar) : null;
    const left = parseFloat(style?.paddingLeft ?? '') || 0;
    const bottom = (parseFloat(style?.paddingBottom ?? '') || 0) + (parseFloat(style?.borderBottomWidth ?? '') || 0);
    toolbar.style.setProperty('--edit-corner-width', `${Math.max(0, box.right - corner.left + left)}px`);
    toolbar.style.setProperty('--edit-corner-height', `${Math.max(0, corner.bottom - box.top + bottom)}px`);
  });

  // Going back to reading waits for the save in flight; a failed one keeps the note here.
  const folding = leaving && saves.state !== 'saving' && saves.state !== 'failed';
  useEffect(() => {
    if (saves.state !== 'failed') setBlocked(false);
    if (!leaving || saves.state === 'saving') return;
    if (saves.state === 'failed') {
      setBlocked(true);
      setRefusals((count) => count + 1);
      latest.current.onLeave?.(false);
      return;
    }
    const toolbar = bar.current?.querySelector<HTMLElement>('.edit-toolbar');
    const animation = toolbar && typeof getComputedStyle === 'function' ? getComputedStyle(toolbar).animationName : '';
    let done = false;
    const leave = () => {
      if (done) return;
      done = true;
      latest.current.onLeave?.(true);
    };
    // A theme that does not fold the toolbar, or a reader who asked for less motion, goes at once.
    if (!toolbar || !animation || animation === 'none') {
      leave();
      return;
    }
    toolbar.addEventListener('animationend', leave);
    const timer = setTimeout(leave, 600);
    return () => {
      toolbar.removeEventListener('animationend', leave);
      clearTimeout(timer);
    };
  }, [leaving, saves.state]);


  return (
    <HostProvider value={resolved}>
      <div
        className={`markdown markdown-theme-${resolved.theme.name} markdown-editing`}
        data-theme={resolved.scheme}
        style={rootStyle(resolved.theme, resolved.scheme)}
      >
        <div ref={bar} className="edit-bar" data-leaving={folding ? '' : undefined}>
          <Toolbar
            view={view}
            host={resolved}
            opened={opened.current}
            onAttach={() => setAttachOpen(true)}
            attaching={attaching}
            attachButton={attachButton}
            end={
              <div
                className="edit-corner"
                aria-busy={leaving && saves.state === 'saving' ? true : undefined}
                data-blocked={blocked ? '' : undefined}
                // A refusal shakes the corner once each time the author asks to leave.
                key={blocked ? `blocked-${refusals}` : 'corner'}
              >
                <SaveStatus saves={saves} blocked={blocked} host={resolved} onDecided={() => view?.focus()} />
                {/* Alone, without NoteBody's switch, the editor keeps the note's Markdown at hand itself (#76). */}
                {corner ?? <NoteActions text={() => (view ? output(view.state) : given)} />}
              </div>
            }
          />
        </div>
        {menu && view && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            label={resolved.strings.editor.menu}
            groups={menuGroups(view)}
            onClose={(back) => {
              setMenu(null);
              if (back) view.focus();
            }}
          />
        )}
        {attachOpen && (
          <AttachDialog
            onClose={() => setAttachOpen(false)}
            onClosed={(inserted) => !inserted && attachButton.current?.focus()}
            onAttach={(files) => attachFiles.current(files)}
            onEmbed={(name) => insertLine(`![[${name}]]`)}
            onLink={(name, address) => insertLine(webImage(name, address))}
          />
        )}
        {lineBreak === null && <p className="edit-unavailable">{resolved.strings.editUnavailable}</p>}
        <div ref={parent} className="markdown-editor" />
      </div>
    </HostProvider>
  );
}
