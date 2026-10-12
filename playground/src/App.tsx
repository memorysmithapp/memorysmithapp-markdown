import { NoteBody, toggleTaskAt } from '@memorysmithapp/markdown-renderer';
import { useEffect, useMemo, useState } from 'react';
import { addressOf, buildNotebooks, hostOf, noteAt, type Note, type Notebook } from './notebooks.js';
import { PORTUGUESE } from './strings.js';

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

/** What the page shows, read from its address: `/notes/enologia/01 Castas/Índice?theme=dark&lang=pt&bare=1`. */
interface View {
  readonly notebook: Notebook;
  readonly note: Note;
  readonly theme: 'light' | 'dark';
  readonly lang: 'en' | 'pt';
  /** Only the note, in its column: what the comparison screenshots. */
  readonly bare: boolean;
}

function readView(): View {
  const query = new URLSearchParams(window.location.search);
  const note = noteAt(NOTEBOOKS, window.location.pathname) ?? NOTEBOOKS[0]?.notes[0];
  if (!note) throw new Error('no note under notebooks/');
  const notebook = NOTEBOOKS.find((each) => each.slug === note.notebook);
  if (!notebook) throw new Error(`no notebook ${note.notebook}`);
  return {
    notebook,
    note,
    theme: query.get('theme') === 'dark' ? 'dark' : 'light',
    lang: query.get('lang') === 'pt' ? 'pt' : 'en',
    bare: query.get('bare') === '1',
  };
}

function withQuery(key: string, value: string): string {
  const query = new URLSearchParams(window.location.search);
  query.set(key, value);
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
    document.documentElement.dataset['theme'] = view.theme;
  }, [view.theme]);

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
      {!view.bare && <h1 className="note-title">{view.note.name ?? view.note.path.split('/').at(-1)?.replace(/\.md$/, '')}</h1>}
      <NoteBody
        key={key}
        markdown={markdown}
        {...host}
        theme={view.theme}
        strings={view.lang === 'pt' ? PORTUGUESE : undefined}
        writable
        onToggleTask={(ordinal) => {
          const next = toggleTaskAt(markdown, ordinal);
          if (next !== null) setEdited((all) => ({ ...all, [key]: next }));
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
          <a href={withQuery('theme', view.theme === 'dark' ? 'light' : 'dark')}>{view.theme === 'dark' ? 'Light' : 'Dark'}</a>
          <a href={withQuery('lang', view.lang === 'pt' ? 'en' : 'pt')}>{view.lang === 'pt' ? 'English' : 'Português'}</a>
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
