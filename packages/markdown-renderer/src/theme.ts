/**
 * Themes: how a note looks, written by whoever draws it.
 *
 * A theme decides how a note LOOKS, at three levels a developer can mix:
 *
 * 1. **Properties** — the values the stylesheet reads, by name. The renderer
 *    writes them on the root of the note as `--markdown-*` custom properties,
 *    so a theme that only sets values needs no CSS of its own.
 * 2. **Its own CSS** — the root carries `markdown-theme-<name>`, so a theme's
 *    stylesheet reaches anything inside the note and nothing outside it.
 * 3. **Components** — a closed set of slots (`ThemeComponents`), each given the
 *    notation already interpreted, which only draw it.
 *
 * What a notation MEANS is never a theme's: the parsing, the resolution of a
 * wikilink, the address filter, the refusal of raw HTML, the ordinal a task box
 * reports and the numbering of footnotes happen before a slot is called, and a
 * slot is handed their result and no way around it.
 *
 * MemorySmith's look is the theme `default`: the package's stylesheet with no
 * property set. It is the theme every other one starts from, since a property
 * is read by the default theme's rules.
 */

import type { ReactNode } from 'react';
import type { PropertyEntry } from './properties.js';

export type Scheme = 'light' | 'dark';

/**
 * Every value the stylesheet reads, by name. Each becomes `--markdown-<name in
 * kebab case>`; a value is any CSS the property takes. One left out keeps the
 * default theme's value for the scheme being drawn.
 */
export interface ThemeProperties {
  // The paper and the ink.
  readonly bg?: string;
  readonly surface?: string;
  readonly border?: string;
  readonly text?: string;
  readonly textSoft?: string;
  readonly accent?: string;
  readonly pending?: string;
  // Code.
  readonly codeBg?: string;
  readonly codeColor?: string;
  readonly codeBorder?: string;
  readonly inlineCodeBg?: string;
  readonly inlineCodePadding?: string;
  readonly tokenKeyword?: string;
  readonly tokenString?: string;
  readonly tokenNumber?: string;
  readonly tokenComment?: string;
  readonly tokenPunctuation?: string;
  // Callouts: each family's hue, as an RGB triplet (`15, 86, 215`), so a tint
  // can be laid at any alpha.
  readonly calloutInfo?: string;
  readonly calloutIdea?: string;
  readonly calloutDone?: string;
  readonly calloutWarn?: string;
  readonly calloutStop?: string;
  readonly calloutAside?: string;
  readonly calloutQuote?: string;
  // Callout icons, as CSS images used as masks (`url("data:image/svg+xml,…")`),
  // which take the colour of the callout.
  readonly iconNote?: string;
  readonly iconInfo?: string;
  readonly iconSummary?: string;
  readonly iconTip?: string;
  readonly iconSuccess?: string;
  readonly iconQuestion?: string;
  readonly iconWarning?: string;
  readonly iconFailure?: string;
  readonly iconDanger?: string;
  readonly iconExample?: string;
  readonly iconQuote?: string;
  // Faces.
  readonly fontSans?: string;
  readonly fontDisplay?: string;
  readonly fontMono?: string;
  readonly fontHeading?: string;
  // Shape.
  readonly radius?: string;
  readonly radiusLarge?: string;
  // Metrics.
  readonly fontSize?: string;
  readonly lineHeight?: string;
  readonly lineHeightTight?: string;
  readonly rootLineHeight?: string;
  readonly paragraphSpacing?: string;
  readonly headingSpacing?: string;
  readonly listIndent?: string;
  readonly listSpacing?: string;
  // Headings.
  readonly headingWeight?: string;
  readonly headingColor?: string;
  readonly h1Size?: string;
  readonly h2Size?: string;
  readonly h3Size?: string;
  readonly h4Size?: string;
  readonly h5Size?: string;
  readonly h6Size?: string;
  readonly h1Weight?: string;
  readonly h6Color?: string;
  // Quotations.
  readonly quoteBorderColor?: string;
  readonly quoteBorderWidth?: string;
  readonly quoteColor?: string;
  // Tables.
  readonly tableBorder?: string;
  readonly tableCellPadding?: string;
  readonly tableHeaderBg?: string;
  readonly tableHeaderRule?: string;
  readonly tableStripeBg?: string;
  readonly tableHoverBg?: string;
  // Embeds.
  readonly embedRule?: string;
  // The note's title and properties, as the default theme draws its frontmatter.
  readonly titleFont?: string;
  readonly titleSize?: string;
  readonly titleWeight?: string;
  readonly titleColor?: string;
  readonly propertiesRule?: string;
  readonly propertiesLabelFont?: string;
  readonly propertiesLabelColor?: string;
  readonly propertiesKeyColor?: string;
  // The icon of a property's key by the shape of its value, as a CSS image used as a mask.
  readonly iconPropertyText?: string;
  readonly iconPropertyList?: string;
  readonly iconPropertyDate?: string;
  readonly iconPropertyBoolean?: string;
  readonly chipBg?: string;
  readonly chipColor?: string;
  readonly chipFont?: string;
}

