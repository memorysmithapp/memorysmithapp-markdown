---
name: Java
aliases: []
tags: [code-sample, java]
type: sample
fence: java
created: 2026-10-15
updated: 2026-10-15
---

A record of a note and the one rule that keeps its name. The fence is written ` ```java `.

```java
import java.time.LocalDate;

public record Note(String name, LocalDate updated) {
    public Note {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("A note needs a name");
        }
    }

    public boolean isStale(int days) {
        return updated.plusDays(days).isBefore(LocalDate.now());
    }
}
```
