export const LOOPY_LINK_KINDS = ['board', 'palette', 'asset', 'ticket', 'card'] as const;
export type LoopyLinkKind = (typeof LOOPY_LINK_KINDS)[number];
export type NoteLinkKind = 'note' | LoopyLinkKind;

export interface LinkParts {
  kind: NoteLinkKind;
  target: string;
  subpath: string | null;
  alias: string | null;
}

export interface NoteLink extends LinkParts {
  embed: boolean;
  from: number;
  to: number;
}

export interface Heading {
  level: number;
  text: string;
  from: number;
  line: number;
}

export interface Task {
  done: boolean;
  text: string;
  line: number;
}

export type PropertyValue = string | number | boolean | string[] | null;
export type Properties = Record<string, PropertyValue>;

export interface ParsedNote {
  properties: Properties;
  bodyStart: number;
  links: NoteLink[];
  tags: string[];
  headings: Heading[];
  blocks: string[];
  tasks: Task[];
  aliases: string[];
}

const LINK = /(!?)\[\[([^[\]\n]+?)\]\]/g;
const KIND_PREFIX = /^(board|palette|asset|ticket):\s*(.*)$/i;
const TAG = /(^|[\s(,])#([\p{L}\p{N}_\-/]+)/gu;
const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const BLOCK = /[ \t]\^([A-Za-z0-9-]+)[ \t]*$/;
const TASK = /^[ \t]*[-*+][ \t]+\[([ xX])\][ \t]+(.*)$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

export function parseLinkText(inner: string): LinkParts {
  const bar = inner.indexOf('|');
  const head = bar >= 0 ? inner.slice(0, bar) : inner;
  const alias = bar >= 0 ? inner.slice(bar + 1).trim() || null : null;
  const hash = head.indexOf('#');
  const path = (hash >= 0 ? head.slice(0, hash) : head).trim();
  const subpath = hash >= 0 ? head.slice(hash + 1).trim() || null : null;
  const prefixed = KIND_PREFIX.exec(path);
  if (prefixed) {
    return {
      kind: (prefixed[1] ?? 'board').toLowerCase() as LoopyLinkKind,
      target: (prefixed[2] ?? '').trim(),
      subpath,
      alias,
    };
  }
  return { kind: 'note', target: path.replace(/\.md$/i, ''), subpath, alias };
}

export function formatLink(parts: LinkParts, embed = false): string {
  const prefix = parts.kind === 'note' ? '' : `${parts.kind}:`;
  const subpath = parts.subpath ? `#${parts.subpath}` : '';
  const alias = parts.alias ? `|${parts.alias}` : '';
  return `${embed ? '!' : ''}[[${prefix}${parts.target}${subpath}${alias}]]`;
}

function blank(text: string): string {
  return text.replace(/[^\n]/g, ' ');
}

export function frontmatterEnd(body: string): number {
  if (!body.startsWith('---')) return 0;
  const match = /^---[ \t]*\r?\n([\s\S]*?\r?\n)?---[ \t]*(\r?\n|$)/.exec(body);
  return match ? match[0].length : 0;
}

export function maskCode(body: string, keepComments = false): string {
  const lines = body.split('\n');
  let fence: string | null = null;
  const out = lines.map((line) => {
    const open = FENCE.exec(line);
    if (fence !== null) {
      if (open && open[1]?.[0] === fence[0] && (open[1]?.length ?? 0) >= fence.length) fence = null;
      return blank(line);
    }
    if (open) {
      fence = open[1] ?? '```';
      return blank(line);
    }
    const withoutCode = line.replace(/(`+)[^`\n]*?\1/g, (code) => blank(code));
    return keepComments ? withoutCode : withoutCode.replace(/%%[^%\n]*%%/g, (c) => blank(c));
  });
  return out.join('\n');
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function scalar(raw: string): PropertyValue {
  const value = raw.trim();
  if (value === '' || value === '~' || value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => unquote(item))
      .filter((item) => item.length > 0);
  }
  return unquote(value);
}

export function parseProperties(body: string): Properties {
  const end = frontmatterEnd(body);
  if (end === 0) return {};
  const lines = body.slice(0, end).split(/\r?\n/).slice(1);
  const properties: Properties = {};
  let listKey: string | null = null;
  for (const line of lines) {
    if (/^---\s*$/.test(line)) break;
    const item = /^\s+-\s*(.*)$/.exec(line) ?? /^-\s+(.*)$/.exec(line);
    if (item && listKey !== null) {
      const current = properties[listKey];
      const list = Array.isArray(current) ? current : [];
      const value = unquote(item[1] ?? '');
      if (value.length > 0) list.push(value);
      properties[listKey] = list;
      continue;
    }
    const pair = /^([^:#\s][^:]*):(.*)$/.exec(line);
    if (!pair) continue;
    const key = (pair[1] ?? '').trim();
    const rest = pair[2] ?? '';
    if (rest.trim() === '') {
      properties[key] = null;
      listKey = key;
    } else {
      properties[key] = scalar(rest);
      listKey = null;
    }
  }
  return properties;
}

function formatScalar(value: string): string {
  return /^[\w\s./-]*$/.test(value) && value.trim() === value && value !== '' ? value : JSON.stringify(value);
}

export function formatProperties(properties: Properties): string {
  const lines = Object.entries(properties).map(([key, value]) => {
    if (Array.isArray(value)) {
      return value.length === 0
        ? `${key}: []`
        : `${key}:\n${value.map((item) => `  - ${formatScalar(item)}`).join('\n')}`;
    }
    if (value === null) return `${key}:`;
    if (typeof value === 'string') return `${key}: ${formatScalar(value)}`;
    return `${key}: ${String(value)}`;
  });
  return lines.length === 0 ? '' : `---\n${lines.join('\n')}\n---\n`;
}

export function setProperties(body: string, properties: Properties): string {
  return `${formatProperties(properties)}${body.slice(frontmatterEnd(body))}`;
}

function asList(value: PropertyValue | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string')
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  return [];
}

function scanLinks(body: string, masked: string): NoteLink[] {
  const links: NoteLink[] = [];
  for (const match of masked.matchAll(LINK)) {
    const from = match.index;
    const raw = body.slice(from, from + match[0].length);
    const inner = raw.slice(match[1] === '!' ? 3 : 2, -2);
    const parts = parseLinkText(inner);
    if (parts.target.length === 0 && parts.subpath === null) continue;
    links.push({ ...parts, embed: match[1] === '!', from, to: from + match[0].length });
  }
  return links;
}

function maskRanges(text: string, ranges: { from: number; to: number }[]): string {
  let out = text;
  for (const range of ranges) {
    out = out.slice(0, range.from) + blank(out.slice(range.from, range.to)) + out.slice(range.to);
  }
  return out;
}

export function parseNote(body: string): ParsedNote {
  const properties = parseProperties(body);
  const bodyStart = frontmatterEnd(body);
  const masked = maskCode(body);
  const links = scanLinks(body, masked);
  const prose = maskRanges(blank(masked.slice(0, bodyStart)) + masked.slice(bodyStart), links);

  const tags = new Map<string, string>();
  for (const tag of asList(properties['tags'] ?? properties['tag'])) {
    const clean = tag.replace(/^#/, '');
    if (clean.length > 0) tags.set(clean.toLowerCase(), clean);
  }
  for (const match of prose.matchAll(TAG)) {
    const tag = (match[2] ?? '').replace(/[/-]+$/, '');
    if (tag.length === 0 || /^\d+$/.test(tag)) continue;
    if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
  }

  const headings: Heading[] = [];
  const blocks: string[] = [];
  const tasks: Task[] = [];
  let offset = 0;
  prose.split('\n').forEach((line, index) => {
    const original = body.slice(offset, offset + line.length);
    const heading = HEADING.exec(line);
    if (heading) {
      headings.push({
        level: heading[1]?.length ?? 1,
        text: (HEADING.exec(original)?.[2] ?? heading[2] ?? '').trim(),
        from: offset,
        line: index,
      });
    }
    const block = BLOCK.exec(line);
    if (block?.[1]) blocks.push(block[1]);
    const task = TASK.exec(line);
    if (task)
      tasks.push({ done: task[1] !== ' ', text: (TASK.exec(original)?.[2] ?? '').trim(), line: index });
    offset += line.length + 1;
  });

  return {
    properties,
    bodyStart,
    links,
    tags: [...tags.values()],
    headings,
    blocks,
    tasks,
    aliases: asList(properties['aliases'] ?? properties['alias']),
  };
}

export function rewriteLinks(body: string, kind: NoteLinkKind, from: string, to: string): string {
  const needle = from.trim().toLowerCase();
  const links = scanLinks(body, maskCode(body)).filter(
    (link) => link.kind === kind && link.target.toLowerCase() === needle,
  );
  let out = body;
  for (const link of [...links].reverse()) {
    out = out.slice(0, link.from) + formatLink({ ...link, target: to }, link.embed) + out.slice(link.to);
  }
  return out;
}

export function replaceLinks(body: string, replace: (link: NoteLink) => string | null): string {
  const links = scanLinks(body, maskCode(body));
  let out = body;
  for (const link of [...links].reverse()) {
    const next = replace(link);
    if (next !== null) out = out.slice(0, link.from) + next + out.slice(link.to);
  }
  return out;
}

export function extractSection(body: string, subpath: string | null): string {
  const content = body.slice(frontmatterEnd(body));
  if (!subpath) return content;
  const parsed = parseNote(content);
  const lines = content.split('\n');
  if (subpath.startsWith('^')) {
    const id = subpath.slice(1);
    const index = lines.findIndex((line) => BLOCK.exec(line)?.[1] === id);
    if (index < 0) return '';
    let start = index;
    const isItem = (line: string) => /^\s*([-*+]|\d+\.)\s/.test(line);
    const isBreak = (line: string) => line.trim() === '' || HEADING.test(line) || isItem(line);
    if (!isItem(lines[index] ?? '')) {
      while (start > 0 && !isBreak(lines[start - 1] ?? '')) start -= 1;
    }
    return lines
      .slice(start, index + 1)
      .join('\n')
      .replace(BLOCK, '');
  }
  const wanted = subpath.split('#').pop()?.trim().toLowerCase() ?? '';
  const heading = parsed.headings.find((item) => item.text.toLowerCase() === wanted);
  if (!heading) return '';
  const next = parsed.headings.find((item) => item.line > heading.line && item.level <= heading.level);
  return lines.slice(heading.line, next ? next.line : lines.length).join('\n');
}

export interface Mention {
  from: number;
  to: number;
  line: string;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findMentions(body: string, names: string[]): Mention[] {
  const wanted = names.map((name) => name.trim()).filter((name) => name.length > 0);
  if (wanted.length === 0) return [];
  const masked = maskCode(body);
  const prose = maskRanges(
    blank(masked.slice(0, frontmatterEnd(body))) + masked.slice(frontmatterEnd(body)),
    scanLinks(body, masked),
  );
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:${wanted
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|')})(?![\\p{L}\\p{N}_])`,
    'giu',
  );
  const mentions: Mention[] = [];
  for (const match of prose.matchAll(pattern)) {
    const from = match.index;
    const start = body.lastIndexOf('\n', from - 1) + 1;
    const end = body.indexOf('\n', from);
    mentions.push({
      from,
      to: from + match[0].length,
      line: body.slice(start, end < 0 ? body.length : end).trim(),
    });
  }
  return mentions;
}

export function lineAround(body: string, offset: number): string {
  const start = body.lastIndexOf('\n', offset - 1) + 1;
  const end = body.indexOf('\n', offset);
  return body.slice(start, end < 0 ? body.length : end).trim();
}

export function wordCount(body: string): number {
  const text = maskCode(body.slice(frontmatterEnd(body)))
    .replace(/!?\[\[([^[\]|]*\|)?([^[\]]*)\]\]/g, '$2')
    .replace(/[#>*_~=`[\]()|-]/g, ' ');
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu);
  return words ? words.length : 0;
}
