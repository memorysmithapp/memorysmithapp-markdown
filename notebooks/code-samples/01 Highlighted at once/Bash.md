---
name: Bash
aliases: [sh, shell]
tags: [code-sample, bash]
type: sample
fence: bash
created: 2026-10-15
updated: 2026-10-15
---

A backup that keeps the last seven days and says what it removed. The fence is written ` ```bash `, and `sh` and `shell` name it too.

```bash
#!/usr/bin/env bash
set -euo pipefail

backup_dir="/var/backups/notes"
stamp="$(date +%Y-%m-%d)"

tar -czf "${backup_dir}/notes-${stamp}.tar.gz" /srv/notes
find "$backup_dir" -name 'notes-*.tar.gz' -mtime +7 -print -delete
echo "Backup ${stamp} written to ${backup_dir}"
```
