/**
 * The attach dialog (#78): the three ways a file or an image comes into a note. From the computer —
 * one or more files, each kept by the host's `attach` under the name and with the description the
 * author gives; from the notebook — a file it already keeps, listed by the host's `files`, found by
 * name or description; from the web — an image at a public address, written as `![name](address)`.
 */

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { fileAddress, fileKind, formatBytes, rendersAs } from '../file-types.js';
import { useHost, type KeptFileEntry } from '../host.js';
import { ICONS } from './blocks.js';

export interface ChosenFile {
  readonly file: File;
  readonly name: string;
  readonly description: string;
}

type Way = 'computer' | 'notebook' | 'web';

/** An address of the web, the only kind an image from the web may have. */
const WEB = /^https?:\/\/[^\s]+$/i;

/** The Markdown of an image at a web address, its name the alternative text (§3.14). */
export function webImage(name: string, address: string): string {
  const alt = name.replace(/([\\[\]])/g, '\\$1');
  const target = /[\s()<>]/.test(address) ? `<${address.replace(/[<>]/g, encodeURIComponent)}>` : address;
  return `![${alt}](${target})`;
}

export function AttachDialog({
  refusal = null,
  onClose,
  onClosed,
  onAttach,
  onEmbed,
  onLink,
}: {
  /** Why the host refused the last file, said at the top of the dialog the author opened after it (#88). */
  refusal?: string | null;
  onClose: () => void;
  /** Once the dialog is closed: whether something was put in the note, which then has the focus. */
  onClosed: (inserted: boolean) => void;
  onAttach: (files: readonly ChosenFile[]) => void;
  onEmbed: (name: string) => void;
  onLink: (name: string, address: string) => void;
}) {
  const host = useHost();
  const words = host.strings.editor;
  const ways: Way[] = [...(host.attach ? (['computer'] as const) : []), ...(host.files ? (['notebook'] as const) : []), 'web'];
  const [way, setWay] = useState<Way>(ways[0]!);
  const dialog = useRef<HTMLDialogElement>(null);
  const inserted = useRef(false);
  const closed = useRef(onClosed);
  closed.current = onClosed;
  const id = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    element.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    return () => {
      if (element.open && typeof element.close === 'function') element.close();
      closed.current(inserted.current);
    };
  }, []);

  const done = (action: () => void) => {
    inserted.current = true;
    onClose();
    action();
  };
  const label = { computer: words.fromComputer, notebook: words.fromNotebook, web: words.fromWeb };

  return (
    <dialog
      ref={dialog}
      className="edit-source edit-attach"
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
            {words.attachTitle}
          </h2>
          <button type="button" className="edit-control edit-source-close" aria-label={host.strings.close} title={host.strings.close} onClick={onClose}>
            {ICONS.remove}
          </button>
        </header>
        {refusal && <p className="edit-attach-error edit-attach-refusal">{refusal}</p>}
        <div className="edit-attach-ways" role="tablist" aria-label={words.attachTitle}>
          {ways.map((each) => (
            <button
              key={each}
              type="button"
              role="tab"
              id={`${id}-${each}`}
              aria-selected={each === way}
              aria-controls={`${id}-panel`}
              tabIndex={each === way ? 0 : -1}
              className="edit-attach-way"
              onClick={() => setWay(each)}
              onKeyDown={(event) => {
                const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                if (step === 0) return;
                event.preventDefault();
                const next = ways[(ways.indexOf(way) + step + ways.length) % ways.length]!;
                setWay(next);
                event.currentTarget.parentElement?.querySelector<HTMLElement>(`[id="${id}-${next}"]`)?.focus();
              }}
            >
              {label[each]}
            </button>
          ))}
        </div>
        <div className="edit-attach-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${way}`}>
          {way === 'computer' && <FromComputer onAttach={(files) => done(() => onAttach(files))} />}
          {way === 'notebook' && <FromNotebook onEmbed={(name) => done(() => onEmbed(name))} />}
          {way === 'web' && <FromWeb onLink={(name, address) => done(() => onLink(name, address))} />}
        </div>
      </div>
    </dialog>
  );
}

