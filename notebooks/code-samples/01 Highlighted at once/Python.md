---
name: Python
aliases: [py]
tags: [code-sample, python]
type: sample
fence: python
created: 2026-10-15
updated: 2026-10-15
---

The notes not updated in a month, oldest first. The fence is written ` ```python `, and `py` names it too.

```python
from datetime import date, timedelta


def stale(notes: list[dict], days: int = 30) -> list[str]:
    """The names of the notes not updated in `days`, oldest first."""
    limit = date.today() - timedelta(days=days)
    old = [note for note in notes if note["updated"] < limit]
    return [note["name"] for note in sorted(old, key=lambda note: note["updated"])]


print(stale([{"name": "RTO", "updated": date(2026, 1, 12)}]))
```