/** The names of `ThemeProperties`, in the order the documentation lists them. */
export const THEME_PROPERTIES = Object.keys({
  bg: 1, surface: 1, border: 1, text: 1, textSoft: 1, accent: 1, pending: 1,
  codeBg: 1, codeColor: 1, codeBorder: 1, inlineCodeBg: 1, inlineCodePadding: 1,
  tokenKeyword: 1, tokenString: 1, tokenNumber: 1, tokenComment: 1, tokenPunctuation: 1,
  calloutInfo: 1, calloutIdea: 1, calloutDone: 1, calloutWarn: 1, calloutStop: 1, calloutAside: 1, calloutQuote: 1,
  iconNote: 1, iconInfo: 1, iconSummary: 1, iconTip: 1, iconSuccess: 1, iconQuestion: 1, iconWarning: 1,
  iconFailure: 1, iconDanger: 1, iconExample: 1, iconQuote: 1,
  fontSans: 1, fontDisplay: 1, fontMono: 1, fontHeading: 1,
  radius: 1, radiusLarge: 1,
  fontSize: 1, lineHeight: 1, lineHeightTight: 1, rootLineHeight: 1, paragraphSpacing: 1, headingSpacing: 1,
  listIndent: 1, listSpacing: 1,
  headingWeight: 1, headingColor: 1, h1Size: 1, h2Size: 1, h3Size: 1, h4Size: 1, h5Size: 1, h6Size: 1,
  h1Weight: 1, h6Color: 1,
  quoteBorderColor: 1, quoteBorderWidth: 1, quoteColor: 1,
  tableBorder: 1, tableCellPadding: 1, tableHeaderBg: 1, tableHeaderRule: 1, tableStripeBg: 1, tableHoverBg: 1,
  embedRule: 1,
  titleFont: 1, titleSize: 1, titleWeight: 1, titleColor: 1,
  propertiesRule: 1, propertiesLabelFont: 1, propertiesLabelColor: 1, propertiesKeyColor: 1,
  iconPropertyText: 1, iconPropertyList: 1, iconPropertyDate: 1, iconPropertyBoolean: 1,
  chipBg: 1, chipColor: 1, chipFont: 1,
} satisfies Record<keyof ThemeProperties, 1>) as (keyof ThemeProperties)[];

