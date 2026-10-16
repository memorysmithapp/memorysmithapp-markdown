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
  fileOf={(name) => describe(name)}               // { mimeType, bytes, url, description }: drawn by its type, as MemorySmith does
  renderLink={({ href, className, children }) => <RouterLink to={href} className={className}>{children}</RouterLink>}
  loadNote={(name) => fetchTheBodyOf(name)}        // for an embedded note; the package never fetches
  writable
  onToggleTask={(ordinal) => save(toggleTaskAt(latest(), ordinal))} // a promise locks the item under "Updating…" until it settles
  theme="dark"
  strings={{ footnotes: 'Notas' }}                 // every word left out is MemorySmith's English
/>;
```

Every prop is optional, and every default is the safe one: with no `resolve` every link is pending, with no `keeps` no embed reaches a file. A file `fileOf` describes is drawn by its media type, never its name: an image, an audio or a video player, and anything else a card with its type, size, description, *Open* where a browser shows it and *Download*; give `renderAttachment` instead to draw files yourself. The stylesheet styles nothing outside `.markdown`. The faces of the default theme are Inter and Space Grotesk, which the page loads.

## Themes

With no theme, a note looks as it does in MemorySmith, in `theme="light"` or `theme="dark"`. To give it your own look, write a theme in your project and pass it:

```tsx
import { defineTheme, NoteBody } from '@memorysmithapp/markdown-renderer';
import '@memorysmithapp/markdown-renderer/styles.css';
import './acme-theme.css';                          // your CSS, under .markdown-theme-acme

const acme = defineTheme({
  name: 'acme',                                    // the root of a note carries .markdown-theme-acme
  schemes: ['light', 'dark'],
  properties: {                                    // level 1: values, no CSS needed
    light: { bg: '#ffffff', text: '#222222', accent: '#e11d48', fontSans: "'IBM Plex Sans', sans-serif" },
    dark: { bg: '#111111', text: '#eeeeee', accent: '#fb7185' },
  },
  icons: { warning: <AlertTriangle />, tip: <Lightbulb /> }, // any icon library
  components: {                                    // level 3: draw a block your way
    table: ({ children }) => <table className="acme-table">{children}</table>,
    callout: ({ kind, title, icon, children }) => (
      <aside className={`acme-callout acme-${kind}`}>
        <header>{icon}{title}</header>
        {children}
      </aside>
    ),
  },
});

