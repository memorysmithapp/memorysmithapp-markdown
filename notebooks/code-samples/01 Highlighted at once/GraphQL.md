---
name: GraphQL
aliases: []
tags: [code-sample, graphql]
type: sample
fence: graphql
created: 2026-10-15
updated: 2026-10-15
---

The notes of a notebook that link to one note, with their titles. The fence is written ` ```graphql `.

```graphql
query Backlinks($notebook: ID!, $name: String!) {
  notebook(id: $notebook) {
    note(name: $name) {
      backlinks(first: 10) {
        name
        updated
      }
    }
  }
}
```
