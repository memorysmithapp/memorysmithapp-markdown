# Changelog

All notable changes to this repository are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this repository adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.2] - 2026-10-17

### Changed

- The playground's demonstration notes write one paragraph per line rather than wrapping it at 78 characters, as MemorySmith's notes do, so in edit mode a paragraph fills the column as its callouts do, where each source line had ended short of it (#118). Every soft break inside a paragraph, a list item or a quotation became a space; hard breaks, a callout's title line, code, formulas, tables, the frontmatter and comments are as they were. Every note draws the same in reading mode, and the comparison with MemorySmith finds the same 88 identical pairs and 44 deliberate.

### Fixed

- Resizing an image from its handle near the end of a note moves only the text below it: the top of the picture stays where it is on the screen and the handle under the pointer, whether the editor scrolls itself, in a pane of the host or in the window (#116). Shrinking it made the page shorter than where it was scrolled to, so everything above came down, as much as 169 pixels in Chromium, and growing it after that, the browser's scroll anchoring made it grow upward. While the handle is dragged the note has room after its last line for as much as the picture may shrink, the anchoring is off, and any move of the picture's top is scrolled back; the room stays after the release, so the page does not jump, and is given back as the author scrolls up.

## [0.8.1] - 2026-10-16

### Fixed

- A click or a touch on an image in edit mode no longer shows its source: the picture is sized in place, as a table is edited in place, and like a table it shows its Markdown from a *Source* button among its controls, or when the caret reaches it from the keyboard (#112). An embed with no picture, a kept file's card, still shows its source at a click, having no controls. A link around an image is followed with Ctrl or Cmd held, which in edit mode did nothing, since the editor received no press from inside a drawn image.
- An image whose width is a share of the page, `|50%`, is drawn in edit mode at that share of the column the note is read at, as reading mode draws it, rather than at that share of the frame around the picture, which shrank it: a 192px picture at `|21%` in a 700px column was drawn 40px wide, and switching its unit back to pixels wrote `|40` (#113). Switching to `%` and back with nothing changed between writes the size it had, its height included, rather than the width the share rounds to.
- A double click in edit mode selects the word it starts on, and a triple click its line, beside a formatted run too (#114). The first press moved the caret, which showed the markers beside it or hid the ones it left and moved the rest of the line under the pointer by their width, so the second press selected the marker or the next word: bolding a word and then double-clicking the next one to italicize it italicized `**`. The second and third presses are now read where the first one fell.

## [0.8.0] - 2026-10-16

### Added

- An image's width may be a share of the page, `|50%`, from `1%` to `100%`, in a Markdown image, `![Curva|50%](…)`, and in the embed of a kept file, `![[curva.png|50%]]` (`SPEC.md` §3.14 and §5.8). It is a share of the width the note is read at — the column, the cell or the callout it stands in — with the height following the image's ratio, and a maximum: an image narrower than it keeps its own width, so it is never enlarged and blurred. A height in percent, a mixed pair (`50%x180`), `0%`, `150%` and fractions are not dimensions and stay part of the description, and after a note's name the pipe is still the alias. The renderer draws it as a `max-width` in reading and in edit mode, `renderAttachment` and the `attachment` slot receive it as `percent`, and `readDimensions` and `readImageAlt` answer it; `writeDimensions` and the type `Dimensions` are exported. Two conformance cases hold it (#108).
- `AttachmentRequest`, what `renderAttachment` receives, carries the `description` and the `title` a Markdown image that names the file wrote, and the `attachment` slot its `title` (#104).
- The controls of an image in edit mode cover what its notation writes (#106): a width and a height with a lock between them — locked, as for `|300` or no size, the height follows and only the width is written; open, as for `|300x180`, both are — the width's unit, pixels or a share of the page (#108), a field for a Markdown image's description, which edits the text before its pipe and keeps it, the description of an embedded file shown read-only, and a handle of diagonal arrows that keeps the proportion, or with the lock open or Shift held does not, and says which in its title. `strings.editor` words them with `imageHeight`, `imageUnit`, `imageDescription`, `imageKeepRatio`, `imageFreeRatio`, `imageResizeKeep`, `imageResizeFree` and `imageOutOfRange`.

### Changed

- The controls of an image in edit mode stand under the picture rather than over its top left, often its subject, and in the flow on a screen with no hover; the handle is a 24px target at the picture's corner, and the button back to its own size has the icon of an undo rather than that of a link out of the page. `strings.editor.imageWidth` is *Width*, its unit beside it (#106).
- The description of an image is its hover hint as well as its `alt`: a picture's `title`, in reading and in edit mode, is the description written before its pipe, or for an embed the kept file's own, so a person who sees the picture can read what its author said of it — before, it was heard by a screen reader or seen when the picture failed to load, and nothing else. A title written after the destination, `![Curva](curva.png "Safra 2026")`, keeps its place, the dimensions are never part of it, and a kept picture with no description has its name as its `alt` and no hint (#109).
- An image whose destination names no host — `![Curva|300](../assets/curva-2026.png)`, the form a vault exported from a desktop editor writes — is the file the notebook keeps under the last segment of its path, as `SPEC.md` §5.8 now states without contradicting itself: its query and fragment dropped, percent-decoded, `/` and `\` separating, case-exact, and a file only, never a note. It is drawn as `![[curva-2026.png]]` is, in reading and in edit mode — an image at the dimensions after its pipe, with its description as the `alt`, the file's own when it wrote none, and its title kept; a player; or a card with its description as the text — and a name nothing is kept under shows its description marked pending, and is never asked of a path under the page, where it drew nothing but a 404. `diagnose` reports it as `embed-pending`. Thirteen conformance cases hold the rule, and the example of `image-dimensions` in `spec.json` is a remote image, since `engelbart.jpg` now names a kept file (#104).
- `readDimensions` answers `width: null` and `percent` for a share of the page, so its `width` is `number | null`; every answer and `readImageAlt`'s carry `percent` (#108).
- The menu of a right-click in edit mode opens with Cut, Copy and Paste, as every other context menu a person knows does, before *Format* and *Insert*, which keep their order. The focus lands on the first entry that runs: Cut with a selection, Paste without one (#110).

### Fixed

- The width field of an image in edit mode replaces its value when the author types, rather than appending to it: it selects what it holds when a click, a double click or Tab gives it the focus. A size a reader would not see — under 16 pixels, past the wider of the text column and the picture's own width, or anything but digits — is refused where it was typed, the field marked and saying the range, and the note keeps its size, where `200` followed by `180` wrote `|99999` and a small one `|1`. It is a text field, with no spinner of its own (#105).
- A press or a touch on an image's controls in edit mode no longer shows the image's source. A press between two controls, beside a field or on the space between the picture and its controls put the editor's caret where it fell, in Chromium, and the image was drawn as its notation; a touch on a control, or the click a touch leaves behind on the picture, could do the same; and on a touch screen a write from a button scrolled the page a screen away from the image. None of them does now: the press keeps the caret where it was, the frame holds the image's reveal-on-click off while a control has the focus, the handle is dragged and for a moment after a touch, and the image is held on the screen after a write. A click on the picture itself still shows its source (#107).

## [0.7.1] - 2026-10-16

### Fixed

- A click on a drawn callout in edit mode puts the caret where the author clicked, in the line of its source that draws the text clicked, rather than at the end of its title line, where the next key was typed. The same holds for a diagram or an embed whose drawing shows text its source writes; elsewhere the caret goes to the end of the block's first line, as before (#102).
- A save the host refuses with choices — another person wrote the note — opens its dialog by itself, rather than turning the status into a small icon the author had to notice and click. Until the author chooses, the note is held: the caret still moves, a key that would write opens the dialog again, and the status says so in `strings.editor.chooseToEdit`, so changes no longer pile up behind saves that are all refused. An alert with choices opens by itself too, and never holds the note (#101).

## [0.7.0] - 2026-10-16

### Added

- `NoteBody` takes `buttons`, one option for every button it draws around a note: *Show Markdown*, *Copy Markdown* and the switch at its top right, and *Copy* in the dialog of *Show Markdown*. `icon`, the default, draws each as its icon alone; `label`, its icon and its word; `responsive`, its word beside its icon on a note at least 560px wide and its icon alone on a narrower one, measured on the note and not on the window, so a host draws MemorySmith's rule of a word on a computer and an icon on a phone. A host moves the threshold with `--markdown-button-words-from`, or a theme's `buttonWordsFrom`. Wherever the word is not drawn or may be hidden it is the button's name and title, the dialog's *Copy* included, which also gets the icon of *Copy Markdown*. `NoteEditor` takes `buttons` too, and the type `NoteButtons` is exported. The playground's `?button=responsive` shows it (#96).

- An image in edit mode is sized where it is drawn: over it, a field with the width it is drawn at, its height following, and a button back to its own size, and at its corner a handle that drags it. Each writes only the dimensions of its notation — `![description|300](address)` (`SPEC.md` §3.14) or `![[photo.jpg|300]]` (§5.7) — and reading draws it at that size. A kept file is offered a size only once it is drawn as an image, and an embed whose pipe holds anything but dimensions is offered none. On a screen with no hover the controls are always shown. `strings.editor` words them with `imageWidth`, `imageOwnSize` and `imageResize` (#98).

### Changed

- The buttons at the top right of a note that is read — *Show Markdown*, *Copy Markdown* and the switch — stay at the top of what is in view while the note is scrolled, as the toolbar does in edit mode, so a reader far down a long note no longer scrolls back to the top to edit or copy it. The text still flows around the place they take at the top of the note (#97).
- The `display` a theme's `modeSwitch` slot receives may also be `responsive` (#96).

### Deprecated

- `modeButton`, which governed the switch alone: `buttons` governs it with the buttons beside it. `modeButton` is still read when `buttons` is left out (#96).

### Fixed

- Typing in edit mode no longer moves the page under the author. Every drawn block — the properties, a callout, a table, an embed — was removed and drawn anew whenever the host rendered with props of a new identity, as one that shows its save's status does on the first key and after each save, and the empty blocks let the page collapse under the caret until they drew. A block made again now keeps its element and is drawn again in it — the same source keeping its React tree, a changed one replacing it at once — so typing removes or adds no block, a host's render with the same meaning redraws none in a way the page sees, and a block that is made anew holds the height it was drawn at until it is drawn. The playground's `?host=unstable` gives the host's functions anew on every render (#99).
- The page in edit mode keeps its height as a note is scrolled, on a phone too. Every line of text tells the editor how tall it is drawn — a heading at its size and with the space above it, a line of text or of code wrapped at the column's width, measured from the theme's own lines — instead of the editor's guess from the text's metrics; a note an embed draws is drawn out of sight as the editor opens, and the page is laid out at its height before the author reaches it; and a block whose height is learned after it was made is laid out at it, its drawing kept. Measured in the playground on a long note (six notes of the notebooks, twice) scrolled once to its end, the page changed by −0.8% on a computer and +1.0% on a phone, where it grew by 1.0% and 10.6% (8% and 23% at 0.6.0). A host's `loadNote` is asked once more for each embedded note when the editor opens (#94).
- The playground keeps the window's width on a phone: a block of code wider than the note scrolls inside it rather than widening the page (#97).

## [0.6.0] - 2026-10-16

### Changed

- The switch between reading and editing is drawn as its icon alone by default, named by its word, like *Show Markdown* and *Copy Markdown* beside it, so the three buttons of a note's corner follow one rule. A host that wants the word beside the icon passes `modeButton="label"`; one that passed `modeButton="icon"` sees no difference. The playground draws the icon alone and `?button=label` the word (#92).

### Fixed

- The page no longer grows under the scrollbar as a note is scrolled in edit mode, because each block the editor draws tells it how tall it will be before it is drawn: the properties by their keys, a callout by its text wrapped at the editor's width, a table by its rows, a rule, a formula and an image by what they draw, and any block drawn once by the height it was measured at, kept when an edit above it moves it and the next time the note is edited. Measured in the playground on a long note scrolled once to its end, the page grew by 27% on a computer and 40% on a phone before, and grows by 8% and 23% now, what is left being the text between blocks and the notes an embed draws, which are not known before they are drawn. An image in edit mode is drawn at the dimensions it declares, with its description alone as its text, as reading draws it (#91).
- A block the editor draws — a callout, a table, an embed, the properties — is no longer left empty when a host function drawn inside it throws, as a `renderLink` returning a router's `<Link>` does outside the router's context: the block shows its Markdown under a notice, `strings.editor.blockFailed`, a click on it opens its source, and the error reaches the console. The documentation of `renderLink`, `renderAttachment` and a theme's slots says that in edit mode they may be drawn outside the host's React tree, and the README's example no longer uses a router's `<Link>` (#90).
- A note scrolled inside a pane of the host no longer makes the page as tall as itself: the root of a note is positioned in `structure.css`, so the live region that announces a ticked box, laid out of the flow, hangs from the note and not from the page, and the page loses the second scrollbar that scrolled nothing (#93).

## [0.5.0] - 2026-10-15

### Added

- Attaching a file shows what the host says while it keeps it, and why it refused it (#88). `attach` receives a third argument, `progress`, which takes `{ message, fraction? }`: the paperclip shows the message on hover and announces it, with how many files wait behind it, and draws a fraction as a bar that fills under it. A promise rejected with an `AttachRefusal`, a plain `{ message }`, has the paperclip say that message instead of *The file was not attached*, until the author opens the paperclip again, whose dialog says it once more. Pasted and dropped files report in the same place. A host that ignores `progress` and rejects with an `Error` sees no difference. `AttachProgress`, `AttachRefusal` and `isAttachRefusal` are exported, and `strings.editor.attachQueued` words the files waiting. The playground reports a file's parts under a simulated save, and `?save=refuse` refuses it.
- A host says why a save of an edit failed, or that one which succeeded left the author something to decide (#86). `onChange`'s promise may resolve with a `SaveOutcome`, which puts the save's status in a new *Alert* state, with its own icon, or reject with a `SaveRefusal`, which keeps *Not saved* with the host's reason in place of *Try again*: each is a title, a message and the actions to choose from, in the host's words. The status's icon opens them in a dialog that never closes by itself; Escape or its × leave the state as it was, and an action closes it and is followed like a save — *Saving…*, then *Saved*, an alert or a refusal. Going back to reading is allowed in *Alert* and blocked in *Not saved*, as before. The types are exported with `isSaveNotice` at `/edit` and as types from the package. A host that answers as before sees no difference. The playground's `?save=alert` and `?save=refuse` show both.
- A note that is only read offers *Show Markdown* and *Copy Markdown* at its top right, without the switch to edit it: reading a note's Markdown and copying it are reading. `NoteBody` takes `actions`, `true` unless a host passes `false` to hide the two buttons, editable or not, for a print, a preview or an embed. The playground's `?editable=0` shows the two buttons and no switch; `?bare=1`, which the comparison screenshots, shows neither (#87).

## [0.4.0] - 2026-10-15

### Added

- A note is edited on the page that draws it (#48). The editor's model is the note's bytes: the page is drawn over them by the reading surface's own parser and components, every change reaches the host whole through `onChange`, and a byte the author did not touch is never rewritten — the frontmatter's order and quoting, a list's marker, a table's spacing, a comment, a construct the specification does not describe. The note is written back with its own line break; one that mixes them opens read-only. CodeMirror 6 is the engine, on the subpath `@memorysmithapp/markdown-renderer/edit` (`NoteEditor`), loaded only when a note is edited; the decision is ADR-006 (#49).
- Every construct is edited in place: inline marks by shortcut and toolbar, a typed delimiter becoming the mark (#52); headings, lists, task lists, quotations and dividers, their notation typed at the start of a line or set from the toolbar, a list started from it on a blank line, the cursor after any marker the toolbar writes before it (#53, #74, #82); links, wikilinks with the host's `suggest` offering names after `[[`, embeds and images drawn until the cursor reaches them, block identifiers shown as markers, a link followed with a modifier held (#54); callouts, their type and folding chosen in place (#55); tables, cell by cell where they stand, an empty cell as easy to click as a full one and a Tab past the last cell adding a row, with rows, columns and alignment from their controls, which keep what was typed in the cell being edited and act on the cell the author was in (#56, #68, #69); code with its language and colours, formulas and Mermaid diagrams with their drawing live below their source (#57); the frontmatter as a form — the name as the title, each key and value by its shape, a list as chips, a date as a date, a boolean as the reader's yes or no that reading draws (#61), a property's type chosen from the icon at its key, a chevron marking it as a menu, for a new property or an existing one whose value is carried over, its removal from a button before its name, always shown, in one column, a list taking item after item with its + or Enter (#70 to #73) — each field rewriting its one entry (#58); footnotes numbered and defined together, comments shown as what they are, raw HTML and unknown notation as source (#59).
- `NoteBody` takes `editable`, which draws a switch between reading and editing at the top right of the note, as its icon or its icon and its word (`modeButton`), in the reader's language (`strings.edit`, `strings.view`); `mode`, `defaultMode` and `onModeChange` let a host control the mode, and `onChange` receives each change. A theme may draw the switch through the `modeSwitch` slot (#51). The icon has a class of its own, `mode-switch-glyph`, so the icon-only form's padding never shrinks it (#60).
- In edit mode the switch keeps its place at the top right and becomes the last control of the toolbar, which grows out of it and shrinks back into it when the note returns to reading, with no motion under `prefers-reduced-motion`; on a phone the tools take the width under the switch, and a row the tools wrap to starts with no separator (#62, #65, #80).
- Beside the switch, in both modes, *Show Markdown* opens the note's Markdown, read-only and exactly as the host has it or receives it, in a modal dialog whose text alone scrolls, and *Copy Markdown* copies it, showing a check; the playground's side panel is gone (#63, #76).
- The toolbar's first button, *Undo all changes*, gives back the note as edit mode opened it, in one change that Undo reverses; it replaces the playground's restore (#67).
- A kept file is drawn by its media type, as MemorySmith's page draws it, where the host gives `fileOf`, which describes it — media type, size, addresses, description: an image, an audio or a video player, or a card with its name, its type in the reader's words, its size, its description, *Open* where a browser shows it — a file kept as `data:` opened as the `blob:` of its bytes, since a browser navigates no tab to `data:` (#79) — and *Download*. A theme may draw it through the `attachment` slot; `renderAttachment` still wins. The playground keeps one sample of each of MemorySmith's sixteen types, with their attributes and their bytes in base64 (#77).
- A fenced code block is highlighted in any language Prism carries: MemorySmith's fifteen at once, as before, and each of the other 282 fetched the first time a note names it, by its identifier or an alias. In edit mode a control at the block's top right chooses its language from all of them, with a search by name or alias, rewriting only the fence's info string; a code block the toolbar or the menu inserts opens it. The playground carries a notebook of code samples, one note per language highlighted at once and four loaded on demand (#84).
- A callout marked `+` or `-` folds in the default theme: its title, or its type's word, is the control that opens and closes it, with a chevron that turns, open at first for `+` and closed for `-`, in both modes; a callout with no mark is drawn as before (#83).
- A right-click on the text in edit mode opens the editor's menu where the author is: Format when there is a selection, Insert, and Edit's cut, copy and paste, each with its shortcut, from the toolbar's own commands; Shift+F10 and the context-menu key open it at the cursor, and Shift keeps the browser's menu (#81).
- The toolbar's paperclip opens a dialog with three ways in (#78): a file from the computer, given a name and a description that the host's `attach` receives with it; a file the notebook keeps, listed by the new host member `files` and found by name or description; an image at a web address, written as `![name](address)`. The playground keeps the notes saved and the files attached in this browser, so both survive a reload, and its sidebar discards them.
- A file is attached in edit mode, by pasting or by dropping it, where the host gives `attach`, which keeps it and answers its name; the editor embeds it as `![[name]]`, and says on its button while the host keeps it or when it could not. The playground keeps attached files for the session, as `?save=` asks (#75).
- The editor says whether the last change was saved: when `onChange` answers with a promise, an icon before the switch — a turning loader, a check, an alert that tries again when clicked (#66) — its word in its title and told to a screen reader, in a slot of one size so the toolbar never moves. Going back to reading waits for a save in flight and stays in edit when the last save failed, the switch shaking once. A note the host passes back after saving is not applied over what the author typed since. The playground's `?save=` applies to edits as to ticks (#64).
- The words of the editor are `strings.editor`, each one a host leaves out in English; `strings.editUnavailable` says why a note opens read-only.
- The playground edits any note; `?editable=0` hides the switch and `?button=icon` draws it as its icon alone (#50, #51).
- A task box shows its save on the item itself: when the host answers `onToggleTask` with a promise, the item is locked under *Updating…*, its box showing the state being written, until the promise settles; a save that fails returns the box to the state its source holds and the item says *Not saved* for a moment. Ticks reach the host one at a time, and a polite live region tells whoever hears the page. The words are `strings.updating`, `strings.notSaved` and `strings.saved`; the `taskBox` slot is handed `pending` and `failed`; a host that answers with nothing keeps today's page. The playground simulates a save with `?save=slow`, `fail` or `random` and `&delay=<ms>` (#47).

## [0.3.2] - 2026-10-15

### Fixed

- A link in a callout title is underlined, so it reads as a link whatever the colour of the callout: in a blue callout — `note`, `info`, `todo`, and every type the theme does not name, such as `[!regra]` — the title is drawn in the accent, at the weight of a wikilink, and a link in it could not be told from the title around it. A pending link keeps its dashed rule. The underline is two public properties, `--markdown-callout-title-link-decoration` and `--markdown-callout-title-link-offset`, which a theme sets as `calloutTitleLinkDecoration` and `calloutTitleLinkOffset` (#45).

## [0.3.1] - 2026-10-14

### Changed

- The demonstration notebooks show a callout title holding bold text, in the red-wine protocol and the March exercise, and a callout of a type outside A–Z, `[!atenção]`, in the protocol; the comparison with MemorySmith lists both notes as deliberate differences (#42, #43).

### Fixed

- An empty fenced block is an empty block of code, with a language or without one, where one that named a language drew the word *undefined*; an empty block keeps the height of one line, so its *Copy* button sits inside it instead of over its edge (#38).
- An embed of a section runs to the next real heading of its level or higher: a `# ` line inside a fence of the section, such as a shell comment, is code and no longer ends the cut, which used to leave the section's code block empty (#40).
- A link to a block, `[[note#^identifier]]`, keeps its label as typed, identifier included, where the label lost its `^identifier` to the rule that takes a block identifier off the page: that rule now reads the end of a block — a paragraph, a heading, a table cell — and never the end of a link or another inline inside it (#39).
- A note whose `name:` carries `#`, `[`, `]` or `|` has no name on the page and in `diagnose` too, as `SPEC.md` §5.3 says and MemorySmith reads it: `name: Incident #4711` used to be drawn as the note's title and raise nothing, and now draws *Unnamed note* and raises `name-unusable`. `SPEC.md` §6.2 now says the subset has no comments, so a ` #` is a character of the value it is written in, with a conformance case for a name and one for an attribute (#41).
- A callout whose title holds bold or other inline markup draws its title as one sentence beside the icon, wrapping as a paragraph does, where each run of it used to be a column of its own; the words of a title travel in one element, `.callout-title-text` (#42).
- A callout type is a word of any script, as `SPEC.md` §7.1 says: `> [!atenção]` is a callout titled *Atenção* where it used to be a quotation beginning with its marker, a type written decomposed is the type written composed, and the specification now says so in words, with a conformance case for a type outside A–Z (#43).

## [0.3.0] - 2026-10-14

### Added

- `diagnose`, at `@memorysmithapp/markdown-renderer/diagnose`: a host hands it a note and gets the notices of it — where the page will not show what was typed, and what the note lacks — each with a stable code, a severity (`notice` or `hint`), the section of the specification behind it and its place as lines and columns. It never refuses a note, reads it through the same parser and plugins as `NoteBody`, runs with no DOM and no React, reports pending links only against the notebook the host describes, and loads Mermaid only for a note with a diagram (#35).
- The specification declares the notices an implementation may report (`SPEC.md` §7.13): eighteen codes, in `SPEC.md` and in `spec.json` as `notices`, each raised by a conformance case, which may now list the notices its input raises; the checker holds the table, the data and the suite together (#35).
- The headings of a body form an outline that SHOULD start at level one and descend one level at a time (`SPEC.md` §3.3); the name of a note is not a level of it, and an outline that breaks this is a notice, never an error (#35).

### Fixed

- A comment is hidden whatever it holds — inline markup, raw HTML, a wikilink, an embed, a footnote reference, blank lines and the blocks between them — where it used to be drawn whole, markers included, unless it sat inside one run of text; a comment on lines of its own leaves no empty paragraph, and a task box inside a comment is no box, so the boxes after it keep their ordinals. MemorySmith's reading page carries the defect, and the renderer now differs from it there (#36).

## [0.2.0] - 2026-10-13

### Added

- Themes: `defineTheme` and a `theme` prop that takes a theme a host writes in its own project, at three levels it may mix — properties written on the root as `--markdown-*`, now naming every value the stylesheet reads, metrics, headings, quotations, tables and callout icons included; its own CSS, scoped by the root class `markdown-theme-<name>`; and twelve slots, React components called with the notation already interpreted — with `scheme` choosing light or dark. MemorySmith's look is the theme `default`, and `theme="light"` and `theme="dark"` keep meaning it (#28).
- The stylesheet is `structure.css`, what every theme needs, and `theme-default.css`, MemorySmith's look; `styles.css` is the two together, as before (#28).
- A note's frontmatter is drawn, as the theme decides: `NoteBody` reads it by the shapes of the specification (`readProperties`) and hands it to the theme's `properties` slot; the default theme draws `name` as the note's title and every other entry above the body — lists as chips, booleans in the reader's words, dates as written — with a `[[wikilink]]` in a value drawn as a link the host resolved. A theme whose slot draws nothing keeps a note's body alone, as MemorySmith's page does (#29). The default theme draws it as MemorySmith's note page does — the title always, *Unnamed note* when there is none, and a block that folds under *Properties*, with no card, the reserved keys first, an icon per key by the shape of its value, MemorySmith's chips, dates in the reader's locale (`strings.locale`), and Markdown links and web addresses in values as links, with each key's icon on the key's first line when its value wraps, where MemorySmith's page centres it on the row (#34) — and the comparison with MemorySmith now covers the title and the properties and finds them identical (#30).
- The playground picks the theme and the scheme in its sidebar and its address, among the default theme and three example themes that live only there: `sepia`, properties alone; `docs`, its own CSS; and `terminal`, slots with icons from `lucide-react`; each draws the note's title and properties its own way, `terminal` as the YAML it is (#28, #29).

### Changed

- The demonstration notebooks show code and footnotes where each would write them: `sql`, `bash`, `diff`, `yaml` and `json` in the payments runbook and objective, `python` and `yaml` in the red-wine protocol (the `yaml` inside a callout), a `promql` fence the renderer draws as typed, fences with no language, and several footnotes per note, one cited twice and a numeric label cited before a smaller one (#32).
- The demonstration notes and the `TEMPLATE.md` of each folder start their body at a first-level heading, under the title `name:` gives, since a body may start at any level; the five notes that already started at `#` keep showing that a heading never names a note (#31).
- `NoteBody` no longer leaves the frontmatter off the page: decision 4 of #1 is superseded for it by ADR-004, and a host that already draws properties gives a theme whose `properties` slot draws nothing (#29).
- The root of a note carries the class `markdown-theme-<name>` beside `markdown`, and a callout written with a fold marker carries it as `data-fold` (#28).

### Fixed

- The footnotes of a note an embed cuts keep the space above them that the section of any note takes; drawn in a pass of their own, they lost it to the rule that takes the top margin off a run's first block (#32).
- The comparison's reference page keeps MemorySmith's pane within a phone's width, as MemorySmith's application does, where a long line of code used to widen it (#32).

## [0.1.2] - 2026-10-13

### Fixed

- `SDLC.md` §10 says the trusted publishers allow `npm publish`, as the workflow needs: without that permission npm refuses the workflow's publish instead of staging it, which is what the release of v0.1.1 met; the section also says a new trusted publisher expires unless it publishes within two days (#22).
- `pnpm run quality` reads only the Markdown files git tracks or would track, so it passes locally after `pnpm --filter playground compare` has left MemorySmith's checkout in the tree, instead of reading that checkout's documents as this repository's (#23).

## [0.1.1] - 2026-10-13

### Fixed

- `NoteBody` draws a footnote whose reference and definition an embed separates: a note an embed cuts numbers its footnotes once, in the order of the note, with ids that never repeat, and draws their one section at its end, below its last embed too, where MemorySmith's reading page draws the reference as its characters; a way back reaches a reference in another run (#20).
- `.gitignore` ignores the tarballs `pnpm pack` leaves in a package during the first publish, so they cannot be committed by accident (#21).

### Changed

- `SDLC.md` §10 says that the first publish needs two-factor authentication on the owner's npm account, and that a version the workflow publishes is staged until the owner approves it on npmjs.com, with the trusted publisher's settings as configured (#22).

## [0.1.0] - 2026-10-12

### Added

- A pnpm workspace with the packages `@memorysmithapp/markdown-spec` and `@memorysmithapp/markdown-renderer` under `packages/`, built with TypeScript and tested with Vitest, configured once at the root (#3).
- `@memorysmithapp/markdown-spec` carries the MemorySmith Markdown Specification brought from the main repository at `4b67c7e`: `SPEC.md`, `spec.json` and its schema, the conformance suite and its checker, exported at `./SPEC.md`, `./spec.json`, `./conformance.json` and `./schema.json`; the `url` of `spec.json` names `SPEC.md` at the tag of the version, and the checker fails when it does not (#4).
- `@memorysmithapp/markdown-spec` ships the TypeScript types of its data and typed entry points, `import { spec, cases } from '@memorysmithapp/markdown-spec'`, with a test that compiles the data against them (#5).
- `@memorysmithapp/markdown-renderer` exports `NoteBody`, which draws the body of a note through MemorySmith's reading-page pipeline — newlines normalised, `remark-gfm` with `singleTilde: false`, no raw HTML, the address filter, footnotes and image dimensions — under a typed host contract: `resolve`, `keeps`, `renderAttachment`, `renderLink` and `strings`, with safe defaults (#6).
- `NoteBody` draws callouts titled in the host's words, marked text, comments off the page, block identifiers off the page, and mathematics through KaTeX, with the dollar rule that keeps `R$100 e o frete R$200` a sentence (#7).
- `NoteBody` draws code as MemorySmith does: `mermaid` fences as diagrams through a lazily imported Mermaid that shows its source when it fails, fifteen languages highlighted into React elements, and every fence in a frame with a Copy button that copies the bytes as typed; `theme` picks Mermaid's theme, and `katex` is a peer dependency for its stylesheet (#8).
- `NoteBody` resolves wikilinks as MemorySmith does — a literal name after NFC, nothing inside code touched, a pending link drawn as such, a choice in place when several notes answer through the host's `reaches` and `choose` — draws a file the notebook `keeps` only for an embed, through the host's `renderAttachment`, and says under the body which hosts a note's images fetched from; `splitFrontmatter` and `remoteImageHosts` are exported for hosts (#9).
- `NoteBody` draws embedded notes in place — a whole note, a section or a block, with the note they came from named under them — from the body the host's `loadNote` gives, one level deep, at most ten per note, and as a link inside a table cell or code (#10).
- `NoteBody` draws task boxes that report the ordinal of the ticked box through `onToggleTask` when the host makes the note `writable`, and exports `toggleTaskAt`, `taskCheckedAt`, `taskBoxes` and `ordinalAt`, so the host applies a tick as a one-character change; a box inside a callout keeps an ordinal of its own, which MemorySmith's reading page does not give it (#11).
- `@memorysmithapp/markdown-renderer/styles.css`, the stylesheet of MemorySmith's reading surface scoped under `.markdown`, with its colours, faces and radii as `--markdown-*` custom properties in a light and a dark theme, picked by the `data-theme` the root of a note carries from `theme`; the root draws what sits beside the runs of text — an embed, a pending embed, the notice of remote images — under the body's line height, as MemorySmith's page does (#12, #15).
- Every `reading-surface` entry of the specification is asserted by the renderer's conformance test, reading the entries from `@memorysmithapp/markdown-spec`, or listed in the exported `DELEGATED_TO_THE_BASE_PARSER`; an entry in neither fails the build (#13).
- The demonstration notebooks `continuity-engineering` (en-US) and `enologia` (pt-BR), brought from MemorySmith's history at `9dbc682` with a footnote added to each, the one notation they lagged on, and three fixture images they draw; a test guards that each shows every declared notation and none the specification does not declare (#14).
- A playground, a private Vite page of the workspace that draws any note of the two notebooks with the renderer under an in-memory host, in light and dark (#14).
- `pnpm --filter playground compare`, which draws every note of the demonstration notebooks with MemorySmith's own reading surface at `4b67c7e` and with the renderer, in light and dark, at a desktop and a phone width, and compares the images: the 56 pairs are identical (#15).
- The workflow `Release` publishes both packages to npm after it writes the tag, through trusted publishing with provenance and no token, by `scripts/publish.mjs`: only on a release, only the version of the tag, failing when that version exists already, and leaving a package npm has never seen for the owner's first publish, whose steps `SDLC.md` §10 lists (#16).
- Both packages are complete for npm — description, keywords, homepage, repository, `files`, `exports` and types, a `README.md` and a `LICENSE` each — and `Quality` checks with `npm pack --dry-run` that each ships exactly the files meant to ship (#16).
- A seventh check in `Quality`: every package of the workspace has the root's `version`, and a package not marked private declares public access; the workflow also installs, builds, type-checks and tests the packages (#3).

### Changed

- The repository adopts `memorysmithapp-template` v0.2.1: `AGENTS.md`, `README.md` and `package.json` name `memorysmithapp-markdown`; `PRD.md` and `ARCHITECTURE.md` keep their skeletons and the description of the parts kept; the version restarts at `0.1.0` and the changelog names this repository (#2).

### Fixed

- `Quality` check 4 reads a footnote definition, `[^label]: text`, as prose instead of as a link definition pointing at its first word (#14).

[unreleased]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.8.2...HEAD
[0.8.2]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/memorysmithapp/memorysmithapp-markdown/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/memorysmithapp/memorysmithapp-markdown/releases/tag/v0.1.0
