import { syntaxTree } from '@codemirror/language';
import { StateEffect, type EditorState, type Extension, type Range } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { frontmatterEnd, parseLinkText, type LinkParts } from '@shared/markdown';

export interface ResolvedPreview {
  exists: boolean;
  label: string;
  imageUrl: string | null;
  colours: string[];
}

export interface PreviewHost {
  resolve: (link: LinkParts) => ResolvedPreview;
  open: (link: LinkParts, event: MouseEvent) => void;
  hover: (link: LinkParts | null, rect: DOMRect | null) => void;
  tag: (tag: string) => void;
  live: () => boolean;
}

export const refreshPreview = StateEffect.define();

const WIKILINK = /(!?)\[\[([^[\]\n]+?)\]\]/g;
const TAG = /(^|[\s(,])(#[\p{L}\p{N}_\-/]*[\p{L}_\-/][\p{L}\p{N}_\-/]*)/gu;
const HIGHLIGHT = /==([^=\n]+)==/g;
const COMMENT = /%%[^\n]*?%%/g;
const CALLOUT = /^>\s*\[!([\w-]+)\][+-]?/;
const CODE_NODES = new Set([
  'InlineCode',
  'FencedCode',
  'CodeBlock',
  'CodeText',
  'HTMLBlock',
  'CommentBlock',
]);
const HIDDEN_MARKS = new Set(['HeaderMark', 'EmphasisMark', 'CodeMark', 'StrikethroughMark', 'QuoteMark']);

function linkAttributes(element: HTMLElement, parts: LinkParts, raw: string): void {
  element.dataset['wikilink'] = raw;
  element.dataset['kind'] = parts.kind;
}

class LinkWidget extends WidgetType {
  constructor(
    readonly raw: string,
    readonly parts: LinkParts,
    readonly resolved: ResolvedPreview,
  ) {
    super();
  }

  override eq(other: LinkWidget): boolean {
    return (
      other.raw === this.raw &&
      other.resolved.exists === this.resolved.exists &&
      other.resolved.label === this.resolved.label
    );
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = `cm-wikilink cm-wikilink-${this.parts.kind}${this.resolved.exists ? '' : ' cm-wikilink-missing'}`;
    span.textContent = this.resolved.label;
    linkAttributes(span, this.parts, this.raw);
    return span;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

class EmbedWidget extends WidgetType {
  constructor(
    readonly raw: string,
    readonly parts: LinkParts,
    readonly resolved: ResolvedPreview,
  ) {
    super();
  }

  override eq(other: EmbedWidget): boolean {
    return (
      other.raw === this.raw &&
      other.resolved.exists === this.resolved.exists &&
      other.resolved.imageUrl === this.resolved.imageUrl &&
      other.resolved.colours.join() === this.resolved.colours.join()
    );
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = `cm-embed cm-embed-${this.parts.kind}${this.resolved.exists ? '' : ' cm-wikilink-missing'}`;
    linkAttributes(wrap, this.parts, this.raw);
    if (this.resolved.imageUrl) {
      const image = document.createElement('img');
      image.src = this.resolved.imageUrl;
      image.alt = this.resolved.label;
      wrap.append(image);
      return wrap;
    }
    for (const hex of this.resolved.colours.slice(0, 12)) {
      const swatch = document.createElement('span');
      swatch.className = 'cm-swatch';
      swatch.style.background = hex;
      wrap.append(swatch);
    }
    const label = document.createElement('span');
    label.className = 'cm-embed-label';
    label.textContent = this.resolved.label;
    wrap.append(label);
    return wrap;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly at: number,
  ) {
    super();
  }

  override eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.at === this.at;
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = this.checked;
    box.className = 'cm-task';
    box.addEventListener('mousedown', (event) => {
      event.preventDefault();
      view.dispatch({ changes: { from: this.at + 1, to: this.at + 2, insert: this.checked ? ' ' : 'x' } });
    });
    return box;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

class RuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const rule = document.createElement('span');
    rule.className = 'cm-rule';
    return rule;
  }
}

function activeLines(state: EditorState, focused: boolean): Set<number> {
  const lines = new Set<number>();
  if (!focused) return lines;
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let line = first; line <= last; line += 1) lines.add(line);
  }
  return lines;
}

function inCode(state: EditorState, pos: number): boolean {
  for (let node: { name: string; parent: unknown } | null = syntaxTree(state).resolveInner(pos, 1); node;) {
    if (CODE_NODES.has(node.name)) return true;
    node = node.parent as { name: string; parent: unknown } | null;
  }
  return false;
}

function overlaps(ranges: { from: number; to: number }[], from: number, to: number): boolean {
  return ranges.some((range) => from < range.to && to > range.from);
}

function lineRange(
  state: EditorState,
  from: number,
  to: number,
  decoration: () => Decoration,
): Range<Decoration>[] {
  const out: Range<Decoration>[] = [];
  for (let pos = from; pos <= to;) {
    const line = state.doc.lineAt(pos);
    out.push(decoration().range(line.from));
    pos = line.to + 1;
  }
  return out;
}

function build(view: EditorView, host: PreviewHost): DecorationSet {
  const { state } = view;
  const live = host.live();
  const active = activeLines(state, view.hasFocus);
  const decorations: Range<Decoration>[] = [];
  const hidden: { from: number; to: number }[] = [];
  const isActive = (pos: number) => active.has(state.doc.lineAt(pos).number);
  const front = frontmatterEnd(state.doc.toString());

  for (const { from, to } of view.visibleRanges) {
    const text = state.doc.sliceString(from, to);

    for (const match of text.matchAll(WIKILINK)) {
      const start = from + match.index;
      const end = start + match[0].length;
      if (start < front || inCode(state, start)) continue;
      const parts = parseLinkText(match[2] ?? '');
      const resolved = host.resolve(parts);
      hidden.push({ from: start, to: end });
      if (live && !isActive(start)) {
        const widget =
          match[1] === '!'
            ? new EmbedWidget(match[0], parts, resolved)
            : new LinkWidget(match[0], parts, resolved);
        decorations.push(Decoration.replace({ widget }).range(start, end));
      } else {
        decorations.push(
          Decoration.mark({
            class: `cm-wikilink-source${resolved.exists ? '' : ' cm-wikilink-missing'}`,
            attributes: { 'data-wikilink': match[0], 'data-kind': parts.kind },
          }).range(start, end),
        );
      }
    }

    for (const match of text.matchAll(TAG)) {
      const start = from + match.index + (match[1]?.length ?? 0);
      const end = start + (match[2]?.length ?? 0);
      if (start < front || overlaps(hidden, start, end) || inCode(state, start)) continue;
      decorations.push(
        Decoration.mark({ class: 'cm-tag', attributes: { 'data-tag': match[2]?.slice(1) ?? '' } }).range(
          start,
          end,
        ),
      );
    }

    for (const match of text.matchAll(HIGHLIGHT)) {
      const start = from + match.index;
      const end = start + match[0].length;
      if (overlaps(hidden, start, end) || inCode(state, start)) continue;
      if (live && !isActive(start)) {
        decorations.push(Decoration.replace({}).range(start, start + 2));
        decorations.push(Decoration.mark({ class: 'cm-highlight' }).range(start + 2, end - 2));
        decorations.push(Decoration.replace({}).range(end - 2, end));
      } else {
        decorations.push(Decoration.mark({ class: 'cm-highlight' }).range(start, end));
      }
      hidden.push({ from: start, to: end });
    }

    for (const match of text.matchAll(COMMENT)) {
      const start = from + match.index;
      const end = start + match[0].length;
      if (overlaps(hidden, start, end) || inCode(state, start)) continue;
      decorations.push(Decoration.mark({ class: 'cm-md-comment' }).range(start, end));
      hidden.push({ from: start, to: end });
    }

    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.to <= front) return false;
        const name = node.name;
        if (/^ATXHeading[1-6]$/.test(name)) {
          const line = state.doc.lineAt(node.from);
          decorations.push(Decoration.line({ class: `cm-heading cm-h${name.slice(-1)}` }).range(line.from));
        } else if (name === 'Blockquote') {
          const first = state.doc.lineAt(node.from);
          const callout = CALLOUT.exec(first.text);
          decorations.push(
            ...lineRange(state, node.from, node.to, () =>
              Decoration.line({ class: callout ? 'cm-quote cm-callout' : 'cm-quote' }),
            ),
          );
          if (callout) {
            decorations.push(
              Decoration.line({
                class: 'cm-callout-title',
                attributes: { 'data-callout': callout[1]?.toLowerCase() ?? 'note' },
              }).range(first.from),
            );
          }
        } else if (name === 'FencedCode') {
          decorations.push(
            ...lineRange(state, node.from, node.to, () => Decoration.line({ class: 'cm-codeblock' })),
          );
          return false;
        }
        if (!live) return undefined;
        if (name === 'HorizontalRule' && !isActive(node.from)) {
          decorations.push(Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to));
        } else if (name === 'TaskMarker' && !isActive(node.from)) {
          const checked = /x/i.test(state.doc.sliceString(node.from, node.to));
          decorations.push(
            Decoration.replace({ widget: new CheckboxWidget(checked, node.from) }).range(node.from, node.to),
          );
        } else if (HIDDEN_MARKS.has(name) && !isActive(node.from) && !overlaps(hidden, node.from, node.to)) {
          if (name === 'HeaderMark' && node.from > state.doc.lineAt(node.from).from) return undefined;
          let end = node.to;
          if ((name === 'HeaderMark' || name === 'QuoteMark') && state.doc.sliceString(end, end + 1) === ' ')
            end += 1;
          decorations.push(Decoration.replace({}).range(node.from, end));
        } else if (name === 'Link' && !isActive(node.from) && !overlaps(hidden, node.from, node.to)) {
          const cursor = node.node.cursor();
          const marks: { from: number; to: number }[] = [];
          let url: { from: number; to: number } | null = null;
          if (cursor.firstChild()) {
            do {
              if (cursor.name === 'LinkMark') marks.push({ from: cursor.from, to: cursor.to });
              if (cursor.name === 'URL') url = { from: cursor.from, to: cursor.to };
            } while (cursor.nextSibling());
          }
          const open = marks[0];
          const close = marks[1];
          if (!open || !close || !url) return false;
          decorations.push(Decoration.replace({}).range(open.from, open.to));
          decorations.push(
            Decoration.mark({
              class: 'cm-md-link',
              attributes: { 'data-href': state.doc.sliceString(url.from, url.to) },
            }).range(open.to, close.from),
          );
          decorations.push(Decoration.replace({}).range(close.from, node.to));
          return false;
        }
        return undefined;
      },
    });
  }

  if (front > 0) {
    decorations.push(...lineRange(state, 0, front - 1, () => Decoration.line({ class: 'cm-frontmatter' })));
  }

  return Decoration.set(decorations, true);
}

