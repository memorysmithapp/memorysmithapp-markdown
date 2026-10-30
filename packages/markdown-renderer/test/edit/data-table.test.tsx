/**
 * A `table` block in the editor (§7.15, #138): drawn as its table while the author is elsewhere,
 * where the host reaches the tables, and edited as its lines; a code block everywhere else.
 */

import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoteEditor } from '../../src/edit/index.js';
import { runTableQuery, type TablePage, type TableRequest } from '../../src/table-block.js';
import { mount, type Mounted } from '../render.js';

let mounted: Mounted | null = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const NOTE = 'Spent so far:\n\n```table\ntable: outages\ntotal: minutes\n```\n\nThe rest.\n';

const queryTable = async (request: TableRequest): Promise<TablePage | null> =>
  runTableQuery(
    {
      schema: { name: 'outages', columns: [{ name: 'cause', kind: 'text' }, { name: 'minutes', kind: 'number' }] },
      rows: [{ cause: 'Region loss', minutes: '14' }],
    },
    request,
  );

async function open(withTables: boolean): Promise<EditorView> {
  mounted = await mount(<NoteEditor markdown={NOTE} {...(withTables ? { queryTable } : {})} />);
  for (let i = 0; i < 5; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
  return EditorView.findFromDOM(mounted.container.querySelector<HTMLElement>('.cm-editor')!)!;
}

describe('a table block in the editor', () => {
  it('is drawn as its table while the author is elsewhere', async () => {
    const view = await open(true);
    const table = view.dom.querySelector('.data-table');
    expect(table).not.toBeNull();
    expect([...table!.querySelectorAll('tbody td')].map((cell) => cell.textContent)).toEqual(['Region loss', '14']);
  });

  it('shows its lines when the author is in it', async () => {
    const view = await open(true);
    const at = view.state.doc.toString().indexOf('table: outages');
    act(() => {
      view.focus();
      view.dispatch({ selection: { anchor: at } });
    });
    for (let i = 0; i < 3; i++) await act(async () => new Promise((done) => setTimeout(done, 0)));
    expect(view.dom.querySelector('.data-table')).toBeNull();
    expect(view.contentDOM.textContent).toContain('table: outages');
  });

  it('is a code block where the host reaches no tables', async () => {
    const view = await open(false);
    expect(view.dom.querySelector('.data-table')).toBeNull();
    expect(view.contentDOM.textContent).toContain('total: minutes');
  });
});
