/**
 * What the host said of a save, and the author's choices (#86): a modal dialog with the host's
 * title, its explanation and one button per action. It never closes by itself, since its job is to
 * have the author decide; Escape or its × close it and leave the save where it stood, and running
 * an action closes it before the action runs.
 */

import { useEffect, useId, useRef } from 'react';
import { useHost } from '../host.js';
import { ICON_CLOSE } from '../mode-icons.js';
import type { SaveAction, SaveNotice } from './saves.js';

export function SaveNoticeDialog({
  notice,
  onClose,
  onClosed,
  onAction,
}: {
  notice: SaveNotice;
  /** Escape or the ×: the author did not choose. */
  onClose: () => void;
  /** Once the dialog is closed, whether an action was chosen, so the focus goes where it belongs. */
  onClosed: (chosen: boolean) => void;
  onAction: (action: SaveAction) => void;
}) {
  const host = useHost();
  const dialog = useRef<HTMLDialogElement>(null);
  const chosen = useRef(false);
  const closed = useRef(onClosed);
  closed.current = onClosed;
  const id = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    element.querySelector<HTMLElement>('.edit-notice-action')?.focus();
    return () => {
      if (element.open && typeof element.close === 'function') element.close();
      // Only once the dialog is closed may the page behind it take the focus.
      closed.current(chosen.current);
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="edit-source edit-notice"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-message`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="edit-source-frame">
        <header className="edit-source-header">
          <h2 id={`${id}-title`} className="edit-source-title">
            {notice.title}
          </h2>
          <button type="button" className="edit-control edit-source-close" aria-label={host.strings.close} title={host.strings.close} onClick={onClose}>
            {ICON_CLOSE}
          </button>
        </header>
        <p id={`${id}-message`} className="edit-notice-message">
          {notice.message}
        </p>
        <div className="edit-notice-actions">
          {notice.actions.map((action, index) => (
            <button
              key={index}
              type="button"
              className="edit-attach-button edit-notice-action"
              onClick={() => {
                chosen.current = true;
                onAction(action);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
