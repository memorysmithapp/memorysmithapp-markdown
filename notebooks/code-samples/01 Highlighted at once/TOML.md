---
name: TOML
aliases: []
tags: [code-sample, toml]
type: sample
fence: toml
created: 2026-10-15
updated: 2026-10-15
---

A project file, in the form most tools read. The fence is written ` ```toml `.

```toml
[project]
name = "notes-sync"
version = "0.4.0"
requires-python = ">=3.11"

[project.scripts]
notes-sync = "notes_sync.cli:main"

[tool.notes]
keep_days = 7
```
