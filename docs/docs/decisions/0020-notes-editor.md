---
description: CodeMirror 6, react-markdown and d3-force for Markdown notes and the note graph.
---

# 0020 CodeMirror, react-markdown and d3-force for notes

## Context

Idea Map notes are Markdown files that must import from and export to Obsidian without loss. TipTap, used for ticket text, stores a document model and turns it back into Markdown only approximately, so wiki links, frontmatter and callouts would not survive a round trip. The graph needs a force layout for hundreds of nodes, which the board's React Flow does not provide.

## Decision

The note editor uses CodeMirror 6 (`@codemirror/*` and `@lezer/highlight`), which edits the Markdown text itself; live preview is a set of decorations over that text. Reading view uses `react-markdown` with `remark-gfm` and a small remark plugin for wiki links, tags, highlights and callouts, rendering React elements with raw HTML switched off. The graph uses `d3-force` for layout and draws on a canvas. Maths uses `remark-math` with `rehype-katex` and KaTeX's stylesheet. Diagrams use `mermaid`, imported only when a diagram is shown and run with `securityLevel: 'strict'`.

## Consequences

The body in the project file is always the Markdown the user typed, so export is a file write. CodeMirror and the remark packages are MIT and load only with the notes editors. jsdom has no layout, so tests check text and widgets rather than positions; the renderer setup already stubs `getClientRects`. Mermaid is large, so it is a separate chunk; unit tests mock it and the end-to-end test draws a real diagram. The graph canvas cannot be tested in jsdom, so `GraphView` also renders its nodes as a hidden list of buttons, which tests and assistive technology use.
