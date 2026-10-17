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

// The image's controls (#106), Lucide's (ISC): its own size again, rotate-ccw, an undo of the
// size and not a way out of the page; the lock between width and height, link-2 and unlink-2;
// and the handle's diagonal arrows, move-diagonal-2.
export const ICON_OWN_SIZE = svg('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5');
export const ICON_RATIO_LOCKED = svg('M9 17H7A5 5 0 0 1 7 7h2', 'M15 7h2a5 5 0 1 1 0 10h-2', 'M8 12h8');
export const ICON_RATIO_FREE = svg('M9 17H7A5 5 0 0 1 7 7', 'M15 7h2a5 5 0 0 1 4 8', 'M8 12h1', 'M2 2l20 20');
export const ICON_RESIZE = svg('M19 13v6h-6', 'M5 11V5h6', 'm5 5 14 14');
