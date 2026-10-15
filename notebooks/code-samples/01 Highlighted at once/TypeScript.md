---
name: TypeScript
aliases: [ts]
tags: [code-sample, typescript]
type: sample
fence: typescript
created: 2026-10-15
updated: 2026-10-15
---

A wait that gives up after a while, and says how long it waited. The fence is written ` ```typescript `, and `ts` names it too.

```typescript
export async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Gave up after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
```
