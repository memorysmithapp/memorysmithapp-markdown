/**
 * The blocks the editor draws in place of their text while the author is not editing it, each
 * drawn by the reading surface's own components so that edit mode looks like the page (ADR-006):
 * a run of notation through `Markdown`, a callout with its type and folding controls, a table
 * whose cells are edited where they stand (#56), and the frontmatter as a form (#58).
 *
 * Every edit they make is a change to the note's bytes, dispatched to the editor; none of them
 * keeps a copy of the note.
 */

import type { EditorView } from '@codemirror/view';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useHost } from '../host.js';
import { Markdown } from '../Markdown.js';
import { hideComments, resolveWikilinks } from '../markdown.js';
import { isTrue, readProperties } from '../properties.js';
import { Transclusion } from '../Transclusion.js';
import { splitEmbeds } from '../transclusion.js';
import { wikilinkAddress } from '../wikilink-address.js';
import {
  addEntry,
  readFrontmatter,
  removeEntry,
  renameKey,
  setList,
  setScalar,
  type Frontmatter,
} from './frontmatter.js';
import {
  addColumn,
  addRow,
  alignColumn,
  columnCount,
  readTable,
  removeColumn,
  removeRow,
  setCell,
  type Alignment,
  type TextChange,
} from './table.js';

/** Whether a block's edit is being applied: the block is drawn anew, and the field it held lets the focus go. */
let writing = false;

/**
 * Applies changes to the note, as one step of its history.
 *
 * An edit draws its block again, and the field that held the focus is taken out of the page while
 * the editor updates; the browser tells it it lost the focus, and it would commit what it holds a
 * second time, inside that update. That second commit is the first one again, so it is dropped —
 * and so is any commit that arrives while the editor is updating for another reason.
 */
function write(view: EditorView, changes: readonly TextChange[], event = 'input.form'): void {
  if (changes.length === 0 || view.state.readOnly || writing) return;
  writing = true;
  try {
    view.dispatch({ changes: [...changes], userEvent: event });
  } catch (error) {
    if (!(error instanceof Error && /update is in progress/.test(error.message))) throw error;
  } finally {
    writing = false;
  }
}

/** A run of notation drawn as the reading surface draws it: comments out, wikilinks resolved, embeds expanded. */
export function Snippet({ text }: { text: string }) {
  const host = useHost();
  const body = hideComments(text).text;
  return (
    <>
      {splitEmbeds(body, host.keeps).map((segment, index) =>
        segment.kind === 'text' ? (
          <Markdown key={index}>{resolveWikilinks(segment.text, (name) => wikilinkAddress(host, name), host.keeps)}</Markdown>
        ) : (
          <Transclusion key={index} target={segment.target} anchor={segment.anchor} />
        ),
      )}
    </>
  );
}

