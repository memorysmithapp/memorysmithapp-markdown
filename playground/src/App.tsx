import { NoteBody, toggleTaskAt } from '@memorysmithapp/markdown-renderer';
import { useEffect, useMemo, useState } from 'react';
import { addressOf, buildNotebooks, hostOf, noteAt, type Note, type Notebook } from './notebooks.js';
import { PORTUGUESE } from './strings.js';
import { schemesOf, themeNamed, THEMES, type PlaygroundTheme } from './themes/index.js';

/** Every note of the two notebooks, read at build time; nothing is fetched. */
const sources = import.meta.glob<string>('../../notebooks/*/**/*.md', { query: '?raw', import: 'default', eager: true });
/** The files the notebooks keep: a few fixture images, served at `/assets/<name>`. */
const kept = import.meta.glob('../../notebooks/*/assets/*', { query: '?url', import: 'default', eager: true });

const PREFIX = '../../notebooks/';
const files = Object.fromEntries(Object.entries(sources).map(([path, text]) => [path.slice(PREFIX.length), text]));
const keptBySlug: Record<string, string[]> = {};
for (const path of Object.keys(kept)) {
  const [slug, , name] = path.slice(PREFIX.length).split('/');
  if (slug && name) keptBySlug[slug] = [...(keptBySlug[slug] ?? []), name.normalize('NFC')];
}
const NOTEBOOKS: readonly Notebook[] = buildNotebooks(files, keptBySlug);

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
  /** How a ticked box is saved: at once, as before, or after a delay that may fail. */
  readonly save: SaveMode;
  /** The delay of a simulated save, in milliseconds. */
  readonly delay: number;
}

/**
 * The saves the playground simulates (#47): `instant` writes at once and answers nothing, as a
 * host did before; the others answer with a promise that settles after the delay — `slow` always
 * resolves, `fail` always rejects, `random` rejects about one save in three.
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
  const [edited, setEdited] = useState<Record<string, string>>({});

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
  const host = useMemo(
    () =>
      hostOf(
        view.notebook,
        (name) => `/notes/${encodeURIComponent(view.notebook.slug)}/assets/${encodeURIComponent(name)}`,
        (address) => {
          window.history.pushState(null, '', `${address}${window.location.search}`);
          setView(readView());
          window.scrollTo(0, 0);
        },
      ),
    [view.notebook],
  );

  const body = (
    <article className="pane">
      <NoteBody
        key={key}
        markdown={markdown}
        {...host}
        theme={view.theme.theme}
        scheme={view.scheme}
        strings={view.lang === 'pt' ? PORTUGUESE : undefined}
        writable
        onToggleTask={(ordinal) => {
          // Applied to the note as it is when the save lands, as a host applies a tick to its latest bytes.
          const write = () =>
            setEdited((all) => {
              const next = toggleTaskAt(all[key] ?? view.note.markdown, ordinal);
              return next === null ? all : { ...all, [key]: next };
            });
          if (view.save === 'instant') return void write();
          return new Promise<void>((resolve, reject) =>
            setTimeout(() => {
              const fails = view.save === 'fail' || (view.save === 'random' && Math.random() < 1 / 3);
              if (fails) return reject(new Error('The playground failed this save on purpose.'));
              write();
              resolve();
            }, view.delay),
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
          <span>Save a tick</span>
          {SAVE_MODES.map((mode) => (
            <a key={mode} className={mode === view.save ? 'current' : undefined} href={withQuery({ save: mode })}>
              {mode}
            </a>
          ))}
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
