// The icons of the switch between reading and editing (#51): Lucide's pencil and eye (ISC), drawn
// in the current colour at the size of the text. Apart from the editor, which loads on demand.

const svg = (...paths: string[]) => (
  <svg className="mode-switch-glyph" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths.map((d) => (
      <path key={d} d={d} />
    ))}
  </svg>
);

export const ICON_EDIT = svg(
  'M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z',
  'm15 5 4 4',
);

export const ICON_VIEW = svg(
  'M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0',
  'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
);

// The buttons beside the switch (#76): Lucide's file-code, copy, check and x (ISC).
export const ICON_MARKDOWN = svg('M10 12.5 8 15l2 2.5', 'm14 12.5 2 2.5-2 2.5', 'M14 2v4a2 2 0 0 0 2 2h4', 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z');
export const ICON_COPY = svg('M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2');
export const ICON_CHECK = svg('M20 6 9 17l-5-5');
export const ICON_CLOSE = svg('M18 6 6 18', 'm6 6 12 12');