<NoteBody markdown={note} theme={acme} scheme="dark" />;
```

- **Properties** name every value the stylesheet reads — colours, faces, sizes, spacing, headings, quotations, tables, callout hues and icons — and are written on the root as `--markdown-*`, so your CSS may set them too.
- **Your CSS** is scoped by `.markdown-theme-<name>`, and reaches the note and nothing else.
- **Slots** — `callout`, `calloutIcon`, `table`, `codeBlock`, `inlineCode`, `heading`, `blockquote`, `embed`, `footnotes`, `taskBox`, `wikilink`, `diagram`, `properties`, `modeSwitch` — are called with the notation already read. A slot decides how a block looks, never what it means: the links it draws go where the host resolved them, a task box reports through the `toggle` it is given, and no raw HTML ever reaches it.

The frontmatter is the note's too. The default theme draws it as MemorySmith does: `name` as the title, and the other entries in a block that folds, each key with the icon of its value's shape, lists as chips and dates in `strings.locale`, with a `[[wikilink]]`, a Markdown link or a web address in a value drawn as a link. A theme decides otherwise through the `properties` slot, which may draw nothing, as a host that shows properties elsewhere does:

```tsx
const mine = defineTheme({ name: 'mine', components: { properties: () => null } });
```

Import `structure.css` instead of `styles.css` for a theme that draws everything itself. A theme names faces; your page loads them.

## Edit

A note the host makes `editable` carries a button at its top right that switches between reading and editing it on the same page. The author edits what they see: marks, headings, lists, tasks, links and the names of notes after `[[`, callouts, tables cell by cell, code, formulas and diagrams with their drawing live, the properties as a form, footnotes and comments. The note is the bytes you gave, and every change comes back whole through `onChange`, unchanged wherever the author did not touch it — the order and quoting of the frontmatter, a list's marker, a table's spacing, a comment, a line break. The package never saves. The toolbar grows out of the switch, which becomes its last control; its first tool undoes every change since editing began, and a right-click on the text opens a menu of the same tools where you are (Shift keeps the browser's); beside the switch, in both modes, Show Markdown opens the note's Markdown, as you have it or would receive it, in a dialog, and Copy Markdown copies it. Those two are reading, so a note that is not `editable` carries them too, without the switch; pass `actions={false}` to hide them, for a print, a preview or an embed.

```tsx
<NoteBody
  markdown={note}
  editable                                        // the switch, at the top right
  onChange={(next) => save(next)}                 // after every change; return the save's promise
  suggest={(typed) => namesOfNotesLike(typed)}    // what [[ offers
  attach={(file, { name, description }) => keepInNotebook(file, name, description)} // the name it is kept under
  files={() => filesOfTheNotebook()}              // what the attach dialog lists: { name, mimeType, bytes, url, description }
  modeButton="icon"                               // or "label", the icon and its word
/>
```

When `onChange` returns the promise of its save, the editor shows before the switch an icon for whether the last change is *Saving…*, *Saved* or *Not saved*, the last one's icon trying again when clicked, and going back to reading waits for the save, staying in edit when it failed. Return nothing and no status is shown. Pass the saved note back as `markdown` whenever you like: a text the editor already moved past is not applied over what the author typed since.

`mode` and `onModeChange` let you control the mode yourself, and the words come from `strings` (`edit`, `view` and `editor`). The editor is CodeMirror, loaded the first time a note is edited, so a page that only draws never loads it. To edit without the switch, import it from its own entry point:

```tsx
import { NoteEditor } from '@memorysmithapp/markdown-renderer/edit';

<NoteEditor markdown={note} onChange={setNote} {...host} />;
```

A note that mixes line breaks (CRLF and LF) opens read-only, because the editor could not give it back byte for byte.

## Diagnose

Every note is valid, and nothing here refuses one. What `diagnose` tells a host is where the page will not show what was most likely typed, and what the note lacks that the specification reserves a place for: the notices of [`SPEC.md` §7.13](https://github.com/memorysmithapp/memorysmithapp-markdown/blob/main/packages/markdown-spec/SPEC.md#713-notices). It imports no React and needs no DOM, so it runs in an editor, on a server, or in a tool that writes a note.

```ts
import { diagnose } from '@memorysmithapp/markdown-renderer/diagnose';

const notices = await diagnose(note, {
  resolve: (name) => addressOfTheOneNoteNamed(name), // or reaches; leave both out and no link is pending
  keeps: (name) => notebookKeepsAFile(name),
});
// [{ code: 'heading-skipped-level', severity: 'notice', section: '3.3',
//    message: 'This heading skips a level below the heading before it.',
//    line: 12, column: 1, endLine: 12, endColumn: 14 }, …]
```

A `notice` says the page will differ from the text — a fence never closed, a formula KaTeX cannot typeset, a diagram Mermaid cannot read, raw HTML, a footnote with no definition or no reference, a single-tilde strikethrough, a frontmatter never closed, a `name` that leaves the note unnamed or none at all, `aliases` or `tags` that are not a list, a body that does not start at `#` or skips a level. A `hint` says nothing is drawn wrong: no `aliases`, no `tags`, a link or an embed no note answers yet. Lines and columns count from 1 over the whole note, frontmatter included, and the `message` is English; a host words it in its own language from the `code`, which is stable. Mermaid is loaded only for a note that holds a diagram, and `diagrams: false` skips it.

The host contract, the stylesheet's properties, the slots and the decisions behind them are in the repository's [`ARCHITECTURE.md`](https://github.com/memorysmithapp/memorysmithapp-markdown/blob/main/ARCHITECTURE.md).

## Licence

[MIT](LICENSE).
