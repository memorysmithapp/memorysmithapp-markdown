// Drawing a note in a test: to static markup, which is enough for what a note looks like, and
// into the jsdom document, for what a reader does with it.

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { NoteBody, type NoteBodyProps } from '../src/index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export function html(markdown: string, host: Omit<NoteBodyProps, 'markdown'> = {}): string {
  return renderToStaticMarkup(<NoteBody markdown={markdown} {...host} />);
}

export interface Mounted {
  readonly container: HTMLElement;
  readonly root: Root;
  unmount(): void;
}

export async function mount(element: ReactElement): Promise<Mounted> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return {
    container,
    root,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

export async function draw(markdown: string, host: Omit<NoteBodyProps, 'markdown'> = {}): Promise<Mounted> {
  return mount(<NoteBody markdown={markdown} {...host} />);
}
