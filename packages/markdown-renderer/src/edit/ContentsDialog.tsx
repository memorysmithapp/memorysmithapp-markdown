/**
 * The form of a `contents` block (`SPEC.md` §7.17, #173): the title and the levels of its headings,
 * where it is drawn, and what the screen and print draw — the root's, nothing, or their own levels
 * and place. A field left at the notebook's writes nothing, so the host's settings stay the
 * defaults. It inserts a block at the cursor, or changes the block the cursor is in; the editor
 * writes the bytes.
 */

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useHost } from '../host.js';
import { CONTENTS_MEDIA, type ContentsLayer, type ContentsMedium, type ContentsPlace, type ContentsSettings } from '../contents.js';
import { ICONS } from './blocks.js';

/** What the form holds for a layer: the title and levels of the headings, and the place. */
interface LayerFields {
  title: string;
  depth: string;
  place: '' | ContentsPlace;
}

type MediumMode = 'same' | 'none' | 'own';

interface Fields {
  root: LayerFields;
  media: Record<ContentsMedium, { mode: MediumMode; layer: LayerFields }>;
}

function fieldsOf(layer: ContentsLayer | undefined): LayerFields {
  return { title: layer?.headings?.title ?? '', depth: layer?.headings?.depth === undefined ? '' : String(layer.headings.depth), place: layer?.place ?? '' };
}

/** The form's fields, from what a block sets. */
export function contentsFields(settings: ContentsSettings): Fields {
  const medium = (name: ContentsMedium) => {
    const layer = settings[name];
    if (layer === 'none') return { mode: 'none' as const, layer: fieldsOf(undefined) };
    if (layer === undefined) return { mode: 'same' as const, layer: fieldsOf(undefined) };
    return { mode: 'own' as const, layer: fieldsOf(layer) };
  };
  return { root: fieldsOf(settings), media: { screen: medium('screen'), print: medium('print') } };
}

function layerOf(fields: LayerFields): ContentsLayer {
  const headings: { title?: string; depth?: number } = {};
  if (fields.title.trim()) headings.title = fields.title.trim();
  if (fields.depth) headings.depth = Number(fields.depth);
  return { ...(Object.keys(headings).length > 0 ? { headings } : {}), ...(fields.place ? { place: fields.place } : {}) };
}

/** The settings the form's fields write. */
export function contentsSettings(fields: Fields): ContentsSettings {
  const settings: Record<string, unknown> = { ...layerOf(fields.root) };
  for (const medium of CONTENTS_MEDIA) {
    const { mode, layer } = fields.media[medium];
    if (mode === 'none') settings[medium] = 'none';
    else if (mode === 'own') {
      const own = layerOf(layer);
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

  const layerFields = (layer: LayerFields, set: (next: LayerFields) => void, withTitle: boolean): ReactNode => (
    <>
      {withTitle && (
        <label>
          <span>{words.contentsTitle}</span>
          <input
            className="edit-attach-input"
            name="title"
            value={layer.title}
            placeholder={host.contents?.headings?.title ?? host.strings.contentsHeadings}
            onChange={(event) => set({ ...layer, title: event.target.value })}
          />
        </label>
      )}
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
      <label>
        <span>{words.contentsPlace}</span>
        <select className="edit-attach-input" name="place" value={layer.place} onChange={(event) => set({ ...layer, place: event.target.value as LayerFields['place'] })}>
          <option value="">{withTitle ? words.contentsHere : words.contentsSame}</option>
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
                    <select className="edit-attach-input" name={medium} value={mode} onChange={(event) => setMedium({ mode: event.target.value as MediumMode, layer })}>
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
