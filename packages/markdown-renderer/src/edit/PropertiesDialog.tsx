/**
 * The form of a `properties` block (`SPEC.md` §7.18, #172): which of the note's keys it draws and in
 * which order, its title, whether it starts folded, where it is drawn, and what the screen and print
 * draw — the same, nothing, or their own. A field left at the notebook's writes nothing. It inserts a
 * block at the cursor, or changes the block the cursor is in; the editor writes the bytes.
 */

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useHost } from '../host.js';
import { CONTENTS_MEDIA, type ContentsMedium, type ContentsPlace } from '../contents.js';
import type { PropertiesLayer, PropertiesSettings } from '../properties-block.js';
import { ICONS } from './blocks.js';

interface LayerFields {
  /** Every key on offer, in the order the block draws them, each chosen or not. */
  keys: { key: string; chosen: boolean }[];
  /** Whether the block names its keys at all, rather than drawing every one. */
  some: boolean;
  title: string;
  fold: '' | 'open' | 'closed';
  place: '' | ContentsPlace;
}

type MediumMode = 'same' | 'none' | 'own';

interface Fields {
  root: LayerFields;
  media: Record<ContentsMedium, { mode: MediumMode; layer: LayerFields }>;
}

function fieldsOf(layer: PropertiesLayer | undefined, noteKeys: readonly string[]): LayerFields {
  const named = layer?.keys ?? [];
  const rest = noteKeys.filter((key) => !named.includes(key));
  return {
    keys: [...named.map((key) => ({ key, chosen: true })), ...rest.map((key) => ({ key, chosen: false }))],
    some: named.length > 0,
    title: layer?.title ?? '',
    fold: layer?.fold ?? '',
    place: layer?.place ?? '',
  };
}

/** The form's fields, from what a block sets and the keys the note has. */
export function propertiesFields(settings: PropertiesSettings, noteKeys: readonly string[]): Fields {
  const medium = (name: ContentsMedium) => {
    const layer = settings[name];
    if (layer === 'none') return { mode: 'none' as const, layer: fieldsOf(undefined, noteKeys) };
    if (layer === undefined) return { mode: 'same' as const, layer: fieldsOf(undefined, noteKeys) };
    return { mode: 'own' as const, layer: fieldsOf(layer, noteKeys) };
  };
  return { root: fieldsOf(settings, noteKeys), media: { screen: medium('screen'), print: medium('print') } };
}

function layerOf(fields: LayerFields): PropertiesLayer {
  const keys = fields.some ? fields.keys.filter((each) => each.chosen).map((each) => each.key) : [];
  return {
    ...(keys.length > 0 ? { keys } : {}),
    ...(fields.title.trim() ? { title: fields.title.trim() } : {}),
    ...(fields.fold ? { fold: fields.fold } : {}),
    ...(fields.place ? { place: fields.place } : {}),
  };
}

/** The settings the form's fields write. */
export function propertiesSettings(fields: Fields): PropertiesSettings {
  const settings: Record<string, unknown> = { ...layerOf(fields.root) };
  for (const medium of CONTENTS_MEDIA) {
    const { mode, layer } = fields.media[medium];
    if (mode === 'none') settings[medium] = 'none';
    else if (mode === 'own') {
      const own = layerOf(layer);
      if (Object.keys(own).length > 0) settings[medium] = own;
    }
  }
  return settings as PropertiesSettings;
}

export function PropertiesDialog({
  initial,
  noteKeys,
  editing,
  onApply,
  onClose,
  onClosed,
}: {
  initial: PropertiesSettings;
  /** The keys of the note's frontmatter, in the order written. */
  noteKeys: readonly string[];
  editing: boolean;
  onApply: (settings: PropertiesSettings) => void;
  onClose: () => void;
  onClosed: (applied: boolean) => void;
}) {
  const host = useHost();
  const words = host.strings.editor;
  const [fields, setFields] = useState<Fields>(() => propertiesFields(initial, noteKeys));
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
    onApply(propertiesSettings(fields));
  };

  const layerFields = (layer: LayerFields, set: (next: LayerFields) => void, root: boolean): ReactNode => (
    <>
      <fieldset className="edit-properties-keys">
        <label className="edit-contents-check">
          <input type="checkbox" name="all-keys" checked={!layer.some} onChange={(event) => set({ ...layer, some: !event.target.checked })} />
          <span>{words.propertiesAllKeys}</span>
        </label>
        {layer.some &&
          layer.keys.map((each, index) => (
            <div key={each.key} className="edit-properties-key">
              <label className="edit-contents-check">
                <input
                  type="checkbox"
                  name={`key-${each.key}`}
                  checked={each.chosen}
                  onChange={(event) => set({ ...layer, keys: layer.keys.map((other) => (other.key === each.key ? { ...other, chosen: event.target.checked } : other)) })}
                />
                <span>{each.key}</span>
              </label>
              {index > 0 && (
                <button
                  type="button"
                  className="edit-control"
                  aria-label={words.propertiesMoveUp(each.key)}
                  title={words.propertiesMoveUp(each.key)}
                  onClick={() => {
                    const keys = [...layer.keys];
                    [keys[index - 1], keys[index]] = [keys[index]!, keys[index - 1]!];
                    set({ ...layer, keys });
                  }}
                >
                  ↑
                </button>
              )}
            </div>
          ))}
      </fieldset>
      <label>
        <span>{words.contentsTitle}</span>
        <input className="edit-attach-input" name="title" value={layer.title} placeholder={host.properties?.title ?? host.strings.properties} onChange={(event) => set({ ...layer, title: event.target.value })} />
      </label>
      <label>
        <span>{words.propertiesFold}</span>
        <select className="edit-attach-input" name="fold" value={layer.fold} onChange={(event) => set({ ...layer, fold: event.target.value as LayerFields['fold'] })}>
          <option value="">{words.contentsNotebook}</option>
          <option value="open">{words.propertiesOpen}</option>
          <option value="closed">{words.propertiesClosed}</option>
        </select>
      </label>
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
      className="edit-source edit-attach edit-style edit-contents edit-properties"
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
            {words.propertiesBlock}
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
