/**
 * The entries of the specification whose rendering this renderer does NOT
 * assert, because the base parser is what produces them.
 *
 * **This list is the renderer's decision, and it used to be a field.** Until
 * specification v0.4.0 every entry carried a `ring`, and the reading-surface
 * expectations were scoped to everything outside the `base` one. The
 * specification dropped the tier for a good reason: an implementation is asked
 * for the notation the document lists and not for a specification in full. But
 * the reason the guard was scoped did not go away with the field, so the scope
 * is written here instead of being inferred from data that no longer says it.
 *
 * The reason: asserting that emphasis renders as `<em>` is a claim about
 * react-markdown and not about this surface. CommonMark is the floor every
 * renderer already stands on; what the conformance test proves is what the
 * specification adds on top of it.
 *
 * **Two things this list is not.**
 *
 * It is not a claim that these forms are untested: the crossings — where the
 * specification changes what a base form MEANS, such as a link inside a code
 * span, an embed that looks like an image, or `---` under a paragraph — are
 * asserted by hand in the conformance test.
 *
 * And it is not allowed to silently absorb a new entry. The conformance test
 * asserts that every `reading-surface` entry is either expected there or listed
 * here, so a form the specification adds in a later version fails the build
 * until somebody classifies it.
 */
export const DELEGATED_TO_THE_BASE_PARSER: ReadonlySet<string> = new Set([
  'paragraph',
  'backslash-escape',
  'character-reference',
  'heading-atx',
  'heading-setext',
  'thematic-break',
  'block-quote',
  'list-bullet',
  'list-ordered',
  'code-fenced',
  'code-indented',
  'link-reference-definition',
  'code-span',
  'emphasis',
  'strong',
  'strong-emphasis',
  'link-inline',
  'link-reference',
  'image',
  'autolink',
  'hard-line-break',
]);

/**
 * The `reading-surface` entries of a specification that are neither asserted
 * nor delegated: the ones a renderer would silently not implement. Empty is the
 * only answer a conforming renderer gives.
 */
export function unclassified(
  notations: ReadonlyArray<{ readonly id: string; readonly reader: string }>,
  asserted: ReadonlySet<string>,
  delegated: ReadonlySet<string> = DELEGATED_TO_THE_BASE_PARSER,
): string[] {
  return notations
    .filter((entry) => entry.reader === 'reading-surface')
    .map((entry) => entry.id)
    .filter((id) => !asserted.has(id) && !delegated.has(id));
}