function partsOf(element: HTMLElement): LinkParts | null {
  const raw = element.dataset['wikilink'];
  if (!raw) return null;
  return parseLinkText(raw.replace(/^!/, '').slice(2, -2));
}

export function livePreview(host: () => PreviewHost): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view, host());
      }

      update(update: ViewUpdate) {
        const refreshed = update.transactions.some(
          (transaction) =>
            transaction.reconfigured || transaction.effects.some((effect) => effect.is(refreshPreview)),
        );
        if (
          refreshed ||
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.focusChanged
        ) {
          this.decorations = build(update.view, host());
        }
      }
    },
    { decorations: (value) => value.decorations },
  );

  const events = EditorView.domEventHandlers({
    mousedown: (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const modified = event.ctrlKey || event.metaKey;
      const linked = target?.closest<HTMLElement>('[data-wikilink]');
      if (linked) {
        const widget = linked.classList.contains('cm-wikilink') || linked.classList.contains('cm-embed');
        const parts = partsOf(linked);
        if ((!widget && !modified) || !parts) return false;
        event.preventDefault();
        host().open(parts, event);
        return true;
      }
      const tag = target?.closest<HTMLElement>('[data-tag]');
      if (tag && modified) {
        event.preventDefault();
        host().tag(tag.dataset['tag'] ?? '');
        return true;
      }
      const href = target?.closest<HTMLElement>('[data-href]')?.dataset['href'];
      if (href && modified && /^https?:\/\//i.test(href)) {
        event.preventDefault();
        window.open(href, '_blank', 'noopener');
        return true;
      }
      return false;
    },
    mouseover: (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const linked = target?.closest<HTMLElement>('[data-wikilink]');
      const parts = linked ? partsOf(linked) : null;
      host().hover(parts, parts && linked ? linked.getBoundingClientRect() : null);
      return false;
    },
    mouseleave: () => {
      host().hover(null, null);
      return false;
    },
  });

  return [plugin, events];
}
