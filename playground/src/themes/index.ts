// The themes the playground offers: the package's default theme, MemorySmith's look, and three
// examples written against the public API only, one per level of a theme. The examples live here
// and are never published.

import { DEFAULT_THEME, type Scheme, type Theme } from '@memorysmithapp/markdown-renderer';
import { docs } from './docs.js';
import { sepia } from './sepia.js';
import { terminal } from './terminal.js';

export interface PlaygroundTheme {
  readonly theme: Theme;
  /** What the selector says. */
  readonly label: string;
  /** The page around the note, per scheme, so the pane does not frame the note in another colour. */
  readonly page: Partial<Record<Scheme, { readonly bg: string; readonly text: string; readonly soft: string; readonly line: string; readonly accent: string }>>;
}

export const THEMES: readonly PlaygroundTheme[] = [
  {
    theme: DEFAULT_THEME,
    label: 'Default',
    page: {
      light: { bg: '#edefec', text: '#0e1526', soft: '#545d73', line: '#dce0da', accent: '#0f56d7' },
      dark: { bg: '#0b1220', text: '#edefec', soft: '#93a0ba', line: '#24304a', accent: '#4c8dff' },
    },
  },
  {
    theme: sepia,
    label: 'Sepia (properties)',
    page: {
      light: { bg: '#f6efdf', text: '#3b2f22', soft: '#6e5d48', line: '#e2d6bc', accent: '#9a4b16' },
      dark: { bg: '#211b14', text: '#eadfca', soft: '#b3a68f', line: '#43382a', accent: '#e2a15f' },
    },
  },
  {
    theme: docs,
    label: 'Docs (CSS)',
    page: {
      light: { bg: '#ffffff', text: '#1f2328', soft: '#59636e', line: '#d1d9e0', accent: '#0969da' },
      dark: { bg: '#0d1117', text: '#e6edf3', soft: '#9198a1', line: '#3d444d', accent: '#4493f8' },
    },
  },
  {
    theme: terminal,
    label: 'Terminal (components)',
    page: { dark: { bg: '#0b0f0c', text: '#c8f7d0', soft: '#6fa77a', line: '#1f3324', accent: '#7ee787' } },
  },
];

export function themeNamed(name: string | null): PlaygroundTheme {
  return THEMES.find((each) => each.theme.name === name) ?? THEMES[0]!;
}

/** The schemes a theme draws in, the default theme's two when it names none. */
export function schemesOf(entry: PlaygroundTheme): readonly Scheme[] {
  return entry.theme.schemes ?? ['light', 'dark'];
}
