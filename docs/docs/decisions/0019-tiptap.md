---
description: TipTap for rich text in ticket descriptions and comments.
---

# 0019 TipTap for rich text

## Context

Ticket descriptions and comments need headings, lists, checklists, quotes, code and links so a ticket reads well and is quick to write. A plain textarea with Markdown would do for reading but not for the inline editing the Jira-style ticket window promises, and writing a ProseMirror schema by hand is weeks of work.

## Decision

TipTap 3 (`@tiptap/react`, `@tiptap/starter-kit`, task list and item, `@tiptap/extensions` for the placeholder) backs one `RichText` component in the UI library and a `RichContent` renderer for read-only text. Content is stored as HTML in the existing `description` and the new `ticket_comments.body` columns. HTML read from the project file is passed through the same TipTap schema before it is rendered, so anything the schema does not know, such as scripts, is dropped. Plain text written before this change is wrapped in paragraphs on the way in.

## Consequences

TipTap is MIT and ships ProseMirror, which is the only sizeable renderer dependency this adds. jsdom cannot drive it through `userEvent.type`; tests change the editor's DOM and let ProseMirror's mutation observer pick the edit up, and the renderer setup stubs `getClientRects`, see the testing page. Markdown export is possible later from the same document model.
