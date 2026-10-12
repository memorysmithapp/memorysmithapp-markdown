# @memorysmithapp/markdown-renderer

A React component that draws the body of a MemorySmith note exactly as MemorySmith's reading page does: callouts, wikilinks, embedded notes, task boxes, code with highlighting and diagrams, mathematics, footnotes — the notation of the [MemorySmith Markdown Specification](https://www.npmjs.com/package/@memorysmithapp/markdown-spec).

The package knows no API, no router and no i18n library. Everything it needs from the notebook a note lives in reaches it as props, and it never rewrites the note: ticking a task box reports which box, and the host applies it.

## Use

```sh
npm install @memorysmithapp/markdown-renderer react react-dom katex
```

```tsx
import { NoteBody, toggleTaskAt } from '@memorysmithapp/markdown-renderer';
import '@memorysmithapp/markdown-renderer/styles.css';
import 'katex/dist/katex.min.css';

<NoteBody
  markdown={note}                                  // the note as you keep it, frontmatter included
  resolve={(name) => addressOfTheOneNoteNamed(name)} // or null: the link is pending
  keeps={(name) => notebookKeepsAFile(name)}       // only an embed reaches a file
  renderAttachment={({ name, width, height }) => <img src={urlOf(name)} width={width ?? undefined} />}
  renderLink={({ href, className, children }) => <RouterLink to={href} className={className}>{children}</RouterLink>}
  loadNote={(name) => fetchTheBodyOf(name)}        // for an embedded note; the package never fetches
  writable
  onToggleTask={(ordinal) => save(toggleTaskAt(note, ordinal))}
  theme="dark"
  strings={{ footnotes: 'Notas' }}                 // every word left out is MemorySmith's English
/>;
```

Every prop is optional, and every default is the safe one: with no `resolve` every link is pending, with no `keeps` no embed reaches a file. The stylesheet styles nothing outside `.markdown`; theme it with the `--markdown-*` custom properties. The faces are Inter and Space Grotesk, which the page loads.

The host contract, the stylesheet's properties and the decisions behind them are in the repository's [`ARCHITECTURE.md`](https://github.com/memorysmithapp/memorysmithapp-markdown/blob/main/ARCHITECTURE.md).

## Licence

[MIT](LICENSE).
