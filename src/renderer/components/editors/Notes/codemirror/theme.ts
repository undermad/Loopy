import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

const highlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700', color: 'var(--color-fg)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--color-accent)' },
  { tag: tags.url, color: 'var(--color-fg-muted)' },
  { tag: tags.monospace, fontFamily: 'var(--font-family-mono)' },
  { tag: tags.quote, color: 'var(--color-fg-muted)' },
  { tag: tags.processingInstruction, color: 'var(--color-fg-muted)' },
  { tag: tags.meta, color: 'var(--color-fg-muted)' },
  { tag: tags.comment, color: 'var(--color-fg-muted)' },
  { tag: tags.keyword, color: 'var(--color-accent)' },
  { tag: tags.string, color: 'var(--color-success)' },
  { tag: tags.number, color: 'var(--color-warning)' },
]);

const base = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--color-fg)',
    backgroundColor: 'transparent',
    fontSize: 'var(--font-size-md)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-family)', lineHeight: '1.65' },
  '.cm-content': {
    maxWidth: '760px',
    margin: '0 auto',
    padding: 'var(--space-6) var(--space-6) 40vh',
    caretColor: 'var(--color-accent)',
  },
  '.cm-cursor': { borderLeftColor: 'var(--color-accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--color-selection)',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-tooltip': {
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-surface-raised)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete > ul > li': { padding: '2px var(--space-2)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--color-selection)',
    color: 'var(--color-fg)',
  },
  '.cm-completionDetail': {
    color: 'var(--color-fg-muted)',
    marginLeft: 'var(--space-2)',
    fontStyle: 'normal',
  },
  '.cm-heading': { fontWeight: '700' },
  '.cm-h1': { fontSize: '1.9em', lineHeight: '1.3' },
  '.cm-h2': { fontSize: '1.55em', lineHeight: '1.35' },
  '.cm-h3': { fontSize: '1.3em' },
  '.cm-h4': { fontSize: '1.15em' },
  '.cm-h5, .cm-h6': { fontSize: '1em' },
  '.cm-wikilink, .cm-wikilink-source': {
    color: 'var(--color-accent)',
    cursor: 'pointer',
  },
  '.cm-wikilink': {
    textDecoration: 'underline',
    textDecorationColor: 'transparent',
    textUnderlineOffset: '2px',
  },
  '.cm-wikilink:hover': { textDecorationColor: 'currentColor' },
  '.cm-wikilink-missing': { opacity: '0.6' },
  '.cm-wikilink-board, .cm-wikilink-palette, .cm-wikilink-asset, .cm-wikilink-ticket': {
    padding: '0 4px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-hover)',
  },
  '.cm-embed': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    maxWidth: '100%',
    padding: '2px 6px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-surface-sunken)',
    cursor: 'pointer',
    verticalAlign: 'middle',
  },
  '.cm-embed img': {
    display: 'block',
    maxWidth: '100%',
    maxHeight: '320px',
    borderRadius: 'var(--radius-sm)',
  },
  '.cm-embed-asset:has(img)': { padding: '2px' },
  '.cm-swatch': { width: '14px', height: '14px', borderRadius: '3px', display: 'inline-block' },
  '.cm-embed-label': { color: 'var(--color-fg-muted)', fontSize: 'var(--font-size-sm)' },
  '.cm-tag': {
    padding: '0 6px',
    borderRadius: '999px',
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 16%, transparent)',
    color: 'var(--color-accent)',
  },
  '.cm-highlight': { backgroundColor: 'color-mix(in srgb, var(--color-warning) 35%, transparent)' },
  '.cm-md-comment': { color: 'var(--color-fg-muted)', opacity: '0.7' },
  '.cm-md-link': { color: 'var(--color-accent)', textDecoration: 'underline' },
  '.cm-quote': {
    borderLeft: '3px solid var(--color-border)',
    paddingLeft: 'var(--space-3)',
    color: 'var(--color-fg-muted)',
  },
  '.cm-callout': {
    borderLeftColor: 'var(--color-accent)',
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
  },
  '.cm-callout-title': { fontWeight: '600', color: 'var(--color-fg)' },
  '.cm-codeblock': {
    fontFamily: 'var(--font-family-mono)',
    fontSize: 'var(--font-size-sm)',
    backgroundColor: 'var(--color-surface-sunken)',
  },
  '.cm-frontmatter': {
    fontFamily: 'var(--font-family-mono)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-fg-muted)',
    backgroundColor: 'var(--color-surface-sunken)',
  },
  '.cm-task': { margin: '0 4px 0 0', verticalAlign: 'middle', cursor: 'pointer' },
  '.cm-rule': { display: 'inline-block', width: '100%', borderTop: '1px solid var(--color-border)' },
  '.cm-placeholder': { color: 'var(--color-fg-muted)' },
});

export const noteTheme: Extension = [base, syntaxHighlighting(highlight)];
