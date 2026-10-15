---
name: YAML
aliases: [yml]
tags: [code-sample, yaml]
type: sample
fence: yaml
created: 2026-10-15
updated: 2026-10-15
---

A workflow that runs the tests on every pull request. The fence is written ` ```yaml `, and `yml` names it too.

```yaml
name: Tests
on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
```
