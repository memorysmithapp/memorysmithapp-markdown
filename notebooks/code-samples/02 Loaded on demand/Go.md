---
name: Go
aliases: []
tags: [code-sample, go]
type: sample
fence: go
created: 2026-10-15
updated: 2026-10-15
---

A server that answers that it is alive. The fence is written ` ```go `; its grammar is not among the fifteen, so the page fetches it the first time a note names it, and draws the block highlighted once it is there.

```go
package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "ok")
	})
	http.ListenAndServe(":8080", nil)
}
```
