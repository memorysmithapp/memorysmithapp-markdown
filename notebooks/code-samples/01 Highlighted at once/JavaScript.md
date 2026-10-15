---
name: JavaScript
aliases: [js]
tags: [code-sample, javascript]
type: sample
fence: javascript
created: 2026-10-15
updated: 2026-10-15
---

The names of the notes a text links to, each once. The fence is written ` ```javascript `, and `js` names it too.

```javascript
const WIKILINK = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;

export function linkedNames(text) {
  const names = new Set();
  for (const match of text.matchAll(WIKILINK)) {
    names.add(match[1].trim());
  }
  return [...names];
}

console.log(linkedNames('See [[Recovery Time Objective|RTO]] and [[Failure domain]].'));
```
