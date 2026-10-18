---
sidebar_position: 16
description: The Idea Map workspace, Markdown notes with wiki links, the graph, and how notes link to boards, palettes, files and tickets.
---

# Idea Map and notes

The Idea Map workspace holds Markdown notes that link to each other and to everything else in the project. It works like Obsidian: type `[[` to link a note, follow links with a click, see backlinks and explore the graph. Notes are internal assets, so they sit in the Assets editor beside boards and palettes, drop onto boards and tickets, and open from there.

The workspace has four editors: Notes on the left, the note beside it, and the local graph over Note details on the right. Each is also in the area editor switcher under Idea Map.

## Using it

| Action           | How                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| New note         | The new note button in Notes, the chevron beside it for a template, or the + menu in the Assets editor             |
| Open a note      | Click it in Notes, press Ctrl+O and type part of its title or an alias, or click a link anywhere                   |
| Today's note     | The calendar button in Notes opens or creates a note named after today's date                                      |
| Rename           | Edit the title above the note, double-click it in Notes or press F2. Links in other notes are rewritten            |
| Move             | Drag a note onto a folder in Notes, or use Move to in its context menu                                             |
| Bookmark         | The star above the note or Bookmark in its context menu. Bookmarks list at the top of Notes                        |
| Switch view      | Live preview, Source and Reading above the note. Live preview hides Markdown marks except on the line being edited |
| Follow a link    | Click a link in Live preview or Reading. In Source, and on the line being edited, hold Ctrl and click              |
| Preview a link   | Hover a link for half a second to see the note, file or item without leaving                                       |
| Back and forward | The arrows beside the title step through the notes opened in that area                                             |
| Link a mention   | Note details lists unlinked mentions of the title and aliases; Turn into a link wraps the text in `[[ ]]`          |
| Tick a task      | Click the checkbox in Live preview or Reading                                                                      |
| Make a ticket    | Create ticket from selection in the More menu uses the selection, or the task on the cursor line, as the title     |
| Drop into a note | Drag files, boards, palettes or notes from the Assets editor or Notes into the text; paste or drop desktop images  |
| Place elsewhere  | Drag a note from Notes onto a board or a ticket window                                                             |

## Link syntax

Links use Obsidian's syntax, so a vault imports without changes. Loopy items use the same brackets with a kind in front.

| Write                   | Gives                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| `[[Combat]]`            | A link to the note titled Combat, or to the note with that alias |
| `[[Combat\|fighting]]`  | The same link shown as fighting                                  |
| `[[Combat#Melee]]`      | A link to the Melee heading                                      |
| `[[Combat#^rules]]`     | A link to the block ending in `^rules`                           |
| `![[Combat#Melee]]`     | The Melee section shown inside this note                         |
| `[[board:Level 1]]`     | A link to the board named Level 1                                |
| `[[palette:Forest]]`    | A link to the palette; `![[palette:Forest]]` shows its swatches  |
| `[[asset:hero.png]]`    | A link to the file; `![[asset:hero.png]]` shows images and media |
| `[[ticket:12]]`         | A link to ticket 12 with its key, title and state                |
| `#enemy`, `#enemy/boss` | Tags; nested tags match their parent in search                   |

Typing `[[` suggests notes and aliases, `[[Note#` its headings, `[[Note#^` its blocks and `[[board:` the boards; `#` suggests existing tags. Links resolve by title, ignoring case. A link to a note that does not exist shows faded, and clicking it creates the note in the same folder.

Notes also understand YAML frontmatter, with `aliases` and `tags` read as lists, callouts such as `> [!warning] Title` (add `+` or `-` after the type to fold), `==highlights==`, `%%comments%%`, tables, task lists and footnotes.

## Diagrams and maths

A fenced code block with the language `mermaid` draws a Mermaid diagram in Reading view, embeds and hover previews, in the light or dark style of the current theme. A diagram with a mistake shows the error and its source instead. Mermaid loads the first time a diagram is shown, so notes without diagrams do not pay for it, and it runs in strict mode, which removes scripts and links from diagram text.

`$E = mc^2$` sets maths inline and `$$ … $$` on lines of its own sets a display formula, using KaTeX. A formula KaTeX cannot read is shown in red rather than breaking the note. Live preview and Source show the raw text.

## History, extract and merge

Loopy keeps earlier versions of each note. While you write, it saves a version at most every five minutes; it always saves one before a rename, before a merge into the note, before a restore and before another note's rename rewrites a link in it. Each note keeps its last 50 versions, and they go when the note is deleted.

| Action       | How                                                                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| See versions | The History tab in Note details lists them, newest first, with the time and word count                                                                                                             |
| Preview      | Click a version to read it below the list                                                                                                                                                          |
| Restore      | Restore this version replaces the note's text; the text it replaces is saved as a version first                                                                                                    |
| Extract      | Select text, then Extract selection to new note in the More menu. The selection moves to a new note in the same folder and is replaced by a link to it. The title is suggested from the first line |
| Merge        | Merge into another note in the More menu adds this note's text, without its frontmatter, to the end of another note, points every link at that note and deletes this one                           |

## Search and queries

The search box in Notes and the graph filter share one query language. Terms combine with and; a leading `-` negates a term.

| Term             | Matches                                 |
| ---------------- | --------------------------------------- |
| `word`, `"a b"`  | Title or text                           |
| `tag:#enemy`     | The tag or any tag nested under it      |
| `path:World`     | Notes in a folder path containing World |
| `title:boss`     | Titles                                  |
| `task:jump`      | Tasks containing jump                   |
| `task-todo:`     | Notes with open tasks                   |
| `task-done:`     | Notes with finished tasks               |
| `[status]`       | Notes with the property                 |
| `[status:draft]` | Notes whose property contains draft     |

