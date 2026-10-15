---
name: INI
aliases: []
tags: [code-sample, ini]
type: sample
fence: ini
created: 2026-10-15
updated: 2026-10-15
---

The settings of a small service, in sections. The fence is written ` ```ini `.

```ini
; The service and where it keeps its notes
[service]
name = notes-api
port = 8080

[storage]
path = /srv/notes
keep_days = 7
```
