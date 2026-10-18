import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import { LOOPY_LINK_KINDS, type LoopyLinkKind } from '@shared/markdown';

export interface CompletionNote {
  title: string;
  aliases: string[];
  headings: string[];
  blocks: string[];
}

export interface CompletionData {
  notes: CompletionNote[];
  items: Record<LoopyLinkKind, { name: string; detail: string }[]>;
  tags: string[];
  kindLabel: (kind: LoopyLinkKind) => string;
  aliasLabel: string;
}

function closing(context: CompletionContext): number {
  return context.state.sliceDoc(context.pos, context.pos + 2) === ']]' ? context.pos + 2 : context.pos;
}

function linkOptions(
  name: string,
  detail: string | undefined,
  type: string,
  context: CompletionContext,
  boost = 0,
): Completion {
  return {
    label: name,
    ...(detail ? { detail } : {}),
    type,
    boost,
    apply: (view, _completion, from) => {
      view.dispatch({
        changes: { from, to: closing(context), insert: `${name}]]` },
        selection: { anchor: from + name.length + 2 },
      });
    },
  };
}

function wikilinks(data: () => CompletionData) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\[\[[^[\]\n|]*$/);
    if (!match) return null;
    const inner = match.text.slice(2);
    const from = match.from + 2;
    const source = data();
    const hash = inner.indexOf('#');
    if (hash >= 0) {
      const title = inner.slice(0, hash).toLowerCase();
      const note = source.notes.find(
        (item) =>
          item.title.toLowerCase() === title || item.aliases.some((alias) => alias.toLowerCase() === title),
      );
      if (!note && title !== '') return null;
      const base = inner.slice(0, hash + 1);
      const sub = inner.slice(hash + 1);
      const options = sub.startsWith('^')
        ? (note?.blocks ?? []).map((block) => linkOptions(`${base}^${block}`, undefined, 'constant', context))
        : (note?.headings ?? []).map((heading) =>
            linkOptions(`${base}${heading}`, undefined, 'property', context),
          );
      return { from, options, validFor: /^[^[\]\n|]*$/ };
    }
    const prefixed = /^(board|palette|asset|ticket):/i.exec(inner);
    if (prefixed) {
      const kind = (prefixed[1] ?? 'board').toLowerCase() as LoopyLinkKind;
      return {
        from,
        options: source.items[kind].map((item) =>
          linkOptions(`${kind}:${item.name}`, item.detail, 'variable', context),
        ),
        validFor: /^[^[\]\n|]*$/,
      };
    }
    const options: Completion[] = [];
    for (const note of source.notes) {
      options.push(linkOptions(note.title, undefined, 'text', context, 1));
      for (const alias of note.aliases) {
        options.push({
          ...linkOptions(`${note.title}|${alias}`, source.aliasLabel, 'text', context),
          label: alias,
          detail: `${source.aliasLabel} · ${note.title}`,
        });
      }
    }
    for (const kind of LOOPY_LINK_KINDS) {
      options.push({
        label: `${kind}:`,
        detail: source.kindLabel(kind),
        type: 'keyword',
        boost: -1,
        apply: (view, _completion, start) => {
          view.dispatch({
            changes: { from: start, to: context.pos, insert: `${kind}:` },
            selection: { anchor: start + kind.length + 1 },
          });
        },
      });
    }
    return { from, options, validFor: /^[^[\]\n|#:]*$/ };
  };
}

function tags(data: () => CompletionData) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/(^|[\s(,])#[\p{L}\p{N}_\-/]*$/u);
    if (!match) return null;
    const hash = match.text.indexOf('#');
    const from = match.from + hash + 1;
    if (from === context.pos && !context.explicit) {
      const line = context.state.doc.lineAt(context.pos);
      if (context.pos - 1 === line.from) return null;
    }
    return {
      from,
      options: data().tags.map((tag) => ({ label: tag, type: 'keyword' })),
      validFor: /^[\p{L}\p{N}_\-/]*$/u,
    };
  };
}

export function noteCompletion(data: () => CompletionData): Extension {
  return autocompletion({ override: [wikilinks(data), tags(data)], icons: false, activateOnTyping: true });
}
