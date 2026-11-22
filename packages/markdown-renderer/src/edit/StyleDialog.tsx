/**
 * The form of a `:::{style}` block (`SPEC.md` §7.16, #166): the face and the alignment of headings,
 * text and tables, each starting at the notebook's, which writes no key. It wraps the passage in a
 * new block, or changes the options of the block the cursor is in; the editor writes the bytes.
 */

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useHost } from '../host.js';
import { STYLE_ALIGNMENTS, STYLE_FONTS, STYLE_KEYS, STYLE_NUMBERINGS, type NoteStyle, type StyleKey } from '../note-style.js';
import { ICONS } from './blocks.js';

export function StyleDialog({
  initial,
  editing,
  onApply,
  onClose,
  onClosed,
}: {
  /** What the block sets now, or nothing for a new one. */
  initial: NoteStyle;
  /** Whether it changes a block the cursor is in, rather than wrapping a passage in a new one. */
  editing: boolean;
  onApply: (style: NoteStyle) => void;
  onClose: () => void;
  /** Once the dialog is closed: whether the note was changed, which then has the focus. */
  onClosed: (applied: boolean) => void;
}) {
  const host = useHost();
  const words = host.strings.editor;
  const [style, setStyle] = useState<NoteStyle>(initial);
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
    element.querySelector<HTMLElement>('select')?.focus();
    return () => {
      if (element.open && typeof element.close === 'function') element.close();
      closed.current(applied.current);
    };
  }, []);

  const label: Record<StyleKey, string> = { font: words.styleFont, headings: words.styleHeadings, text: words.styleText, tables: words.styleTables, numbering: words.styleNumbering };
  const value: Record<string, string> = {
    none: words.styleNumberingNone,
    decimal: words.styleNumberingDecimal,
    sans: words.styleSans,
    serif: words.styleSerif,
    left: words.styleLeft,
    center: words.styleCenter,
    right: words.styleRight,
    justify: words.styleJustify,
  };
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    applied.current = true;
    onClose();
    onApply(style);
  };

  return (
    <dialog
      ref={dialog}
      className="edit-source edit-attach edit-style"
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
            {words.style}
          </h2>
          <button type="button" className="edit-control edit-source-close" aria-label={host.strings.close} title={host.strings.close} onClick={onClose}>
            {ICONS.remove}
          </button>
        </header>
        <div className="edit-attach-panel">
        <form className="edit-attach-form" onSubmit={submit} noValidate>
          {STYLE_KEYS.map((key) => (
            <label key={key}>
              <span>{label[key]}</span>
              <select
                className="edit-attach-input"
                name={key}
                value={style[key] ?? ''}
                onChange={(event) => {
                  const chosen = event.target.value;
                  setStyle((current) => {
                    const next: Record<string, string> = { ...current };
                    if (chosen) next[key] = chosen;
                    else delete next[key];
                    return next as NoteStyle;
                  });
                }}
              >
                <option value="">{words.styleNotebook}</option>
                {(key === 'font' ? STYLE_FONTS : key === 'numbering' ? STYLE_NUMBERINGS : STYLE_ALIGNMENTS).map((each) => (
                  <option key={each} value={each}>
                    {value[each]}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="edit-attach-actions">
            <button type="submit" className="edit-attach-button edit-attach-primary">
              {editing ? words.styleApply : words.styleInsert}
            </button>
          </div>
        </form>
        </div>
      </div>
    </dialog>
  );
}
