// The icons of the switch between reading and editing (#51): Lucide's pencil and eye (ISC), drawn
// in the current colour at the size of the text. Apart from the editor, which loads on demand.

const svg = (...paths: string[]) => (
  <svg className="mode-switch-icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
