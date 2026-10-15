---
name: Diff
aliases: []
tags: [code-sample, diff]
type: sample
fence: diff
created: 2026-10-15
updated: 2026-10-15
---

A change to a configuration, as a review shows it. The fence is written ` ```diff `.

```diff
--- a/config/backup.yaml
+++ b/config/backup.yaml
@@ -1,4 +1,4 @@
 schedule: daily
-keep_days: 3
+keep_days: 7
 target: /var/backups/notes
 compress: true
```
