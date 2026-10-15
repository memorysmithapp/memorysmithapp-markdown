import { NoteBody, toggleTaskAt, type NoteHost } from '@memorysmithapp/markdown-renderer';
import { useEffect, useMemo, useRef, useState } from 'react';
import SAMPLE_ATTRIBUTES from '../fixtures/files.json';
import { readAsDataUrl, startingFiles, type StoredFile } from './files.js';
import { forgetKept, readKept, writeKept } from './kept.js';
import { addressOf, buildNotebooks, hostOf, noteAt, type Note, type Notebook } from './notebooks.js';
import { PORTUGUESE } from './strings.js';
import { schemesOf, themeNamed, THEMES, type PlaygroundTheme } from './themes/index.js';

/** Every note of the two notebooks, read at build time; nothing is fetched. */
const sources = import.meta.glob<string>('../../notebooks/*/**/*.md', { query: '?raw', import: 'default', eager: true });
/** The files the notebooks keep: a few fixture images, read as base64 `data:` addresses. */
const kept = import.meta.glob<string>('../../notebooks/*/assets/*', { query: '?inline', import: 'default', eager: true });

const PREFIX = '../../notebooks/';
const files = Object.fromEntries(Object.entries(sources).map(([path, text]) => [path.slice(PREFIX.length), text]));
const keptBySlug: Record<string, string[]> = {};
for (const path of Object.keys(kept)) {
  const [slug, , name] = path.slice(PREFIX.length).split('/');
  if (slug && name) keptBySlug[slug] = [...(keptBySlug[slug] ?? []), name.normalize('NFC')];
}
const NOTEBOOKS: readonly Notebook[] = buildNotebooks(files, keptBySlug);
/** One sample of each type MemorySmith accepts, and what `fixtures/files.json` says of each (#77). */
const samples = import.meta.glob<string>('../fixtures/files/*', { query: '?inline', import: 'default', eager: true });
/** Each notebook's files as the playground keeps them at the start, with their attributes and their bytes in base64. */
const STARTING_FILES = startingFiles(
  Object.fromEntries(Object.entries(kept).map(([path, url]) => [path.slice(PREFIX.length), url])),
  Object.fromEntries(Object.entries(samples).map(([path, url]) => [path.split('/').pop() ?? path, url])),
  SAMPLE_ATTRIBUTES,
  NOTEBOOKS.map((notebook) => notebook.slug),
);

/**
 * What the page shows, read from its address:
 * `/notes/enologia/01 Castas/Índice?theme=sepia&scheme=dark&lang=pt&bare=1`. `?theme=light` and
 * `?theme=dark` are the default theme in that scheme, as they were before themes existed.
 */
interface View {
  readonly notebook: Notebook;
  readonly note: Note;
  readonly theme: PlaygroundTheme;
  readonly scheme: 'light' | 'dark';
  readonly lang: 'en' | 'pt';
  /** Only the note, in its column: what the comparison screenshots. */
  readonly bare: boolean;
  /** How a ticked box or an edit is saved: at once, as before, or after a delay that may fail. */
  readonly save: SaveMode;
  /** The delay of a simulated save, in milliseconds. */
  readonly delay: number;
  /** Whether the note offers the switch to edit it: every note does, unless `?editable=0` or `?bare=1`. */
  readonly editable: boolean;
  /** The switch drawn as its icon alone, or its icon and its word (`?button=icon` or `label`). */
  readonly button: 'icon' | 'label';
}

/**
 * The saves the playground simulates, of a tick (#47) and of an edit (#64): `instant` writes at
 * once and answers nothing, as a host did before; the others answer with a promise that settles
 * after the delay — `slow` always resolves, `fail` always rejects, `random` rejects about one save
 * in three — and write only when it resolves.
 */
type SaveMode = 'instant' | 'slow' | 'fail' | 'random';
const SAVE_MODES: readonly SaveMode[] = ['instant', 'slow', 'fail', 'random'];

