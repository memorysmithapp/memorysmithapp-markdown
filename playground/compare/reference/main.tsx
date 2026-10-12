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

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <NotebookIdProvider notebookId={notebookId}>
          {/* The root of MemorySmith is a grid a window tall, which stretches
              its child: the wrapper takes the stretch, and the pane is as tall
              as the note, as the playground's is. */}
          <div>
            <article className="content-pane">
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
