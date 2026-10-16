/**
 * What stands beside the switch between reading and editing, in both modes (#76): a button that
 * shows the note's Markdown in a dialog (#63), and one that copies it. Apart from the editor, so a
 * note that is only read offers them without loading it.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useHost } from './host.js';
import { ICON_CHECK, ICON_CLOSE, ICON_COPY, ICON_MARKDOWN } from './mode-icons.js';

/**
 * How the buttons a note draws around its text show their word (#96): `icon`, the icon alone;
 * `label`, the icon and the word; `responsive`, the word beside the icon on a note at least
 * `--markdown-button-words-from` wide and hidden on a narrower one. Wherever the word may be
 * hidden it is the button's name.
 */
export type NoteButtons = 'icon' | 'label' | 'responsive';

/** A button's icon and, unless it is drawn alone, its word, which the stylesheet may hide. */
export function ButtonFace({ icon, word, display, wordClass }: { icon: ReactNode; word: string; display: NoteButtons; wordClass?: string }) {
  return (
    <>
      {icon}
      {display !== 'icon' && <span className={wordClass ? `note-button-word ${wordClass}` : 'note-button-word'}>{word}</span>}
    </>
  );
}

/** Puts the text on the clipboard; answers whether it got there. */
function copyText(text: string): Promise<boolean> {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  if (!clipboard) return Promise.resolve(false);
  return clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}

/**
 * The note's Markdown, read-only, exactly as the host has it or would receive it: a modal dialog,
 * closed by Escape, its button or a click outside it, the focus then back on the button that
 * opened it.
 */
function SourceDialog({ text, display, onClose, onClosed }: { text: string; display: NoteButtons; onClose: () => void; onClosed: () => void }) {
  const host = useHost();
  const words = host.strings.editor;
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null);
  const closed = useRef(onClosed);
  closed.current = onClosed;
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    element.querySelector<HTMLElement>('.edit-source-close')?.focus();
    return () => {
      if (element.open && typeof element.close === 'function') element.close();
      // Only once the dialog is closed may the page behind it take the focus.
      closed.current();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`edit-source${display === 'responsive' ? ' has-responsive-buttons' : ''}`}
      aria-modal="true"
      aria-labelledby="edit-source-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // The dialog has no padding of its own, so a click on it and not on its content is outside.
      onClick={(event) => event.target === dialog.current && onClose()}
    >
      <div className="edit-source-frame">
        <header className="edit-source-header">
          <h2 id="edit-source-title" className="edit-source-title">
            {words.sourceTitle}
          </h2>
          <span className="edit-source-copied" role="status">
            {copied === 'copied' ? words.copied : copied === 'failed' ? words.copyFailed : ''}
          </span>
          <button
            type="button"
            className={`edit-control edit-source-copy${display === 'label' ? ' edit-control-labelled' : ''}`}
            data-buttons={display}
            title={words.copy}
            aria-label={display === 'label' ? undefined : words.copy}
            onClick={() => void copyText(text).then((done) => setCopied(done ? 'copied' : 'failed'))}
          >
            <ButtonFace icon={copied === 'copied' ? ICON_CHECK : ICON_COPY} word={words.copy} display={display} />
          </button>
          <button type="button" className="edit-control edit-source-close" aria-label={host.strings.close} title={host.strings.close} onClick={onClose}>
            {ICON_CLOSE}
          </button>
        </header>
        <pre className="edit-source-text" tabIndex={0}>
          {text}
        </pre>
      </div>
    </dialog>
  );
}

/** How long Copy Markdown shows its check, in milliseconds. */
const COPIED_MS = 1600;

/**
 * Show Markdown and Copy Markdown; `text` answers the bytes when a button is used, and `display`
 * how they and the dialog's Copy show their word.
 */
export function NoteActions({ text, display = 'icon' }: { text: () => string; display?: NoteButtons }) {
  const words = useHost().strings.editor;
  const show = useRef<HTMLButtonElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  const copyLabel = copied === 'copied' ? words.copied : copied === 'failed' ? words.copyFailed : words.copyMarkdown;
  return (
    <>
      <button
        ref={show}
        type="button"
        className={`note-action note-action-${display}`}
        data-buttons={display}
        title={words.showMarkdown}
        aria-label={display === 'label' ? undefined : words.showMarkdown}
        aria-haspopup="dialog"
        onClick={() => setSource(text())}
      >
        <ButtonFace icon={ICON_MARKDOWN} word={words.showMarkdown} display={display} />
      </button>
      <button
        type="button"
        className={`note-action note-action-${display}`}
        data-buttons={display}
        data-copied={copied ?? undefined}
        title={copyLabel}
        aria-label={words.copyMarkdown}
        onClick={() => void copyText(text()).then((done) => setCopied(done ? 'copied' : 'failed'))}
      >
        <ButtonFace icon={copied === 'copied' ? ICON_CHECK : ICON_COPY} word={words.copyMarkdown} display={display} />
      </button>
      <span className="visually-hidden" role="status">
        {copied === 'copied' ? words.copied : copied === 'failed' ? words.copyFailed : ''}
      </span>
      {source !== null && <SourceDialog text={source} display={display} onClose={() => setSource(null)} onClosed={() => show.current?.focus()} />}
    </>
  );
}
