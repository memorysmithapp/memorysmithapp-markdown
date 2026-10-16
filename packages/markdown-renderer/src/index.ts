// The entry point of @memorysmithapp/markdown-renderer.
export { NoteBody, type NoteBodyProps, type NoteMode } from './NoteBody.js';
// Types only: the editor, which follows them, stays on its own subpath until a note is edited.
export type { SaveAction, SaveNotice, SaveOutcome, SaveRefusal } from './edit/saves.js';
export type { AttachAttributes, AttachmentRequest, EmbeddedNote, KeptFile, KeptFileEntry, LinkChoiceNote, LinkChoices, LinkRequest, NoteHost } from './host.js';
export { ENGLISH, type EditorWords, type NoteStrings, type NoteStringsInput } from './strings.js';
export {
  customPropertyOf,
  DEFAULT_THEME,
  defineTheme,
  THEME_PROPERTIES,
  THEME_SLOTS,
  type BlockquoteSlotProps,
  type CalloutSlotProps,
  type CodeBlockSlotProps,
  type DiagramSlotProps,
  type EmbedSlotProps,
  type FootnotesSlotProps,
  type HeadingSlotProps,
  type InlineCodeSlotProps,
  type ModeSwitchSlotProps,
  type AttachmentSlotProps,
  type PropertiesSlotProps,
  type Scheme,
  type TableSlotProps,
  type TaskBoxSlotProps,
  type Theme,
  type ThemeComponents,
  type ThemeProperties,
  type WikilinkSlotProps,
} from './theme.js';
export { followable } from './address.js';
export { readDimensions, readImageAlt, type ImageAlt } from './image-dimensions.js';
export {
  codeRegions,
  fenceRegions,
  headingKey,
  remoteImageHosts,
  resolveWikilinks,
  splitFrontmatter,
  tableRegions,
  toUnixNewlines,
  type SplitDocument,
} from './markdown.js';
export { ordinalAt, taskBoxes, taskCheckedAt, toggleTaskAt } from './tasklist.js';
export { readProperties, type NoteProperties, type PropertyEntry, type PropertyShape } from './properties.js';
export { DELEGATED_TO_THE_BASE_PARSER, unclassified } from './delegated.js';
