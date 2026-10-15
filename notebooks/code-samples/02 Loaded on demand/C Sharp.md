---
name: C Sharp
aliases: [cs, dotnet]
tags: [code-sample, csharp]
type: sample
fence: csharp
created: 2026-10-15
updated: 2026-10-15
---

The notes tagged with a word, by LINQ, in C#. The fence is written ` ```csharp `, and `cs` and `dotnet` name it too; its grammar is not among the fifteen, so the page fetches it the first time a note names it, and draws the block highlighted once it is there.

```csharp
using System.Collections.Generic;
using System.Linq;

public record Note(string Name, string[] Tags);

public static class Notes
{
    public static IEnumerable<string> Tagged(IEnumerable<Note> notes, string tag) =>
        notes.Where(note => note.Tags.Contains(tag))
             .Select(note => note.Name)
             .OrderBy(name => name);
}
```