A fenced code block with the language `query` lists matching notes in Reading view. A `table: hp, damage` line shows those properties as columns, and `sort: hp desc` orders the rows.

## Graph

The graph draws notes as dots and links as lines, sized by how many links a note has. All notes shows the project; Current note shows the note last focused and its neighbours up to the chosen depth. Click a dot to open it, drag a dot to move it, drag the background to pan and scroll to zoom. The settings button filters by query, shows tags, Loopy items, orphans and unresolved links, colours groups by query, and tunes repel, link distance, centre pull and node size. Settings are area state, so each graph area keeps its own.

## Templates and daily notes

Built-in templates cover a character, a game mechanic, a level, an enemy, an item, meeting notes and a daily note. Any note in a folder named Templates becomes a template too. `{{title}}`, `{{date}}` and `{{time}}` are filled when a note is made. Insert template in the More menu adds one to the current note. Today's note uses a template note named Daily note if there is one, and goes into a notes folder named Daily if there is one.

## Import and export

| Action                  | Result                                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import Markdown files   | Each `.md` file becomes a note; a title already in use gets a number                                                                                                                                       |
| Import a folder         | Every `.md` file under it, in folders that mirror its paths. Media and documents become assets and links to them become `[[asset:…]]` links. Folders starting with a dot, such as `.obsidian`, are skipped |
| Drop `.md` files        | Dropping on Notes or into a note imports them                                                                                                                                                              |
| Export a note           | Writes one `.md` file                                                                                                                                                                                      |
| Export a folder or all  | Writes the notes into a chosen folder, mirroring the note folders                                                                                                                                          |
| Export with plain links | Turns Loopy links into text and file embeds into Markdown images, copying the files to `attachments`                                                                                                       |

## Elsewhere in Loopy

Notes are the third kind of internal asset. The Assets editor lists them under Internal with their own folder tree, and moves, renames and deletes them like boards and palettes. A note dropped on a board becomes a link item, and on a ticket a linked asset; both show the title and the first line, and open the note in the Idea Map workspace. The ticket link picker has a Notes group. Renaming a board, palette or file rewrites `[[board:…]]`, `[[palette:…]]` and `[[asset:…]]` links in notes. Deleting one leaves the links in place, shown as missing.

## How it works

Notes are rows in the project file. Project migration 15 adds `note_versions`, deleted with their note. Project migration 14 adds the `notes` table and widens `asset_folders.scope` to include `notes`. SQLite cannot change a check constraint, so the migration rebuilds `asset_folders` and restores every folder parent and every board, palette and asset folder link.

| Column      | Holds                                                             |
| ----------- | ----------------------------------------------------------------- |
| `title`     | Unique ignoring case; cannot contain `[ ] \| # ^ \ / : * ? " < >` |
| `body`      | The Markdown, exactly as written                                  |
| `folder_id` | A folder with scope `notes`, or null                              |
| `starred`   | Bookmark flag                                                     |

| Channel                | Does                                                                             |
| ---------------------- | -------------------------------------------------------------------------------- |
| `notes:list`           | Every note                                                                       |
| `notes:create`         | Creates a note; a taken title gets a number                                      |
| `notes:update`         | Title, body, folder or bookmark; a rename returns every note whose links changed |
| `notes:delete`         | Deletes notes and returns the rest                                               |
| `notes:import`         | Imports Markdown sent from the renderer, creating folders from paths             |
| `notes:pick`           | Opens the file or folder dialog and imports                                      |
| `notes:export`         | Opens the save or folder dialog and writes Markdown                              |
| `notes:merge`          | Merges one note into another and returns every note                              |
| `noteVersions:list`    | A note's versions, newest first                                                  |
| `noteVersions:restore` | Restores a version and returns the note                                          |

`src/shared/markdown.ts` parses links, tags, headings, blocks, tasks and frontmatter, and rewrites links. Main uses it to rewrite links on rename and import; the renderer uses it for the index, the editor and search. Code blocks, inline code and comments are skipped everywhere.

`src/renderer/lib/notes` owns the notes store and the pure core. `index.ts` exports the store actions, `buildIndex` (titles, aliases, backlinks, unresolved links, tags), `unlinkedMentions`, `searchNotes`, `parseQuery`, `fuzzyScore`, `buildGraph`, the template helpers and the hooks. Body edits update the store at once and save after 400 ms; `flushNotes` writes anything pending before export, import and closing the window.

The editors are in `src/renderer/components/editors/Notes`. `NoteEditor` runs CodeMirror 6: `codemirror/livePreview.ts` draws link, embed, checkbox and rule widgets and hides Markdown marks away from the cursor, and `codemirror/complete.ts` suggests links and tags. `NoteMarkdown` renders Reading view, embeds and hover previews with `react-markdown`, `remark-gfm`, `remark-math` and `rehype-katex`; raw HTML is not rendered. `MermaidBlock` imports `mermaid` on first use. `NoteHistory` is the History tab and `ComposerDialogs` holds the extract and merge dialogs. `GraphView` lays out the graph with `d3-force` on a canvas and keeps a hidden list of the nodes as buttons for keyboard and screen reader users. See [ADR 0020](./decisions/0020-notes-editor.md).

Tests: `tests/unit/shared/markdown.test.ts` for the parser, `tests/unit/renderer/lib/notes.test.tsx` for the library, `tests/unit/renderer/Notes.test.tsx` and `NotesExtras.test.tsx` for the editors, `tests/integration/ipc/notes.test.ts` for the channels and `tests/integration/storage/notes-migration.test.ts` for the migrations; `tests/e2e/notes.spec.ts` writes linked notes, maths and a diagram in the built app.
