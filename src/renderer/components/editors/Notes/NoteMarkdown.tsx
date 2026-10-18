import { useMemo, type MouseEvent, type ReactNode } from 'react';
import Markdown, { type Components, type ExtraProps } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import type { Blockquote, PhrasingContent, Root, RootContent, Text } from 'mdast';
import { FileText, Info, Lightbulb, OctagonAlert, Quote, TriangleAlert, Unlink } from 'lucide-react';
import { assetUrl } from '@shared/assets';
import { extractSection, frontmatterEnd, maskCode, parseLinkText, type LinkParts } from '@shared/markdown';
import type { Note } from '@shared/notes';
import { useAssetsSnapshot } from '@renderer/lib/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { resolveNote, searchNotes, useNoteIndex, type NoteIndex } from '@renderer/lib/notes';
import { cx } from '@renderer/ui';
import { MermaidBlock } from './MermaidBlock';
import { folderPathOf } from './paths';
import { useLoopyItems, type LoopyItem } from './useLoopyItems';
import styles from './NoteMarkdown.module.scss';

export interface NoteMarkdownProps {
  body: string;
  noteId?: string | null;
  depth?: number;
  className?: string | undefined;
  onLink: (link: LinkParts, event: MouseEvent) => void;
  onTag: (tag: string) => void;
  onToggleTask?: (line: number) => void;
}

const MAX_DEPTH = 3;
const INLINE =
  /(!?)\[\[([^[\]\n]+?)\]\]|==([^=\n]+)==|(^|[\s(,])#([\p{L}\p{N}_\-/]*[\p{L}_\-/][\p{L}\p{N}_\-/]*)|[ \t]\^[A-Za-z0-9-]+$/gmu;
const CALLOUT = /^\[!([\w-]+)\]([+-]?)[ \t]*(.*)$/;

function textNode(value: string): Text {
  return { type: 'text', value };
}

function custom(
  name: string,
  properties: Record<string, string>,
  children: PhrasingContent[],
): PhrasingContent {
  return { type: 'emphasis', data: { hName: name, hProperties: properties }, children };
}

function splitText(value: string): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  let last = 0;
  for (const match of value.matchAll(INLINE)) {
    const start = match.index;
    if (match[2] !== undefined) {
      if (start > last) out.push(textNode(value.slice(last, start)));
      const parts = parseLinkText(match[2]);
      const label =
        parts.alias ??
        (parts.subpath ? `${parts.target}${parts.target ? ' › ' : ''}${parts.subpath}` : parts.target);
      out.push(
        custom('loopy-link', { raw: match[2], embed: match[1] === '!' ? '1' : '0' }, [textNode(label)]),
      );
      last = start + match[0].length;
    } else if (match[3] !== undefined) {
      if (start > last) out.push(textNode(value.slice(last, start)));
      out.push(custom('mark', {}, [textNode(match[3])]));
      last = start + match[0].length;
    } else if (match[5] !== undefined) {
      const lead = match[4] ?? '';
      if (start + lead.length > last) out.push(textNode(value.slice(last, start + lead.length)));
      out.push(custom('loopy-tag', { tag: match[5] }, [textNode(`#${match[5]}`)]));
      last = start + match[0].length;
    } else {
      if (start > last) out.push(textNode(value.slice(last, start)));
      last = start + match[0].length;
    }
  }
  if (last === 0) return [textNode(value)];
  if (last < value.length) out.push(textNode(value.slice(last)));
  return out;
}

function transform(node: Root | RootContent): void {
  if (!('children' in node)) return;
  if (node.type === 'blockquote') markCallout(node);
  const next: RootContent[] = [];
  for (const child of node.children as RootContent[]) {
    if (child.type === 'text') next.push(...splitText(child.value));
    else {
      transform(child);
      next.push(child);
    }
  }
  (node as { children: RootContent[] }).children = next;
}

function markCallout(node: Blockquote): void {
  const first = node.children[0];
  if (first?.type !== 'paragraph') return;
  const lead = first.children[0];
  if (lead?.type !== 'text') return;
  const newline = lead.value.indexOf('\n');
  const head = newline >= 0 ? lead.value.slice(0, newline) : lead.value;
  const match = CALLOUT.exec(head);
  if (!match) return;
  lead.value = newline >= 0 ? lead.value.slice(newline + 1) : '';
  node.data = {
    hName: 'aside',
    hProperties: {
      dataCallout: (match[1] ?? 'note').toLowerCase(),
      dataTitle: match[3] ?? '',
      dataFold: match[2] ?? '',
    },
  };
}

