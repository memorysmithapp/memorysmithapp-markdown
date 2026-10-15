---
name: Dockerfile
aliases: [dockerfile]
tags: [code-sample, docker]
type: sample
fence: docker
created: 2026-10-15
updated: 2026-10-15
---

An image that serves the notes, built in two stages. The fence is written ` ```docker `, and `dockerfile` names it too; its grammar is not among the fifteen, so the page fetches it the first time a note names it, and draws the block highlighted once it is there.

```docker
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```
