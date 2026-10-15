---
name: Rust
aliases: []
tags: [code-sample, rust]
type: sample
fence: rust
created: 2026-10-15
updated: 2026-10-15
---

A count of the words of a note, by word. The fence is written ` ```rust `; its grammar is not among the fifteen, so the page fetches it the first time a note names it, and draws the block highlighted once it is there.

```rust
use std::collections::HashMap;

fn word_counts(text: &str) -> HashMap<String, usize> {
    let mut counts = HashMap::new();
    for word in text.split_whitespace() {
        *counts.entry(word.to_lowercase()).or_insert(0) += 1;
    }
    counts
}

fn main() {
    let counts = word_counts("a note is a note");
    println!("{:?}", counts.get("note"));
}
```
