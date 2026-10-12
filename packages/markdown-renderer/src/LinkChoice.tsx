import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useHost, type LinkChoiceNote, type LinkChoices } from './host.js';

/**
 * The address a wikilink carries when no single note answers it and the host
 * can say which notes might: `choice:` and the encoded name. It never leaves
 * the page — the anchor of the surface turns it into a `LinkChoice` — and it
 * exists so the decision is made once, where the wikilink is resolved.
 */
export const CHOICE_SCHEME = 'choice:';

/** The name a choice address carries, or `null`. */
export function choiceTargetOf(href: string): string | null {
  if (!href.startsWith(CHOICE_SCHEME)) return null;
  try {
    return decodeURIComponent(href.slice(CHOICE_SCHEME.length)).normalize('NFC');
  } catch {
    return null;
  }
}

/**
 * How long a click may resolve before the dialog opens on placeholder rows.
 * Under it the dialog opens once, with its content; over it the click would
 * otherwise look ignored.
 */
const PATIENCE_MS = 150;

/**
 * How long a description may be on a row of a choice. It is a folder
 * description, written to be read whole somewhere else; here it is a hint
 * under a path, and three rows of prose would bury the paths they were
 * supposed to tell apart. Cut on a word, never mid-word, and say that it was
 * cut.
 */
const DESCRIPTION_LIMIT = 120;

