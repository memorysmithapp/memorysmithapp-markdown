---
name: TSX
aliases: []
tags: [code-sample, tsx]
type: sample
fence: tsx
created: 2026-10-15
updated: 2026-10-15
---

A list of notes drawn in React, each a link. The fence is written ` ```tsx `.

```tsx
interface Note {
  name: string;
  address: string;
}

export function NoteList({ notes }: { notes: Note[] }) {
  return (
    <ul className="note-list">
      {notes.map((note) => (
        <li key={note.address}>
          <a href={note.address}>{note.name}</a>
        </li>
      ))}
    </ul>
  );
}
```
