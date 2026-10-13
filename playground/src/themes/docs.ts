// Level 2: a theme whose look is its own stylesheet, `docs.css`, scoped by the class the root of
// a note carries, `.markdown-theme-docs`. It sets two faces as properties and draws the rest in CSS:
// a sober documentation site, with zebra tables, ruled headings and a different code frame.

import { defineTheme } from '@memorysmithapp/markdown-renderer';
import './docs.css';

export const docs = defineTheme({
  name: 'docs',
  properties: {
    fontSans: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
    fontHeading: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
    fontMono: "'IBM Plex Mono', ui-monospace, monospace",
  },
});
