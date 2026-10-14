// The reference page: MemorySmith's own reading surface at the commit the renderer was extracted
// from — `WritableContent` in the `.content-pane` of the note page, with MemorySmith's stylesheet —
// over the demonstration notebooks, with stub providers for the router, i18n and the query client.
// It runs from inside a checkout of MemorySmith, so every import is MemorySmith's.

// @ts-nocheck — compiled by the checkout's Vite, against the checkout's types.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '../src/i18n';
import '../src/styles.css';
import * as source from '../src/shared/api/source';
import { queryKeys } from '../src/shared/api/query-keys';
import { NotebookIdProvider } from '../src/shared/components/notebook-id';
import { WritableContent } from '../src/shared/components/WritableContent';
import { usePreferences } from '../src/shared/store/preferences';
import { noteNameOf, splitFrontmatter } from '../src/shared/api/markdown';
import { orderedProperties, propertyLabel, propertyType, PropertyValue } from '../src/shared/components/PropertyValue';
import i18n from '../src/i18n';
import { fileAt, notebookIdOf } from './backend';

const query = new URLSearchParams(window.location.search);
const theme = query.get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.dataset['theme'] = theme;
usePreferences.setState({ theme, paper: false });

const file = fileAt(window.location.pathname);
const root = document.getElementById('root');
if (!file || !root) throw new Error(`no note at ${window.location.pathname}`);
const notebookId = notebookIdOf(file.slug);

await source.getNotebookStructure(notebookId);
await source.getNotebookNames(notebookId);
await source.getNotebookFiles(notebookId);

// What `NotePage` reads from the API to draw the frame, read here from the same bytes by
// MemorySmith's own helpers: the name, and the properties in its order.
const t = i18n.t.bind(i18n);
const name = noteNameOf(file.markdown);
const { frontmatter, lists } = splitFrontmatter(file.markdown);
const properties = orderedProperties(Object.entries(frontmatter).filter(([, value]) => value !== ''));

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <NotebookIdProvider notebookId={notebookId}>
          {/* The root of MemorySmith is a grid a window tall, which stretches
              its child: the wrapper takes the stretch, and the pane is as tall
              as the note, as the playground's is. */}
          {/* `minWidth: 0` is MemorySmith's `.app-main > *`: without it a long line of code
              widened the pane past a phone's screen, which the application never does. */}
          <div style={{ minWidth: 0 }}>
            <article className="content-pane">
              {/* The frame of MemorySmith's note page above the body, as `NotePage` draws it:
                  the name, always, and the properties block. */}
              <h1 className={name === null ? 'note-unnamed' : undefined}>{name ?? t('note.unnamed')}</h1>
              {properties.length > 0 && (
                <details className="properties-box" open>
                  <summary>{t('note.properties')}</summary>
                  <div className="metadata-container">
                    {properties.map(([key, value]) => (
                      <div className="metadata-property" data-property-type={propertyType(value, lists.has(key))} key={key}>
                        <span className="metadata-property-key">{propertyLabel(key, t)}</span>
                        <span className="metadata-property-value">
                          <PropertyValue value={value} list={lists.has(key)} notebookId={notebookId} />
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <WritableContent
                raw={file.markdown}
                notebookId={notebookId}
                baseRevision="r1"
                writable
                write={() => Promise.resolve('r2')}
                invalidates={queryKeys.note(notebookId, 'unused')}
              />
            </article>
          </div>
        </NotebookIdProvider>
      </MemoryRouter>
    </QueryClientProvider>
  </StrictMode>,
);
