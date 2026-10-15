---
name: SQL
aliases: []
tags: [code-sample, sql]
type: sample
fence: sql
created: 2026-10-15
updated: 2026-10-15
---

The tags most notes carry, with how many carry each. The fence is written ` ```sql `.

```sql
SELECT tag, COUNT(*) AS notes
FROM note_tags
JOIN notes ON notes.id = note_tags.note_id
WHERE notes.notebook_id = 42
GROUP BY tag
ORDER BY notes DESC
LIMIT 10;
```