/** A small button of the editor's own, outside the note's notation. */
function Control({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      className="edit-control"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      data-ms-control=""
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// ── Callouts ─────────────────────────────────────────────────────────────────

/** The types a callout may take from the toolbar: the families the default theme draws. */
export const CALLOUT_TYPES = [
  'note', 'info', 'todo', 'abstract', 'tip', 'success', 'question', 'warning', 'failure', 'danger', 'bug', 'example', 'quote',
] as const;

/**
 * A callout drawn as the page draws it, with its type and its folding chosen in place: each
 * choice rewrites the marker `[!type]±` of its first line and nothing else (#55).
 */
export function CalloutBlock({ view, text, marker }: { view: EditorView; text: string; marker: { from: number; to: number; type: string; fold: '+' | '-' | null } }) {
  const { strings } = useHost();
  const words = strings.editor;
  const types: string[] = CALLOUT_TYPES.includes(marker.type as (typeof CALLOUT_TYPES)[number]) ? [...CALLOUT_TYPES] : [marker.type, ...CALLOUT_TYPES];
  const rewrite = (type: string, fold: '+' | '-' | null) =>
    write(view, [{ from: marker.from, to: marker.to, insert: `[!${type}]${fold ?? ''}` }]);
  return (
    <div className="edit-block edit-callout">
      <div className="edit-block-controls" data-ms-control="">
        <select
          aria-label={words.calloutType}
          title={words.calloutType}
          value={marker.type}
          onChange={(event) => rewrite(event.target.value, marker.fold)}
        >
          {types.map((type) => (
            <option key={type} value={type}>
              {strings.callouts[type] ?? type}
            </option>
          ))}
        </select>
        <select
          aria-label={words.fold}
          title={words.fold}
          value={marker.fold ?? ''}
          onChange={(event) => rewrite(marker.type, (event.target.value || null) as '+' | '-' | null)}
        >
          <option value="">{words.foldNone}</option>
          <option value="+">{words.foldOpen}</option>
          <option value="-">{words.foldClosed}</option>
        </select>
      </div>
      <Snippet text={text} />
    </div>
  );
}

// ── Tables ───────────────────────────────────────────────────────────────────

/** Where the focus goes back to when a table is drawn again after an edit of one of its cells. */
let pendingFocus: { from: number; row: number; column: number } | null = null;

/**
 * A table whose cells are edited where they stand. A cell commits its text when it loses the focus,
 * or on Enter (to the cell below) and Tab (to the next one); each commit rewrites that cell's
 * content only. The controls add and remove rows and columns and align the column of the cell last
 * focused.
 */
export function TableBlock({ view, from, to }: { view: EditorView; from: number; to: number }) {
  const { strings } = useHost();
  const words = strings.editor;
  const source = view.state.doc.sliceString(0, view.state.doc.length, '\n');
  const table = readTable(source, from, to);
  const width = columnCount(table);
  const [focus, setFocus] = useState<{ row: number; column: number }>({ row: table.rows.length > 2 ? 2 : 0, column: 0 });
  // The cell being edited shows its source; every other one is drawn as the page draws it.
  const [editing, setEditing] = useState<{ row: number; column: number } | null>(null);
  const root = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (pendingFocus && pendingFocus.from === table.from) {
      const { row, column } = pendingFocus;
      pendingFocus = null;
      setEditing({ row, column });
      setFocus({ row, column });
    }
  });

  // A cell that starts being edited takes the focus, with the cursor at its end.
  useEffect(() => {
    if (!editing) return;
    const cell = root.current?.querySelector<HTMLElement>(`[data-row="${editing.row}"][data-column="${editing.column}"][contenteditable]`);
    if (!cell || document.activeElement === cell) return;
    cell.focus();
    const selection = window.getSelection();
    selection?.selectAllChildren(cell);
    selection?.collapseToEnd();
  }, [editing]);

  const commit = (row: number, column: number, value: string, next?: { row: number; column: number }) => {
    const changes = setCell(table, row, column, value);
    if (next) pendingFocus = { from: table.from, ...next };
    if (changes.length > 0) write(view, changes);
    else if (next) {
      pendingFocus = null;
      setEditing(next);
      setFocus(next);
    } else setEditing(null);
  };

  const onKey = (event: KeyboardEvent<HTMLElement>, row: number, column: number) => {
    const value = event.currentTarget.textContent ?? '';
    if (event.key === 'Enter') {
      event.preventDefault();
      const below = row === 0 ? 2 : row + 1;
      commit(row, column, value, below < table.rows.length ? { row: below, column } : undefined);
      if (below >= table.rows.length) event.currentTarget.blur();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const step = event.shiftKey ? -1 : 1;
      let nextColumn = column + step;
      let nextRow = row;
      if (nextColumn >= width) {
        nextColumn = 0;
        nextRow = row === 0 ? 2 : row + 1;
      } else if (nextColumn < 0) {
        nextColumn = width - 1;
        nextRow = row === 2 ? 0 : row - 1;
      }
      commit(row, column, value, nextRow >= 0 && nextRow < table.rows.length && nextRow !== 1 ? { row: nextRow, column: nextColumn } : undefined);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.currentTarget.textContent = table.rows[row]?.cells[column]?.text ?? '';
      event.currentTarget.blur();
      view.focus();
    }
  };

  const cell = (row: number, column: number) => {
    const text = table.rows[row]?.cells[column]?.text ?? '';
    const Tag = row === 0 ? 'th' : 'td';
    const style = table.align[column] ? { textAlign: table.align[column] ?? undefined } : undefined;
    if (editing?.row !== row || editing.column !== column || view.state.readOnly) {
      return (
        <Tag key={column} style={style}>
          <span
            className="edit-cell edit-cell-drawn"
            role="button"
            tabIndex={0}
            aria-label={`${row === 0 ? 1 : row} · ${column + 1}`}
            data-row={row}
            data-column={column}
            data-ms-control=""
            onMouseDown={(event) => {
              if (event.metaKey || event.ctrlKey || view.state.readOnly) return;
              event.preventDefault();
              setFocus({ row, column });
              setEditing({ row, column });
            }}
            onFocus={() => setFocus({ row, column })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'F2') {
                event.preventDefault();
                setEditing({ row, column });
              }
            }}
          >
            {/* A cell's escaped pipe is a pipe on the page, as GFM reads it. */}
            <Snippet text={text.replace(/\\\|/g, '|')} />
          </span>
        </Tag>
      );
    }
    return (
      <Tag key={column} style={style}>
        <span
          className="edit-cell"
          contentEditable={!view.state.readOnly}
          suppressContentEditableWarning
          role="textbox"
          aria-label={`${row === 0 ? 1 : row} · ${column + 1}`}
          data-row={row}
          data-column={column}
          data-ms-control=""
          onFocus={() => setFocus({ row, column })}
          onBlur={(event) => {
            commit(row, column, event.currentTarget.textContent ?? '');
            setEditing((current) => (current?.row === row && current.column === column ? null : current));
          }}
          onKeyDown={(event) => onKey(event, row, column)}
          onPaste={(event) => {
            event.preventDefault();
            document.execCommand('insertText', false, event.clipboardData.getData('text/plain').replace(/\r?\n/g, ' '));
          }}
        >
          {text}
        </span>
      </Tag>
    );
  };

  const align = (alignment: Alignment) => write(view, alignColumn(table, focus.column, alignment));
  const bodyRows = table.rows.slice(2);

  return (
    <div className="edit-block edit-table">
      <div className="edit-block-controls" data-ms-control="">
        <Control label={words.addRow} onClick={() => write(view, addRow(table, focus.row))}>
          {ICONS.rowAdd}
        </Control>
        <Control label={words.removeRow} onClick={() => write(view, removeRow(table, focus.row))}>
          {ICONS.rowRemove}
        </Control>
        <Control label={words.addColumn} onClick={() => write(view, addColumn(table, focus.column))}>
          {ICONS.columnAdd}
        </Control>
        <Control label={words.removeColumn} onClick={() => write(view, removeColumn(table, focus.column))}>
          {ICONS.columnRemove}
        </Control>
        <Control label={words.alignLeft} pressed={table.align[focus.column] === 'left'} onClick={() => align(table.align[focus.column] === 'left' ? null : 'left')}>
          {ICONS.alignLeft}
        </Control>
        <Control label={words.alignCenter} pressed={table.align[focus.column] === 'center'} onClick={() => align(table.align[focus.column] === 'center' ? null : 'center')}>
          {ICONS.alignCenter}
        </Control>
        <Control label={words.alignRight} pressed={table.align[focus.column] === 'right'} onClick={() => align(table.align[focus.column] === 'right' ? null : 'right')}>
          {ICONS.alignRight}
        </Control>
        <Control label={words.source} onClick={() => reveal(view, table.from)}>
          {ICONS.source}
        </Control>
      </div>
      <div className="markdown">
        <table ref={root}>
          <thead>
            <tr>{Array.from({ length: width }, (_, column) => cell(0, column))}</tr>
          </thead>
          {bodyRows.length > 0 && (
            <tbody>
              {bodyRows.map((_, index) => (
                <tr key={index}>{Array.from({ length: width }, (__, column) => cell(index + 2, column))}</tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

/** Shows a block as its text: the cursor goes into it, and the editor draws its source. */
export function reveal(view: EditorView, at: number): void {
  view.dispatch({ selection: { anchor: at }, scrollIntoView: true });
  view.focus();
}

// ── Frontmatter ──────────────────────────────────────────────────────────────

/** A text field that commits on blur and on Enter, and goes back to what was written on Escape. */
function Field({
  value,
  label,
  onCommit,
  className,
  placeholder,
  multiline = false,
  type = 'text',
  size,
}: {
  value: string;
  label: string;
  onCommit: (value: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  type?: 'text' | 'date';
  /** The width in characters, for a field that should be as wide as what it holds. */
  size?: number;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const common = {
    className: `edit-field ${className ?? ''}`.trim(),
    'aria-label': label,
    title: label,
    placeholder,
    value: draft,
    'data-ms-control': '',
    onBlur: () => draft !== value && onCommit(draft),
  };
  if (multiline) {
    return (
      <textarea
        {...common}
        rows={Math.min(6, Math.max(2, Math.ceil(draft.length / 60)))}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setDraft(value);
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            (event.target as HTMLTextAreaElement).blur();
          }
        }}
      />
    );
  }
  return (
    <input
      {...common}
      type={type}
      size={size}
      onChange={(event) => {
        setDraft(event.target.value);
        if (type === 'date' && event.target.value !== value && event.target.value !== '') onCommit(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setDraft(value);
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
      }}
    />
  );
}

/** A list value as chips, each removable, with a field that adds one on Enter. */
function ListField({ items, label, onCommit }: { items: readonly string[]; label: string; onCommit: (items: string[]) => void }) {
  const { strings } = useHost();
  const [draft, setDraft] = useState('');
  const add = () => {
    const item = draft.trim();
    if (item.length === 0) return;
    setDraft('');
    onCommit([...items, item]);
  };
  return (
    <span className="prop-tags edit-list">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="prop-tag">
          {item}
          <button
            type="button"
            className="edit-chip-remove"
            data-ms-control=""
            aria-label={`${strings.editor.removeItem} ${item}`}
            title={strings.editor.removeItem}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onCommit(items.filter((_, at) => at !== index))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="edit-field edit-list-add"
        aria-label={`${strings.editor.addItem}: ${label}`}
        placeholder={strings.editor.addItem}
        value={draft}
        data-ms-control=""
        onChange={(event) => setDraft(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            add();
          }
          if (event.key === 'Backspace' && draft === '' && items.length > 0) onCommit(items.slice(0, -1));
        }}
      />
    </span>
  );
}

/** The value of one entry, edited by the shape it was read in (§6.3). */
function ValueField({ view, front, entry, written }: { view: EditorView; front: Frontmatter; entry: { key: string; shape: string; values: readonly string[] }; written: string }) {
  const { strings } = useHost();
  const label = `${strings.editor.propertyValue}: ${entry.key}`;
  if (entry.shape === 'list') {
    return <ListField items={entry.values} label={entry.key} onCommit={(items) => write(view, setList(front, entry.key, items))} />;
  }
  if (entry.shape === 'boolean') {
    const value = entry.values[0] ?? 'false';
    // Chosen as reading draws it, Yes or No, and written in the words the author used: `true`/`false` or `yes`/`no`.
    const choose = (on: boolean) => {
      if (on === isTrue(value)) return;
      const yesNo = /^(yes|no)$/i.test(value);
      const word = yesNo ? (on ? 'yes' : 'no') : on ? 'true' : 'false';
      const cased = value === value.toUpperCase() ? word.toUpperCase() : value[0] === value[0]?.toUpperCase() ? word[0]!.toUpperCase() + word.slice(1) : word;
      write(view, setScalar(front, entry.key, cased));
    };
    return (
      <select
        className="edit-boolean"
        value={isTrue(value) ? 'yes' : 'no'}
        aria-label={label}
        title={label}
        data-ms-control=""
        onChange={(event) => choose(event.target.value === 'yes')}
      >
        <option value="yes">{strings.yes}</option>
        <option value="no">{strings.no}</option>
      </select>
    );
  }
  if (entry.shape === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(entry.values[0] ?? '')) {
    return <Field type="date" value={entry.values[0] ?? ''} label={label} onCommit={(value) => write(view, setScalar(front, entry.key, value))} />;
  }
  return (
    <Field
      value={entry.values[0] ?? written}
      label={label}
      multiline={entry.shape === 'prose'}
      onCommit={(value) => write(view, setScalar(front, entry.key, value))}
    />
  );
}

/**
 * The frontmatter as a form, drawn where the default theme draws the title and the properties:
 * the name as the title, then each entry with its key and its value by its shape. Each change
 * rewrites the lines of its entry only; a value the form cannot hold is edited as source.
 */
export function PropertiesBlock({ view, to }: { view: EditorView; to: number }) {
  const { strings } = useHost();
  const words = strings.editor;
  const source = view.state.doc.sliceString(0, view.state.doc.length, '\n');
  const front = readFrontmatter(source);
  const properties = readProperties(source.slice(0, to));
  const [adding, setAdding] = useState('');
  if (!front) return null;
  const nameEntry = front.entries.find((entry) => entry.key === 'name');
  const name = nameEntry ? source.slice(nameEntry.valueSpan.from, nameEntry.valueSpan.to).replace(/^(["'])([\s\S]*)\1$/, '$2') : '';
  const add = () => {
    const key = adding.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(key)) return;
    setAdding('');
    write(view, addEntry(front, key, ''));
  };
  return (
    <div className="edit-block edit-properties">
      <div className="edit-block-controls" data-ms-control="">
        <Control label={words.source} onClick={() => reveal(view, 4)}>
          {ICONS.source}
        </Control>
      </div>
      <Field
        className="note-title edit-title"
        value={name}
        label={words.title}
        placeholder={strings.unnamedNote}
        onCommit={(value) => write(view, value.trim() === '' && nameEntry ? removeEntry(front, 'name') : setScalar(front, 'name', value.trim()))}
      />
      <div className="properties-box">
        <div className="metadata-container">
          {front.entries
            .filter((entry) => entry.key !== 'name')
            .map((entry) => {
              const read = properties.entries.find((each) => each.key === entry.key) ?? { key: entry.key, shape: 'empty', values: [] };
              const type = read.shape === 'list' ? 'list' : read.shape === 'date' ? 'date' : read.shape === 'boolean' ? 'checkbox' : 'text';
              return (
                <div key={entry.key} className="metadata-property edit-property" data-property-type={type}>
                  <span className="metadata-property-key">
                    <Field
                      value={entry.key}
                      label={`${words.propertyKey}: ${entry.key}`}
                      className="edit-key"
                      size={Math.max(4, entry.key.length + 1)}
                      onCommit={(next) => write(view, renameKey(front, entry.key, next.trim()))}
                    />
                  </span>
                  <span className="metadata-property-value">
                    <ValueField view={view} front={front} entry={read} written={source.slice(entry.valueSpan.from, entry.valueSpan.to)} />
                    <Control label={`${words.removeProperty}: ${entry.key}`} onClick={() => write(view, removeEntry(front, entry.key))}>
                      {ICONS.remove}
                    </Control>
                  </span>
                </div>
              );
            })}
          <div className="metadata-property edit-property edit-property-new">
            <span className="metadata-property-key">
              <input
                className="edit-field edit-key"
                size={Math.max(words.addProperty.length, adding.length + 1)}
                aria-label={words.addProperty}
                placeholder={words.addProperty}
                value={adding}
                data-ms-control=""
                onChange={(event) => setAdding(event.target.value.replace(/[^A-Za-z0-9_-]/g, ''))}
                onKeyDown={(event) => event.key === 'Enter' && add()}
              />
            </span>
            <span className="metadata-property-value">
              <Control label={words.addProperty} onClick={add}>
                {ICONS.add}
              </Control>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The control a note with no frontmatter shows above its body, which gives it one. */
export function AddProperties({ view }: { view: EditorView }) {
  const { strings } = useHost();
  return (
    <div className="edit-add-properties">
      <button
        type="button"
        className="edit-control edit-control-labelled"
        data-ms-control=""
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => write(view, [{ from: 0, to: 0, insert: '---\n---\n' }])}
      >
        {ICONS.add}
        <span>{strings.editor.addProperties}</span>
      </button>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

/** Lucide's outlines (ISC), drawn in the current colour at the size of the text. */
function icon(...paths: string[]): ReactNode {
  return (
    <svg className="edit-icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export const ICONS = {
  add: icon('M5 12h14', 'M12 5v14'),
  remove: icon('M18 6 6 18', 'm6 6 12 12'),
  source: icon('m16 18 6-6-6-6', 'm8 6-6 6 6 6'),
  rowAdd: icon('M3 12h18', 'M3 6h18', 'M12 15v6', 'M9 18h6'),
  rowRemove: icon('M3 12h18', 'M3 6h18', 'M9 18h6'),
  columnAdd: icon('M12 3v18', 'M6 3v18', 'M15 12h6', 'M18 9v6'),
  columnRemove: icon('M12 3v18', 'M6 3v18', 'M15 12h6'),
  alignLeft: icon('M21 6H3', 'M15 12H3', 'M17 18H3'),
  alignCenter: icon('M21 6H3', 'M17 12H7', 'M19 18H5'),
  alignRight: icon('M21 6H3', 'M21 12H9', 'M21 18H7'),
  undo: icon('M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11'),
  redo: icon('m15 14 5-5-5-5', 'M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13'),
  bold: icon('M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8'),
  italic: icon('M19 4h-9', 'M14 20H5', 'M15 4 9 20'),
  strikethrough: icon('M16 4H9a3 3 0 0 0-2.83 4', 'M14 12a4 4 0 0 1 0 8H6', 'M4 12h16'),
  highlight: icon('m9 11-6 6v3h9l3-3', 'm22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4'),
  code: icon('m18 16 4-4-4-4', 'm6 8-4 4 4 4', 'm14.5 4-5 16'),
  link: icon('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'),
  wikilink: icon('M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'),
  bulletList: icon('M3 12h.01', 'M3 18h.01', 'M3 6h.01', 'M8 12h13', 'M8 18h13', 'M8 6h13'),
  orderedList: icon('M10 12h11', 'M10 18h11', 'M10 6h11', 'M4 10h2', 'M4 6h1v4', 'M6 18H4c0-1 2-2 2-3s-1-1.5-2-1'),
  taskList: icon('m3 17 2 2 4-4', 'm3 7 2 2 4-4', 'M13 6h8', 'M13 12h8', 'M13 18h8'),
  quote: icon('M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z', 'M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z'),
  callout: icon('M12 16v-4', 'M12 8h.01', 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),
  table: icon('M12 3v18', 'M3 9h18', 'M3 15h18', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'),
  codeBlock: icon('M10 9.5 8 12l2 2.5', 'm14 9.5 2 2.5-2 2.5', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'),
  math: icon('M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2'),
  diagram: icon('M5 3h4v4H5z', 'M15 17h4v4h-4z', 'M7 7v4a2 2 0 0 0 2 2h6a2 2 0 0 1 2 2v2'),
  rule: icon('M5 12h14'),
  footnote: icon('M4 7V4h16v3', 'M9 20h6', 'M12 4v16', 'M19 13v6', 'M17 15l2-2'),
  comment: icon('M7.9 20A9 9 0 1 0 4 16.1L2 22Z'),
  markdown: icon('M10 12.5 8 15l2 2.5', 'm14 12.5 2 2.5-2 2.5', 'M14 2v4a2 2 0 0 0 2 2h4', 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z'),
  close: icon('M18 6 6 18', 'm6 6 12 12'),
  revert: icon('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'),
  saving: icon('M21 12a9 9 0 1 1-6.219-8.56'),
  saved: icon('M20 6 9 17l-5-5'),
  notSaved: icon('M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z', 'M12 8v4', 'M12 16h.01'),
  edit: icon('M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z', 'm15 5 4 4'),
  view: icon('M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'),
} as const;
