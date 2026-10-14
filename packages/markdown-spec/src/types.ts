// The types of the specification's data, written once beside it, so that a consumer imports them
// instead of retyping the JSON. A hand-retyped response is the defect they exist to prevent: the
// copy compiles, and drifts from the data in silence.
//
// They follow `schema/spec.schema.json` for `spec.json`, and `tests/README.md` for a conformance
// case. A test compiles every notation and every case of the JSON against them, and compiles a
// value the schema refuses to prove that they refuse it too.

/**
 * Who decides a notation. `links` and `frontmatter` are the two readers of content an indexer has;
 * `reading-surface` is display, proved by a renderer rather than by a conformance case.
 */
export type NotationReader = 'links' | 'frontmatter' | 'reading-surface';

/** Where the forms of the specification were established. A lineage, not a tier. */
export interface SpecSource {
  readonly id: string;
  readonly name: string;
  /** Absent for a source that publishes documentation rather than a versioned specification. */
  readonly version?: string;
  readonly url: string;
}

/** One notation the specification declares, with its observable effect. */
export interface Notation {
  /** Stable identifier: never renamed and never reused. */
  readonly id: string;
  readonly reader: NotationReader;
  /** The form, as an author would type it. */
  readonly syntax: string;
  /** A body exercising the form. */
  readonly example: string;
  /** What observably happens, written for whoever writes a note. */
  readonly effect: string;
  /** The section or sections of `SPEC.md` that govern it, comma-separated. */
  readonly spec?: string;
}

/** How much a notice weighs: `notice`, the page differs from what was typed; `hint`, nothing is drawn wrong. */
export type NoticeSeverity = 'notice' | 'hint';

/** One notice an implementation may report about a note (`SPEC.md` §7.13). Never an error. */
export interface NoticeDeclaration {
  /** Stable identifier: never renamed and never reused. */
  readonly code: string;
  readonly severity: NoticeSeverity;
  /** The section of `SPEC.md` that decides what happens there. */
  readonly spec: string;
  /** What a reader gets, written for whoever writes a note. */
  readonly effect: string;
}

/** `spec.json`: the machine-readable half of the specification. */
export interface Spec {
  readonly $schema?: string;
  /** The name of the specification, the same in both data files. */
  readonly spec: string;
  /** The value of the `variant` parameter of `text/markdown`, per RFC 7763. */
  readonly variant?: string;
  /** `SPEC.md` at the tag of the version this data was published with. */
  readonly url?: string;
  readonly sources: readonly SpecSource[];
  readonly notations: readonly Notation[];
  readonly notices: readonly NoticeDeclaration[];
}

/** One edge a conforming indexer extracts: the name it addresses, and the anchor, if any. */
export interface ConformanceLink {
  readonly name: string;
  readonly anchor: string | null;
}

/** The kind of attribute a frontmatter value becomes (`SPEC.md` §6.3). */
export type FacetKind = 'enum' | 'list' | 'boolean' | 'date';

export interface ConformanceFacet {
  readonly kind: FacetKind;
  readonly values: readonly string[];
}

/** What a target becomes once a notebook exists to resolve it against. */
export type ResolutionKind = 'note' | 'attachment' | 'pending';

export interface ConformanceResolution {
  readonly target: string;
  readonly kind: ResolutionKind;
  /** Only a note produces an edge, one per note that matches. */
  readonly edges: number;
}

/** One notice a case raises: its code and the line it starts on, counted from 1 over the whole document. */
export interface ConformanceNotice {
  readonly code: string;
  readonly line: number;
}

/** The notes and attachments that exist while a case runs. */
export interface ConformanceNotebook {
  /** Whole Markdown documents; a fixture never declares its own name outside its document. */
  readonly notes?: readonly string[];
  /** Names of kept files. */
  readonly attachments?: readonly string[];
}

interface CaseBase {
  /** Stable identifier of the case: never renamed and never reused. */
  readonly id: string;
  /** The `id` of the notation this case exercises. */
  readonly notation: string;
  /** The input, verbatim, frontmatter included. */
  readonly markdown: string;
  /**
   * The name the note carries (`SPEC.md` §5.3); `null` says it has none. Absent asserts nothing.
   */
  readonly name?: string | null;
  /** The edges extracted, in any order. Absent asserts nothing; `[]` asserts there are none. */
  readonly links?: readonly ConformanceLink[];
  /** The attributes produced. Absent asserts nothing; `{}` asserts there are none. */
  readonly facets?: Readonly<Record<string, ConformanceFacet>>;
  /**
   * Every notice the input raises (`SPEC.md` §7.13), hints included, in any order. Absent asserts
   * nothing; `[]` asserts there are none.
   */
  readonly notices?: readonly ConformanceNotice[];
}

/**
 * One case of the conformance suite. A missing expectation asserts nothing, and `[]` or `{}` assert
 * that nothing is produced. `resolution` and `notebook` come together or not at all: a resolution
 * is a claim about a notebook, and a notebook is only there to be resolved against.
 */
export type ConformanceCase =
  | (CaseBase & { readonly notebook?: never; readonly resolution?: never })
  | (CaseBase & { readonly notebook: ConformanceNotebook; readonly resolution: readonly ConformanceResolution[] });

/** `tests/conformance.json`. */
export interface ConformanceSuite {
  /** The name of the specification, the same as `Spec.spec`. */
  readonly spec: string;
  readonly cases: readonly ConformanceCase[];
}
