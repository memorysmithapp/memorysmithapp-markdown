---
name: CSS
aliases: []
tags: [code-sample, css]
type: sample
fence: css
created: 2026-10-15
updated: 2026-10-15
---

A card that lifts when it is pointed at, and stays still for a reader who asks for less motion. The fence is written ` ```css `.

```css
.card {
  padding: 1rem 1.25rem;
  border: 1px solid #dce0da;
  border-radius: 8px;
  transition: transform 160ms ease;
}

.card:hover {
  transform: translateY(-2px);
}

@media (prefers-reduced-motion: reduce) {
  .card { transition: none; }
}
```
