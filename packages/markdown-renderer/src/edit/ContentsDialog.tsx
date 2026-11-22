/**
 * The form of a `contents` block (`SPEC.md` §7.17, #173, #175): which lists it draws — the headings,
 * the figures, the tables, the attachments — and the title of each, the levels of the headings,
 * where it is drawn, and what the screen and print draw: the root's, nothing, or their own lists,
 * levels and place. A field left at the notebook's writes nothing, so the host's settings stay the
 * defaults. It inserts a block at the cursor, or changes the block the cursor is in; the editor
 * writes the bytes.
 */

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useHost } from '../host.js';
import { CONTENTS_LISTS, CONTENTS_MEDIA, type ContentsLayer, type ContentsList, type ContentsMedium, type ContentsPlace, type ContentsSettings } from '../contents.js';
import { ICONS } from './blocks.js';

/** What the form holds for a layer: the lists it draws and their titles, the levels, and the place. */
interface LayerFields {
  lists: Record<ContentsList, boolean>;
  titles: Record<ContentsList, string>;
  depth: string;
  place: '' | ContentsPlace;
}

type MediumMode = 'same' | 'none' | 'own';

interface Fields {
  root: LayerFields;
  media: Record<ContentsMedium, { mode: MediumMode; layer: LayerFields }>;
}

const each = <T,>(value: (kind: ContentsList) => T): Record<ContentsList, T> =>
  Object.fromEntries(CONTENTS_LISTS.map((kind) => [kind, value(kind)])) as Record<ContentsList, T>;

function fieldsOf(layer: ContentsLayer | undefined, root: boolean): LayerFields {
  const named = CONTENTS_LISTS.filter((kind) => layer && kind in layer);
  return {
    // A layer that names no list draws the headings at the root, and the root's lists in a medium.
    lists: each((kind) => (named.length > 0 ? named.includes(kind) : root && kind === 'headings')),
    titles: each((kind) => layer?.[kind]?.title ?? ''),
    depth: layer?.headings?.depth === undefined ? '' : String(layer.headings.depth),
    place: layer?.place ?? '',
  };
}

/** The form's fields, from what a block sets. */
export function contentsFields(settings: ContentsSettings): Fields {
  const medium = (name: ContentsMedium) => {
    const layer = settings[name];
    if (layer === 'none') return { mode: 'none' as const, layer: fieldsOf(undefined, false) };
    if (layer === undefined) return { mode: 'same' as const, layer: fieldsOf(undefined, false) };
    return { mode: 'own' as const, layer: fieldsOf(layer, false) };
  };
  return { root: fieldsOf(settings, true), media: { screen: medium('screen'), print: medium('print') } };
}

function layerOf(fields: LayerFields, root: boolean): ContentsLayer {
  const chosen = CONTENTS_LISTS.filter((kind) => fields.lists[kind]);
  // The headings alone, with nothing of their own, are what a root writes nothing for.
  const classic = root && chosen.length === 1 && chosen[0] === 'headings';
  const layer: Record<string, unknown> = {};
  for (const kind of chosen) {
    const options: { title?: string; depth?: number } = {};
    if (fields.titles[kind].trim()) options.title = fields.titles[kind].trim();
    if (kind === 'headings' && fields.depth) options.depth = Number(fields.depth);
    if (!classic || Object.keys(options).length > 0) layer[kind] = options;
  }
  if (fields.place) layer['place'] = fields.place;
  return layer as ContentsLayer;
}

/** The settings the form's fields write. */
export function contentsSettings(fields: Fields): ContentsSettings {
  const settings: Record<string, unknown> = { ...layerOf(fields.root, true) };
  for (const medium of CONTENTS_MEDIA) {
    const { mode, layer } = fields.media[medium];
    if (mode === 'none') settings[medium] = 'none';
    else if (mode === 'own') {
      // The lists the root draws are not written again: the medium names them only to differ.
      const same = CONTENTS_LISTS.every((kind) => layer.lists[kind] === fields.root.lists[kind]);
      const own: Record<string, unknown> = { ...layerOf(layer, false) };
      // Naming one list in a medium replaces the root's, so they are all named or none is.
      const options = CONTENTS_LISTS.some((kind) => own[kind] && Object.keys(own[kind] as object).length > 0);
      if (same && !options) for (const kind of CONTENTS_LISTS) delete own[kind];
      if (Object.keys(own).length > 0) settings[medium] = own;
    }
  }
  return settings as ContentsSettings;
}