/** Files of the computer, each with the name and the description the author gives it. */
function FromComputer({ onAttach }: { onAttach: (files: readonly ChosenFile[]) => void }) {
  const host = useHost();
  const words = host.strings.editor;
  const [chosen, setChosen] = useState<ChosenFile[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const update = (index: number, change: Partial<ChosenFile>) => setChosen((all) => all.map((each, at) => (at === index ? { ...each, ...change } : each)));
  const ready = chosen.length > 0 && chosen.every((each) => each.name.trim().length > 0);
  return (
    <form
      className="edit-attach-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onAttach(chosen.map((each) => ({ ...each, name: each.name.trim(), description: each.description.trim() })));
      }}
    >
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          setChosen((all) => [...all, ...files.map((file) => ({ file, name: file.name, description: '' }))]);
          event.target.value = '';
        }}
      />
      <button type="button" className="edit-attach-button" onClick={() => picker.current?.click()}>
        {ICONS.attach} {words.chooseFiles}
      </button>
      {chosen.map((each, index) => (
        <fieldset key={index} className="edit-attach-file">
          <legend className="edit-attach-file-kind">
            {fileKind(each.file.type || 'application/octet-stream', host.strings.fileKinds)} · {formatBytes(each.file.size, host.strings.locale)}
          </legend>
          <label>
            <span>{words.fileName}</span>
            <input className="edit-attach-input" value={each.name} required onChange={(event) => update(index, { name: event.target.value })} />
          </label>
          <label>
            <span>{words.fileDescription}</span>
            <input className="edit-attach-input" value={each.description} onChange={(event) => update(index, { description: event.target.value })} />
          </label>
          <button type="button" className="edit-control" aria-label={`${words.removeItem} ${each.name}`} title={words.removeItem} onClick={() => setChosen((all) => all.filter((_, at) => at !== index))}>
            {ICONS.remove}
          </button>
        </fieldset>
      ))}
      <div className="edit-attach-actions">
        <button type="submit" className="edit-attach-button edit-attach-primary" disabled={!ready}>
          {words.attachConfirm}
        </button>
      </div>
    </form>
  );
}

/** The files the notebook keeps, found by name or description, one chosen to embed. */
function FromNotebook({ onEmbed }: { onEmbed: (name: string) => void }) {
  const host = useHost();
  const words = host.strings.editor;
  const [files, setFiles] = useState<readonly KeptFileEntry[] | null | 'failed'>(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    let live = true;
    Promise.resolve()
      .then(() => host.files?.() ?? [])
      .then(
        (listed) => live && setFiles([...listed].sort((a, b) => a.name.localeCompare(b.name))),
        () => live && setFiles('failed'),
      );
    return () => {
      live = false;
    };
  }, [host.files]);
  if (files === null) return <p className="edit-attach-note">{host.strings.loading}</p>;
  if (files === 'failed') return <p className="edit-attach-note">{host.strings.failed}</p>;
  const wanted = query.trim().toLowerCase();
  const shown = wanted ? files.filter((each) => `${each.name}\n${each.description ?? ''}`.toLowerCase().includes(wanted)) : files;
  return (
    <div className="edit-attach-files">
      <input type="search" className="edit-attach-input" placeholder={words.searchFiles} aria-label={words.searchFiles} value={query} onChange={(event) => setQuery(event.target.value)} />
      {files.length === 0 ? (
        <p className="edit-attach-note">{words.noFiles}</p>
      ) : shown.length === 0 ? (
        <p className="edit-attach-note">{words.noMatch}</p>
      ) : (
        <ul className="edit-attach-list">
          {shown.map((each) => {
            const preview = rendersAs(each.mimeType) === 'image' ? fileAddress(each.url) : '';
            return (
              <li key={each.name}>
                <button type="button" className="edit-attach-item" onClick={() => onEmbed(each.name)}>
                  <span className="edit-attach-preview" aria-hidden="true">
                    {preview ? <img src={preview} alt="" /> : ICONS.attach}
                  </span>
                  <span className="edit-attach-item-body">
                    <span className="edit-attach-item-name">{each.name}</span>
                    <span className="edit-attach-item-note">
                      {fileKind(each.mimeType, host.strings.fileKinds)} · {formatBytes(each.bytes, host.strings.locale)}
                    </span>
                    {each.description && <span className="edit-attach-item-note">{each.description}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** An image at a public address, and the name it is described by. */
function FromWeb({ onLink }: { onLink: (name: string, address: string) => void }) {
  const words = useHost().strings.editor;
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [invalid, setInvalid] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    // A space pasted with an address is part of it, written as the web writes it.
    const target = address.trim().replace(/ /g, '%20');
    if (!WEB.test(target)) return setInvalid(true);
    onLink(name.trim(), target);
  };
  return (
    <form className="edit-attach-form" onSubmit={submit} noValidate>
      <label>
        <span>{words.webAddress}</span>
        <input
          className="edit-attach-input"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={address}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            setAddress(event.target.value);
            setInvalid(false);
          }}
        />
      </label>
      {invalid && (
        <p className="edit-attach-error" role="alert">
          {words.webInvalid}
        </p>
      )}
      <label>
        <span>{words.webName}</span>
        <input className="edit-attach-input" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="edit-attach-actions">
        <button type="submit" className="edit-attach-button edit-attach-primary" disabled={address.trim().length === 0}>
          {words.webInsert}
        </button>
      </div>
    </form>
  );
}
