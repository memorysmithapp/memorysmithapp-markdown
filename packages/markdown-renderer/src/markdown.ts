// The text helpers of the reading surface: what a note becomes before the parser reads it.
// Nothing here rewrites the note a host keeps; each function returns a new string for display.

/**
 * A note is bytes the notebook wrote, and a notebook written on Windows, or in a
 * desktop editor, or pasted from anywhere, carries CRLF. Every reader in this
 * module starts here, because a carriage return left at the end of a line is
 * invisible in the source and fatal to a regex: `.` does not match one, so
 * `(.*)$` fails on exactly the lines that have a value.
 */
export function toUnixNewlines(raw: string): string {
  return raw.replace(/\r\n?/g, '\n');
}

/**
 * Where the body of a note starts: after its frontmatter, which a host shows as properties and
 * not as prose. The cut is the one MemorySmith's reading page makes, so the ordinals of the task
 * boxes below it are counted over the whole note, as the host stores it.
 */
export function bodyStart(text: string): number {
  return text.startsWith('---') ? text.indexOf('\n---', 3) + 4 : 0;
}