function readView(): View {
  const query = new URLSearchParams(window.location.search);
  const note = noteAt(NOTEBOOKS, window.location.pathname) ?? NOTEBOOKS[0]?.notes[0];
  if (!note) throw new Error('no note under notebooks/');
  const notebook = NOTEBOOKS.find((each) => each.slug === note.notebook);
  if (!notebook) throw new Error(`no notebook ${note.notebook}`);
  return {
    notebook,
    note,
    ...themeAndScheme(query),
    lang: query.get('lang') === 'pt' ? 'pt' : 'en',
    bare: query.get('bare') === '1',
    save: SAVE_MODES.find((mode) => mode === query.get('save')) ?? 'instant',
    delay: Math.max(0, Number(query.get('delay') ?? '') || 2000),
    // The note alone is what the comparison screenshots, and MemorySmith's page has no switch.
    editable: query.get('editable') !== '0' && query.get('bare') !== '1',
    button: query.get('button') === 'icon' ? 'icon' : 'label',
  };
}

function themeAndScheme(query: URLSearchParams): { theme: PlaygroundTheme; scheme: 'light' | 'dark' } {
  const named = query.get('theme');
  const legacy = named === 'light' || named === 'dark' ? named : null;
  const theme = themeNamed(legacy ? 'default' : named);
  const asked = query.get('scheme') === 'dark' || legacy === 'dark' ? 'dark' : 'light';
  const schemes = schemesOf(theme);
  return { theme, scheme: schemes.includes(asked) ? asked : (schemes[0] ?? 'light') };
}

function withQuery(changes: Record<string, string>): string {
  const query = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(changes)) query.set(key, value);
  return `${window.location.pathname}?${query.toString()}`;
}