/** `textSoft` → `--markdown-text-soft`, `h1Size` → `--markdown-h1-size`. */
export function customPropertyOf(name: keyof ThemeProperties): string {
  return `--markdown-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

// ── The slots ────────────────────────────────────────────────────────────────

/** A callout (§7.1), with its kind already read and its title already chosen. */
export interface CalloutSlotProps {
  /** The kind as written, lower-cased: `warning`, `tip`, a kind nobody declared. */
  readonly kind: string;
  /** The fold marker written after the kind: `+`, `-`, or none. */
  readonly fold: '+' | '-' | null;
  /** The title: the author's, or the kind in the reader's words. */
  readonly title: ReactNode;
  /** The icon the theme gives this kind, or `null` when the stylesheet draws it. */
  readonly icon: ReactNode;
  /** The body. */
  readonly children: ReactNode;
}

/** A table; each cell already carries its alignment. */
export interface TableSlotProps {
  /** The alignment of each column, from the delimiter row. */
  readonly align: readonly ('left' | 'center' | 'right' | null)[];
  /** The `thead` and `tbody`, drawn. */
  readonly children: ReactNode;
}

/** A fenced block of code other than a diagram. */
export interface CodeBlockSlotProps {
  /** The info string's language, or `null`. */
  readonly language: string | null;
  /** The code exactly as typed, which is what Copy copies. */
  readonly code: string;
  /** The code drawn: the `<code>` element, highlighted when the language is known. */
  readonly children: ReactNode;
  /** The Copy button, drawn; a theme places it or leaves it out. */
  readonly copy: ReactNode;
}

/** A code span. */
export interface InlineCodeSlotProps {
  readonly children: ReactNode;
}

/** A heading. */
export interface HeadingSlotProps {
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly children: ReactNode;
}

/** A quotation that is not a callout. */
export interface BlockquoteSlotProps {
  readonly children: ReactNode;
}

/** A note embedded in place (§7.3), in each state the page shows. */
export interface EmbedSlotProps {
  /**
   * `ready`: the content and its caption; `section-missing`: the note answered
   * and the section or block did not; `loading`: the host has not answered
   * yet; `pending`: no single note answers the target.
   */
  readonly state: 'ready' | 'section-missing' | 'loading' | 'pending';
  /** The target as written, and its anchor. */
  readonly target: string;
  readonly anchor: string | null;
  /** The note it came from, linked through the host when it has an address; `null` until it is known. */
  readonly caption: ReactNode;
  /** What the default theme draws for this state: the content, the notice, the skeleton or the pending marker. */
  readonly children: ReactNode;
}

/** The notes of a note, gathered at its end (§7.12). */
export interface FootnotesSlotProps {
  /** The heading, in the reader's words. */
  readonly label: string;
  /** The ordered list of the notes, each with its way back. */
  readonly children: ReactNode;
}

/** A task box (§7.4). */
export interface TaskBoxSlotProps {
  readonly checked: boolean;
  /** Whether a tick is reported: the note is writable and the box can be mapped back to its bytes. */
  readonly enabled: boolean;
  /** Reports the tick to the host; does nothing when the box is not enabled. */
  readonly toggle: () => void;
}

/** A wikilink to a note (§5.2). */
export interface WikilinkSlotProps {
  /** True when no note answers the target: the link is drawn as pending. */
  readonly pending: boolean;
  /** The text of the link. */
  readonly children: ReactNode;
  /**
   * Draws a label as the link — through the host's router to the address the
   * host resolved, or as the pending marker. It is the only way to the
   * address: a slot decorates the link and never chooses where it goes.
   */
  readonly link: (label: ReactNode) => ReactNode;
}

/** A `mermaid` fence (§7.2). */
export interface DiagramSlotProps {
  readonly source: string;
  /** `loading` while Mermaid draws; `failed` when it cannot, and the source is shown. */
  readonly state: 'loading' | 'ready' | 'failed';
  /** What the default theme draws for this state: the SVG, the space it will take, or the source. */
  readonly children: ReactNode;
}

/**
 * A note's frontmatter (§6), read: what the theme draws above the body, or does not. The default
 * theme draws `name` as the title and each entry by its shape.
 */
export interface PropertiesSlotProps {
  /** `name:` when it is a single text value, else `null` (§6.5). */
  readonly name: string | null;
  /** Every other entry, in the order written, each with its shape (§6.3). */
  readonly entries: readonly PropertyEntry[];
  /**
   * Draws a value as the note means it: each wikilink in it as a link the host resolved — the
   * note, the choice or the pending marker — and the rest as text. It is the only way to those
   * links: a slot decides how a value looks, never where its links go.
   */
  readonly value: (text: string) => ReactNode;
}

/** The slots a theme may fill. Each one left out is drawn as the default theme draws it. */
export interface ThemeComponents {
  readonly callout: (props: CalloutSlotProps) => ReactNode;
  readonly calloutIcon: (props: { readonly kind: string }) => ReactNode;
  readonly table: (props: TableSlotProps) => ReactNode;
  readonly codeBlock: (props: CodeBlockSlotProps) => ReactNode;
  readonly inlineCode: (props: InlineCodeSlotProps) => ReactNode;
  readonly heading: (props: HeadingSlotProps) => ReactNode;
  readonly blockquote: (props: BlockquoteSlotProps) => ReactNode;
  readonly embed: (props: EmbedSlotProps) => ReactNode;
  readonly footnotes: (props: FootnotesSlotProps) => ReactNode;
  readonly taskBox: (props: TaskBoxSlotProps) => ReactNode;
  readonly wikilink: (props: WikilinkSlotProps) => ReactNode;
  readonly diagram: (props: DiagramSlotProps) => ReactNode;
  readonly properties: (props: PropertiesSlotProps) => ReactNode;
}

/** The names of the slots, in the order the documentation lists them. */
export const THEME_SLOTS = Object.keys({
  callout: 1, calloutIcon: 1, table: 1, codeBlock: 1, inlineCode: 1, heading: 1, blockquote: 1,
  embed: 1, footnotes: 1, taskBox: 1, wikilink: 1, diagram: 1, properties: 1,
} satisfies Record<keyof ThemeComponents, 1>) as (keyof ThemeComponents)[];

export interface Theme {
  /**
   * What the root of a note carries as `markdown-theme-<name>`, which scopes the
   * theme's own CSS: lower case, a letter first, then letters, digits and
   * hyphens.
   */
  readonly name: string;
  /** The schemes the theme draws in. Defaults to both; a theme of one is drawn in it whatever is asked. */
  readonly schemes?: readonly Scheme[];
  /** Values for every scheme, or for each scheme apart. */
  readonly properties?: ThemeProperties | { readonly light?: ThemeProperties; readonly dark?: ThemeProperties };
  /** An icon per callout kind, drawn in the title in place of the stylesheet's. */
  readonly icons?: Readonly<Record<string, ReactNode>>;
  /** The slots the theme fills. */
  readonly components?: Partial<ThemeComponents>;
}

const NAME = /^[a-z][a-z0-9-]*$/;

/**
 * A theme, checked: its name can be a class, and every property and slot it
 * names exists. It returns the theme as given; define it once, outside a
 * component, so the note is not drawn again on every render.
 */
export function defineTheme<T extends Theme>(theme: T): T {
  if (!NAME.test(theme.name)) {
    throw new Error(`A theme's name is lower case, a letter first, then letters, digits and hyphens: "${theme.name}"`);
  }
  const known = new Set<string>(THEME_PROPERTIES);
  for (const values of propertySets(theme)) {
    for (const key of Object.keys(values)) {
      if (!known.has(key)) throw new Error(`The theme "${theme.name}" sets "${key}", which is not a theme property`);
    }
  }
  const slots = new Set<string>(THEME_SLOTS);
  for (const key of Object.keys(theme.components ?? {})) {
    if (!slots.has(key)) throw new Error(`The theme "${theme.name}" fills "${key}", which is not a slot`);
  }
  return theme;
}