export function ContentsDialog({
  initial,
  editing,
  onApply,
  onClose,
  onClosed,
}: {
  /** What the block sets now, or nothing for a new one. */
  initial: ContentsSettings;
  /** Whether it changes the block the cursor is in, rather than inserting one. */
  editing: boolean;
  onApply: (settings: ContentsSettings) => void;
  onClose: () => void;
  /** Once the dialog is closed: whether the note was changed, which then has the focus. */
  onClosed: (applied: boolean) => void;
}) {
  const host = useHost();
  const words = host.strings.editor;
  const [fields, setFields] = useState<Fields>(() => contentsFields(initial));
  const dialog = useRef<HTMLDialogElement>(null);
  const applied = useRef(false);
  const closed = useRef(onClosed);
  closed.current = onClosed;
  const id = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    element.querySelector<HTMLElement>('input, select')?.focus();
    return () => {
      if (element.open && typeof element.close === 'function') element.close();
      closed.current(applied.current);
    };
  }, []);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    applied.current = true;
    onClose();
    onApply(contentsSettings(fields));
  };

  const names: Record<ContentsList, string> = {
    headings: host.strings.contentsHeadings,
    figures: host.strings.contentsFigures,
    tables: host.strings.contentsTables,
    attachments: host.strings.contentsAttachments,
  };
  const layerFields = (layer: LayerFields, set: (next: LayerFields) => void, root: boolean): ReactNode => (
    <>
      {CONTENTS_LISTS.map((kind) => (
        <div key={kind} className="edit-contents-list" data-list={kind}>
          <label className="edit-contents-check">
            <input type="checkbox" name={`list-${kind}`} checked={layer.lists[kind]} onChange={(event) => set({ ...layer, lists: { ...layer.lists, [kind]: event.target.checked } })} />
            <span>{names[kind]}</span>
          </label>
          {root && layer.lists[kind] && (
            <label>
              <span>{words.contentsTitle}</span>
              <input
                className="edit-attach-input"
                name={kind === 'headings' ? 'title' : `title-${kind}`}
                value={layer.titles[kind]}
                placeholder={host.contents?.[kind]?.title ?? names[kind]}
                onChange={(event) => set({ ...layer, titles: { ...layer.titles, [kind]: event.target.value } })}
              />
            </label>
          )}
        </div>
      ))}
      {layer.lists.headings && (
        <label>
          <span>{words.contentsDepth}</span>
          <select className="edit-attach-input" name="depth" value={layer.depth} onChange={(event) => set({ ...layer, depth: event.target.value })}>
            <option value="">{words.contentsNotebook}</option>
            {[1, 2, 3, 4, 5, 6].map((depth) => (
              <option key={depth} value={String(depth)}>
                {depth}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        <span>{words.contentsPlace}</span>
        <select className="edit-attach-input" name="place" value={layer.place} onChange={(event) => set({ ...layer, place: event.target.value as LayerFields['place'] })}>
          <option value="">{root ? words.contentsHere : words.contentsSame}</option>
          <option value="start">{words.contentsStart}</option>
          <option value="end">{words.contentsEnd}</option>
        </select>
      </label>
    </>
  );

  return (
    <dialog
      ref={dialog}
      className="edit-source edit-attach edit-style edit-contents"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => event.target === dialog.current && onClose()}
    >
      <div className="edit-source-frame">
        <header className="edit-source-header">
          <h2 id={`${id}-title`} className="edit-source-title">
            {words.contents}
          </h2>
          <button type="button" className="edit-control edit-source-close" aria-label={host.strings.close} title={host.strings.close} onClick={onClose}>
            {ICONS.remove}
          </button>
        </header>
        <div className="edit-attach-panel">
          <form className="edit-attach-form" onSubmit={submit} noValidate>
            {layerFields(fields.root, (root) => setFields((current) => ({ ...current, root })), true)}
            {CONTENTS_MEDIA.map((medium) => {
              const { mode, layer } = fields.media[medium];
              const setMedium = (next: { mode: MediumMode; layer: LayerFields }) =>
                setFields((current) => ({ ...current, media: { ...current.media, [medium]: next } }));
              return (
                <fieldset key={medium} className="edit-contents-medium" data-medium={medium}>
                  <label>
                    <span>{medium === 'screen' ? words.contentsScreen : words.contentsPrint}</span>
                    <select
                      className="edit-attach-input"
                      name={medium}
                      value={mode}
                      onChange={(event) => {
                        const next = event.target.value as MediumMode;
                        // A medium of its own starts from the lists the root draws.
                        setMedium({ mode: next, layer: next === 'own' && mode !== 'own' ? { ...layer, lists: { ...fields.root.lists } } : layer });
                      }}
                    >
                      <option value="same">{words.contentsSame}</option>
                      <option value="none">{words.contentsNone}</option>
                      <option value="own">{words.contentsOwn}</option>
                    </select>
                  </label>
                  {mode === 'own' && layerFields(layer, (next) => setMedium({ mode, layer: next }), false)}
                </fieldset>
              );
            })}
            <div className="edit-attach-actions">
              <button type="submit" className="edit-attach-button edit-attach-primary">
                {editing ? words.contentsApply : words.contentsInsert}
              </button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  );
}