function remarkLoopy() {
  return (tree: Root) => {
    transform(tree);
  };
}

export function prepareMarkdown(body: string): string {
  const end = frontmatterEnd(body);
  const blankLines = (text: string) => text.replace(/[^\n]/g, '');
  let text = blankLines(body.slice(0, end)) + body.slice(end);
  const masked = maskCode(text, true);
  const comments = [...masked.matchAll(/%%[\s\S]*?%%/g)];
  for (const match of comments.reverse()) {
    const from = match.index;
    const to = from + match[0].length;
    text = text.slice(0, from) + blankLines(text.slice(from, to)) + text.slice(to);
  }
  return text;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

function nodeText(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(nodeText).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return nodeText((children as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

type ElementProps = ExtraProps & { children?: ReactNode; className?: string };

function propertyOf(props: ExtraProps, key: string): string {
  const value = props.node?.properties[key];
  return typeof value === 'string' ? value : Array.isArray(value) ? value.join(' ') : '';
}

const CALLOUT_ICONS: Record<string, typeof Info> = {
  note: Info,
  info: Info,
  tip: Lightbulb,
  hint: Lightbulb,
  idea: Lightbulb,
  warning: TriangleAlert,
  caution: TriangleAlert,
  danger: OctagonAlert,
  bug: OctagonAlert,
  error: OctagonAlert,
  quote: Quote,
};

interface Context {
  index: NoteIndex;
  loopy: ReturnType<typeof useLoopyItems>;
  props: NoteMarkdownProps;
  depth: number;
}

function LoopyEmbed({ item, link, context }: { item: LoopyItem | null; link: LinkParts; context: Context }) {
  const { t } = useTranslation('notes');
  if (!item) {
    return (
      <span className={cx(styles['chip'], styles['missing'])}>
        <Unlink aria-hidden="true" />
        {link.target}
      </span>
    );
  }
  const open = (event: MouseEvent) => {
    context.props.onLink(link, event);
  };
  if (item.asset) {
    const url = assetUrl(item.asset.id);
    if (item.asset.kind === 'image')
      return <img className={styles['image']} src={url} alt={link.alias ?? item.name} />;
    if (item.asset.kind === 'audio') return <audio className={styles['media']} src={url} controls />;
    if (item.asset.kind === 'video') return <video className={styles['media']} src={url} controls />;
  }
  return (
    <button type="button" className={styles['embedCard']} onClick={open}>
      {item.colours.length > 0 ? (
        <span className={styles['swatches']} aria-hidden="true">
          {item.colours.map((hex, index) => (
            <span key={`${hex}-${String(index)}`} style={{ background: hex }} />
          ))}
        </span>
      ) : null}
      <span className={styles['embedName']}>
        {link.alias ?? (item.kind === 'ticket' ? item.detail : item.name)}
      </span>
      <span className={styles['embedKind']}>
        {item.stateName ? (
          <span className={styles['state']} style={{ background: item.stateColour ?? undefined }}>
            {item.stateName}
          </span>
        ) : (
          t(`kinds.${item.kind}`)
        )}
      </span>
    </button>
  );
}

function NoteEmbed({ note, link, context }: { note: Note | null; link: LinkParts; context: Context }) {
  const { t } = useTranslation('notes');
  if (!note) {
    return (
      <span className={cx(styles['chip'], styles['missing'])}>
        <Unlink aria-hidden="true" />
        {link.target}
      </span>
    );
  }
  const section = extractSection(note.body, link.subpath);
  return (
    <span className={styles['embed']} role="group" aria-label={note.title}>
      <button
        type="button"
        className={styles['embedTitle']}
        onClick={(event) => {
          context.props.onLink(link, event);
        }}
      >
        <FileText aria-hidden="true" />
        {link.subpath ? `${note.title} › ${link.subpath}` : note.title}
      </button>
      {context.depth >= MAX_DEPTH ? (
        <span className={styles['muted']}>{t('reading.tooDeep')}</span>
      ) : (
        <NoteMarkdown
          body={section}
          noteId={note.id}
          depth={context.depth + 1}
          onLink={context.props.onLink}
          onTag={context.props.onTag}
        />
      )}
    </span>
  );
}

function WikiLink({ raw, embed, context }: { raw: string; embed: boolean; context: Context }) {
  const { t } = useTranslation('notes');
  const link = parseLinkText(raw);
  if (link.kind === 'note') {
    const note =
      link.target === '' && context.props.noteId
        ? (context.index.byId.get(context.props.noteId) ?? null)
        : resolveNote(context.index, link.target);
    if (embed) return <NoteEmbed note={note} link={link} context={context} />;
    const label =
      link.alias ?? (link.subpath ? `${link.target}${link.target ? ' › ' : ''}${link.subpath}` : link.target);
    return (
      <a
        href="#"
        className={cx(styles['link'], !note && styles['unresolved'])}
        title={note ? note.title : t('reading.createHint', { name: link.target })}
        onClick={(event) => {
          event.preventDefault();
          context.props.onLink(link, event);
        }}
      >
        {label}
      </a>
    );
  }
  const item = context.loopy.find(link.kind, link.target);
  if (embed) return <LoopyEmbed item={item} link={link} context={context} />;
  return (
    <button
      type="button"
      className={cx(styles['chip'], !item && styles['missing'])}
      disabled={!item}
      onClick={(event) => {
        context.props.onLink(link, event);
      }}
    >
      {item?.colours.slice(0, 4).map((hex, index) => (
        <span key={`${hex}-${String(index)}`} className={styles['dot']} style={{ background: hex }} />
      ))}
      {link.alias ?? (item?.kind === 'ticket' ? item.detail : (item?.name ?? link.target))}
    </button>
  );
}

function QueryBlock({ source, context }: { source: string; context: Context }) {
  const { t } = useTranslation('notes');
  const { folders } = useAssetsSnapshot();
  const lines = source.split('\n');
  let columns: string[] = [];
  let sort = '';
  const query: string[] = [];
  for (const line of lines) {
    const table = /^table:\s*(.*)$/i.exec(line.trim());
    const order = /^sort:\s*(.*)$/i.exec(line.trim());
    if (table)
      columns = (table[1] ?? '')
        .split(',')
        .map((column) => column.trim())
        .filter(Boolean);
    else if (order) sort = (order[1] ?? '').trim();
    else query.push(line);
  }
  const hits = searchNotes(context.index, query.join(' '), (note) =>
    folderPathOf(folders, note.folderId),
  ).filter((hit) => hit.note.id !== context.props.noteId);
  const [key = '', direction = 'asc'] = sort.split(/\s+/);
  const value = (note: Note, column: string): string => {
    if (column === 'title') return note.title;
    if (column === 'updated') return note.updatedAt;
    if (column === 'created') return note.createdAt;
    const property = context.index.parsed.get(note.id)?.properties[column];
    return Array.isArray(property)
      ? property.join(', ')
      : property === null || property === undefined
        ? ''
        : String(property);
  };
  if (key) {
    hits.sort((a, b) => value(a.note, key).localeCompare(value(b.note, key), undefined, { numeric: true }));
    if (direction.toLowerCase() === 'desc') hits.reverse();
  }
  const open = (note: Note, event: MouseEvent) => {
    context.props.onLink({ kind: 'note', target: note.title, subpath: null, alias: null }, event);
  };
  if (hits.length === 0) return <p className={styles['query']}>{t('reading.queryEmpty')}</p>;
  if (columns.length > 0) {
    return (
      <table className={styles['queryTable']}>
        <thead>
          <tr>
            <th>{t('reading.queryTitle')}</th>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hits.map((hit) => (
            <tr key={hit.note.id}>
              <td>
                <a
                  href="#"
                  className={styles['link']}
                  onClick={(event) => {
                    event.preventDefault();
                    open(hit.note, event);
                  }}
                >
                  {hit.note.title}
                </a>
              </td>
              {columns.map((column) => (
                <td key={column}>{value(hit.note, column)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <ul className={styles['query']} aria-label={t('reading.queryResults')}>
      {hits.map((hit) => (
        <li key={hit.note.id}>
          <a
            href="#"
            className={styles['link']}
            onClick={(event) => {
              event.preventDefault();
              open(hit.note, event);
            }}
          >
            {hit.note.title}
          </a>
          {hit.lines[0] && hit.lines[0] !== hit.note.title ? (
            <span className={styles['muted']}> — {hit.lines[0]}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function NoteMarkdown(props: NoteMarkdownProps) {
  const { body, depth = 0, className } = props;
  const index = useNoteIndex();
  const loopy = useLoopyItems();
  const { t } = useTranslation('notes');
  const source = useMemo(() => prepareMarkdown(body), [body]);
  const context: Context = { index, loopy, props, depth };

  const components = {
    'loopy-link': (element: ExtraProps) => (
      <WikiLink
        raw={propertyOf(element, 'raw')}
        embed={propertyOf(element, 'embed') === '1'}
        context={context}
      />
    ),
    'loopy-tag': (element: ElementProps) => {
      const tag = propertyOf(element, 'tag');
      return (
        <button
          type="button"
          className={styles['tag']}
          onClick={() => {
            props.onTag(tag);
          }}
        >
          #{tag}
        </button>
      );
    },
    aside: (element: ElementProps) => {
      const type = propertyOf(element, 'dataCallout') || 'note';
      const title = propertyOf(element, 'dataTitle');
      const Icon = CALLOUT_ICONS[type] ?? Info;
      const content = (
        <>
          <span className={styles['calloutTitle']}>
            <Icon aria-hidden="true" />
            {title || type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
          <span className={styles['calloutBody']}>{element.children}</span>
        </>
      );
      const fold = propertyOf(element, 'dataFold');
      return fold ? (
        <details className={styles['callout']} data-callout={type} open={fold === '+'}>
          <summary>{content}</summary>
        </details>
      ) : (
        <aside className={styles['callout']} data-callout={type}>
          {content}
        </aside>
      );
    },
    pre: (element: ElementProps) => {
      const code = element.node?.children[0];
      if (code?.type !== 'element') return <pre className={styles['pre']}>{element.children}</pre>;
      const classes = code.properties.className;
      const text = code.children.map((child) => (child.type === 'text' ? child.value : '')).join('');
      if (Array.isArray(classes) && classes.includes('language-query')) {
        return <QueryBlock source={text} context={context} />;
      }
      if (Array.isArray(classes) && classes.includes('language-mermaid')) {
        return <MermaidBlock source={text} />;
      }
      return <pre className={styles['pre']}>{element.children}</pre>;
    },
    input: (element: ElementProps & { checked?: boolean; type?: string }) =>
      element.type === 'checkbox' ? (
        <input type="checkbox" checked={element.checked ?? false} readOnly className={styles['task']} />
      ) : null,
    li: (element: ElementProps) => {
      const line = element.node?.position?.start.line ?? 0;
      const isTask = (element.className ?? '').includes('task-list-item');
      return (
        <li
          className={cx(element.className, isTask && styles['taskItem'])}
          onClick={(event) => {
            if (!isTask || !props.onToggleTask) return;
            if (!(event.target instanceof HTMLInputElement)) return;
            event.stopPropagation();
            props.onToggleTask(line - 1);
          }}
        >
          {element.children}
        </li>
      );
    },
    a: (element: ElementProps & { href?: string }) => (
      <a href={element.href} className={styles['external']} target="_blank" rel="noreferrer noopener">
        {element.children}
      </a>
    ),
    h1: (element: ElementProps) => <h1 id={slug(nodeText(element.children))}>{element.children}</h1>,
    h2: (element: ElementProps) => <h2 id={slug(nodeText(element.children))}>{element.children}</h2>,
    h3: (element: ElementProps) => <h3 id={slug(nodeText(element.children))}>{element.children}</h3>,
  } as unknown as Components;

  if (body.trim().length === 0 && depth === 0) {
    return <p className={cx(styles['markdown'], styles['muted'], className)}>{t('reading.empty')}</p>;
  }

  return (
    <div className={cx(styles['markdown'], depth > 0 && styles['nested'], className)}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath, remarkLoopy]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }]]}
        components={components}
      >
        {source}
      </Markdown>
    </div>
  );
}

export function headingAnchor(text: string): string {
  return slug(text);
}