export function shortened(description: string, limit = DESCRIPTION_LIMIT): string {
  const text = description.trim().replace(/\s+/g, ' ');
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

type Answer = { state: 'loading' } | { state: 'error' } | { state: 'ready'; choices: LinkChoices };

/**
 * A wikilink that no single note answers by name, and the choice it opens.
 *
 * Two cases reach here. A name several notes carry is a choice, told apart by
 * the folder each note lives in. A name no note carries is drawn as pending and
 * still asks, because an alias may answer it with one note, which opens, or
 * with several, which is the choice. The host answers both, through `choose`.
 *
 * **The choice is a DIALOG over the page, and it has to be.** A menu
 * positioned inside whatever held the link was clipped by the scroll box of a
 * table, which every table of a note has. `showModal()` puts the dialog in the
 * top layer, which no ancestor can clip, and brings the focus handling with it.
 */
export function LinkChoice({ target, children }: { target: string; children: ReactNode }) {
  const host = useHost();
  const { strings } = host;
  const [asked, setAsked] = useState(false);
  const [answer, setAnswer] = useState<Answer>({ state: 'loading' });
  const [patient, setPatient] = useState(false);
  const anchor = useRef<HTMLAnchorElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!asked || !host.choose) return;
    let alive = true;
    setAnswer({ state: 'loading' });
    host.choose(target).then(
      (choices) => alive && setAnswer({ state: 'ready', choices }),
      () => alive && setAnswer({ state: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, [asked, host, target]);

  const resolving = asked && answer.state === 'loading';

  // No dialog that flashes: the click marks the link as loading, and the
  // dialog opens either with its content or, past a moment, on placeholders.
  useEffect(() => {
    if (!resolving) return;
    const timer = setTimeout(() => setPatient(true), PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [resolving]);

  // One note answers, which only an alias can do here: the choice is a step
  // nobody asked for, so the click goes straight to the note.
  const notes = answer.state === 'ready' ? answer.choices.notes : [];
  const only = notes.length === 1 ? notes[0] : undefined;
  useEffect(() => {
    if (asked && only) {
      setAsked(false);
      setPatient(false);
      host.navigate(only.address);
    }
  }, [asked, only, host]);

  const open = asked && !only && (patient || !resolving);

  // The dialog is modal or it is nothing: `open` as an attribute renders it
  // inline, inside the scroll box this exists to escape.
  useEffect(() => {
    const node = dialog.current;
    if (!node || !open) return;
    if (!node.open) node.showModal?.();
  }, [open]);

  // The first option takes the focus, and not the control that closes.
  useEffect(() => {
    if (!open || resolving) return;
    dialog.current?.querySelector<HTMLElement>('.link-choice-option')?.focus();
  }, [open, resolving, answer]);

  // Pending is what reaches no note, by its name or by a spelling one of them
  // declares.
  const pending = host.reaches(target) === 0;
  const address = host.targetAddress(target);

  const ask = (event: MouseEvent<HTMLAnchorElement>) => {
    // A modifier or a middle click keeps the ordinary behaviour of a link,
    // when the host gave the link an address to keep it for.
    if (address && (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)) return;
    event.preventDefault();
    setAsked(true);
  };

  const close = () => {
    dialog.current?.close?.();
    setAsked(false);
    setPatient(false);
    anchor.current?.focus();
  };

  return (
    <span className="link-choice">
      <a
        ref={anchor}
        href={address ?? '#'}
        className={pending ? 'wikilink-pending' : 'wikilink'}
        title={pending ? strings.pendingLink : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={resolving && !open}
        onClick={ask}
      >
        {children}
      </a>
      {open && (
        <dialog
          ref={dialog}
          className="link-choice-dialog"
          aria-label={strings.linkChoice(target)}
          // Esc fires `cancel`, and a click on the backdrop lands on the
          // dialog element itself, never on the card inside it.
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClick={(event) => {
            if (event.target === dialog.current) close();
          }}
        >
          <div className="link-choice-card">
            <header className="link-choice-header">
              <h2>{pending ? strings.linkLeadsNowhere : strings.linkLeadsToSeveral}</h2>
              <button type="button" className="link-choice-close" onClick={close}>
                <span aria-hidden="true">✕</span>
                <span className="visually-hidden">{strings.close}</span>
              </button>
            </header>
            <LinkChoiceContent
              target={target}
              answer={answer}
              onPick={(picked) => {
                close();
                host.navigate(picked);
              }}
            />
            <footer className="link-choice-footer">
              <button type="button" className="link-choice-cancel" onClick={close}>
                {strings.cancel}
              </button>
            </footer>
          </div>
        </dialog>
      )}
    </span>
  );
}

/** Three rows of nothing, so a click never looks ignored while it resolves. */
function Placeholders() {
  return (
    <ul className="link-choice-options" aria-hidden="true">
      {[0, 1].map((row) => (
        <li key={row}>
          <span className="link-choice-option is-placeholder" />
        </li>
      ))}
    </ul>
  );
}

/**
 * What a link to more than one note has to say.
 *
 * **What leads an option depends on what matched.** Matched by name, every
 * option carries the same name, so repeating it is noise: the folder trail
 * leads, and the name is said once, in the explanation. Matched by alias, the
 * names differ, so each option leads with its name and carries the trail under
 * it.
 */
function LinkChoiceContent({
  target,
  answer,
  onPick,
}: {
  target: string;
  answer: Answer;
  onPick: (address: string) => void;
}) {
  const { strings } = useHost();

  if (answer.state === 'loading') {
    return (
      <div className="link-choice-body" aria-busy="true">
        <p className="link-choice-explanation">{strings.loading}</p>
        <Placeholders />
      </div>
    );
  }

  if (answer.state === 'error') {
    return (
      <div className="link-choice-body">
        <p className="link-choice-explanation">{strings.failed}</p>
      </div>
    );
  }

  const { by, notes } = answer.choices;
  if (notes.length === 0) {
    return (
      <div className="link-choice-body">
        <p className="link-choice-explanation">{strings.targetPending(target)}</p>
      </div>
    );
  }

  const byAlias = by === 'alias';
  /**
   * The path, written the way a path is written: an address of a place a note
   * is IN, the root included, as `/`.
   */
  const trailOf = (note: LinkChoiceNote): string => (note.trail.length === 0 ? '/' : `/${note.trail.join('/')}`);
  const pick = (address: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onPick(address);
  };

  return (
    <div className="link-choice-body">
      <p className="link-choice-explanation">
        {byAlias ? strings.targetAliased(target, notes.length) : strings.targetNamed(target, notes.length)}
      </p>
      <ul className="link-choice-options">
        {notes.map((note) => (
          <li key={note.address}>
            <a className="link-choice-option" href={note.address} onClick={pick(note.address)}>
              <span className="link-choice-lead">{byAlias ? note.name || strings.unnamedNote : trailOf(note)}</span>
              {/* Matched by name, every option carries the same name, and it
                  is already in the explanation: the trail alone tells them
                  apart. Matched by alias, the names differ and lead. */}
              {byAlias && <span className="link-choice-under">{trailOf(note)}</span>}
              {note.folderDescription.trim().length > 0 && (
                <span className="link-choice-about">{shortened(note.folderDescription)}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
