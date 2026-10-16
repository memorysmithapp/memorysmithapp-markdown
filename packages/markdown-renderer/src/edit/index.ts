// The editor of @memorysmithapp/markdown-renderer, on its own subpath: a host that only draws
// never loads CodeMirror (ADR-006).
export { lineBreakOf, NoteEditor, type NoteEditorProps } from './NoteEditor.js';
export { analyze, frontmatterSpan, type Analysis, type Construct, type Span } from './analyze.js';
export { readTable, type Alignment, type Table, type TextChange } from './table.js';
export { readFrontmatter, type Frontmatter, type FrontmatterEntry } from './frontmatter.js';
export { isSaveNotice, type SaveAction, type SaveNotice, type SaveOutcome, type SaveRefusal } from './saves.js';