export function App() {
  const [view, setView] = useState(readView);
  // The notes as the reader left them: a ticked box changes one character of
  // the note in memory, which is what a host writes back.
  const [edited, setEdited] = useState<Record<string, string>>(() => ({ ...readKept().notes }));
  /** A save as the address asks for it: `write` runs at once, or when the simulated save lands. */
  const save = (write: () => void): Promise<void> | undefined => {
    if (view.save === 'instant') return void write();
    return new Promise<void>((resolve, reject) =>
      setTimeout(() => {
        const fails = view.save === 'fail' || (view.save === 'random' && Math.random() < 1 / 3);
        if (fails) return reject(new Error('The playground failed this save on purpose.'));
        write();
        resolve();
      }, view.delay),
    );
  };

  useEffect(() => {
    const update = () => setView(readView());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset['theme'] = view.scheme;
    // The page takes the colours of the theme, so the pane does not frame the note in another one.
    const page = view.theme.page[view.scheme];
    for (const [name, value] of Object.entries(page ?? {})) root.style.setProperty(`--page-${name}`, value);
  }, [view.theme, view.scheme]);

  const key = `${view.notebook.slug}/${view.note.path}`;
  const markdown = edited[key] ?? view.note.markdown;
  // The files each notebook keeps, with MemorySmith's attributes and their bytes in base64; a file
  // attached in edit mode joins them for the session (#75, #77).
  // The files attached are kept in this browser with the notes' saved text, so both survive a reload (#78).
  const [attached, setAttached] = useState<Record<string, Record<string, StoredFile>>>(() => ({ ...readKept().files }) as Record<string, Record<string, StoredFile>>);
  const [keptAll, setKeptAll] = useState(true);
  useEffect(() => setKeptAll(writeKept({ notes: edited, files: attached })), [edited, attached]);
  const stored = useMemo(
    () => Object.fromEntries(Object.entries(STARTING_FILES).map(([slug, files]) => [slug, { ...files, ...attached[slug] }])),
    [attached],
  );
  const storedNow = useRef(stored);
  storedNow.current = stored;
  const host = useMemo((): NoteHost => {
    const slug = view.notebook.slug;
    const own = (name: string): StoredFile | null => stored[slug]?.[name.normalize('NFC')] ?? null;
    const base = hostOf(view.notebook, own, (address) => {
      window.history.pushState(null, '', `${address}${window.location.search}`);
      setView(readView());
      window.scrollTo(0, 0);
    });
    return {
      ...base,
      keeps: (name) => own(name) !== null,
      // The name a file is kept under: its own, or with a number when the notebook already keeps one so named.
      // Everything the notebook keeps, for the attach dialog to list (#78).
      files: () => Object.values(storedNow.current[slug] ?? {}),
      // Kept under the name the author gave, with a number when the notebook already keeps one so named.
      attach: async (file, attributes) => {
        const wanted = (attributes.name.trim() || file.name).normalize('NFC');
        const dot = wanted.lastIndexOf('.');
        const [stem, extension] = dot > 0 ? [wanted.slice(0, dot), wanted.slice(dot)] : [wanted, ''];
        const taken = (name: string) => storedNow.current[slug]?.[name] !== undefined;
        let name = wanted;
        for (let count = 1; taken(name); count++) name = `${stem} ${count}${extension}`.normalize('NFC');
        const url = await readAsDataUrl(file);
        const kept: StoredFile = { name, mimeType: file.type || 'application/octet-stream', bytes: file.size, url, description: attributes.description };
        await save(() => setAttached((all) => ({ ...all, [slug]: { ...all[slug], [name]: kept } })));
        return name;
      },
    };
  }, [view.notebook, stored, view.save, view.delay]);

  const body = (
    <article className="pane">
      <NoteBody
        key={key}
        markdown={markdown}
        {...host}
        theme={view.theme.theme}
        scheme={view.scheme}
        strings={view.lang === 'pt' ? PORTUGUESE : undefined}
        editable={view.editable}
        modeButton={view.button}
        onChange={(next) => save(() => setEdited((all) => ({ ...all, [key]: next })))}
        writable
        onToggleTask={(ordinal) => {
          // Applied to the note as it is when the save lands, as a host applies a tick to its latest bytes.
          return save(() =>
            setEdited((all) => {
              const next = toggleTaskAt(all[key] ?? view.note.markdown, ordinal);
              return next === null ? all : { ...all, [key]: next };
            }),
          );
        }}
      />
    </article>
  );

  if (view.bare) return <main className="bare">{body}</main>;


  return (
    <div className="layout">
      <nav className="sidebar">
        <p className="brand">memorysmithapp-markdown</p>
        <div className="controls">
          <a href={withQuery({ lang: view.lang === 'pt' ? 'en' : 'pt' })}>{view.lang === 'pt' ? 'English' : 'Português'}</a>
        </div>
        <div className="controls saves">
          <span>Edit switch</span>
          <a className={!view.editable ? 'current' : undefined} href={withQuery({ editable: view.editable ? '0' : '1' })}>
            {view.editable ? 'hide' : 'show'}
          </a>
          {(['label', 'icon'] as const).map((button) => (
            <a key={button} className={button === view.button ? 'current' : undefined} href={withQuery({ button })}>
              {button}
            </a>
          ))}
        </div>
        <div className="controls saves">
          <span>Save</span>
          {SAVE_MODES.map((mode) => (
            <a key={mode} className={mode === view.save ? 'current' : undefined} href={withQuery({ save: mode })}>
              {mode}
            </a>
          ))}
        </div>
        <div className="controls saves">
          <span>Kept in this browser</span>
          <span className={keptAll ? undefined : 'warning'}>
            {keptAll
              ? `${Object.keys(edited).length} notes, ${Object.values(attached).reduce((count, files) => count + Object.keys(files).length, 0)} files`
              : 'Storage full: the last save lasts until the page reloads'}
          </span>
          <button
            type="button"
            disabled={Object.keys(edited).length === 0 && Object.keys(attached).length === 0}
            onClick={() => {
              forgetKept();
              setEdited({});
              setAttached({});
            }}
          >
            Discard
          </button>
        </div>
        <div className="controls themes">
          <label>
            Theme{' '}
            <select
              value={view.theme.theme.name}
              onChange={(event) => {
                window.history.pushState(null, '', withQuery({ theme: event.target.value, scheme: view.scheme }));
                setView(readView());
              }}
            >
              {THEMES.map((each) => (
                <option key={each.theme.name} value={each.theme.name}>
                  {each.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scheme{' '}
            <select
              value={view.scheme}
              disabled={schemesOf(view.theme).length < 2}
              onChange={(event) => {
                window.history.pushState(null, '', withQuery({ theme: view.theme.theme.name, scheme: event.target.value }));
                setView(readView());
              }}
            >
              {schemesOf(view.theme).map((scheme) => (
                <option key={scheme} value={scheme}>
                  {scheme === 'dark' ? 'Dark' : 'Light'}
                </option>
              ))}
            </select>
          </label>
        </div>
        {NOTEBOOKS.map((notebook) => (
          <section key={notebook.slug}>
            <h2>{notebook.slug}</h2>
            <ul>
              {notebook.notes.map((note) => (
                <li key={note.path}>
                  <a className={note === view.note ? 'current' : undefined} href={`${addressOf(note)}${window.location.search}`}>
                    {note.path.replace(/\.md$/, '')}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <main className="content">{body}</main>
    </div>
  );
}