/** MemorySmith's look: the package's stylesheet, with nothing set over it. */
export const DEFAULT_THEME: Theme = { name: 'default' };

function isPerScheme(
  properties: NonNullable<Theme['properties']>,
): properties is { readonly light?: ThemeProperties; readonly dark?: ThemeProperties } {
  return 'light' in properties || 'dark' in properties;
}

function propertySets(theme: Theme): ThemeProperties[] {
  const properties = theme.properties;
  if (!properties) return [];
  return isPerScheme(properties) ? [properties.light ?? {}, properties.dark ?? {}] : [properties];
}

/** The scheme a theme is drawn in, given the one asked for. */
export function schemeOf(theme: Theme, asked: Scheme): Scheme {
  const schemes = theme.schemes ?? ['light', 'dark'];
  return schemes.includes(asked) ? asked : (schemes[0] ?? asked);
}

/** The custom properties the root of a note carries for a theme in a scheme. */
export function rootStyle(theme: Theme, scheme: Scheme): Record<string, string> {
  const properties = theme.properties;
  if (!properties) return {};
  const values = isPerScheme(properties) ? (properties[scheme] ?? {}) : properties;
  const style: Record<string, string> = {};
  for (const name of THEME_PROPERTIES) {
    const value = values[name];
    if (value !== undefined) style[customPropertyOf(name)] = value;
  }
  return style;
}
