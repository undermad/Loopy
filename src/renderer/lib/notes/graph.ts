import type { NoteLinkKind } from '@shared/markdown';
import type { Note } from '@shared/notes';
import type { NoteIndex } from './links';

export type GraphNodeKind = NoteLinkKind | 'tag' | 'unresolved';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  noteId: string | null;
  degree: number;
  group: number | null;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphOptions {
  showTags: boolean;
  showAttachments: boolean;
  showOrphans: boolean;
  showUnresolved: boolean;
  include: (note: Note) => boolean;
  groupOf: (note: Note) => number | null;
  focus: { noteId: string; depth: number } | null;
}

export const DEFAULT_GRAPH_OPTIONS: GraphOptions = {
  showTags: false,
  showAttachments: false,
  showOrphans: true,
  showUnresolved: false,
  include: () => true,
  groupOf: () => null,
  focus: null,
};

function noteKey(id: string): string {
  return `note:${id}`;
}

export function buildGraph(index: NoteIndex, options: GraphOptions = DEFAULT_GRAPH_OPTIONS): GraphData {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const add = (node: Omit<GraphNode, 'degree'>) => {
    if (!nodes.has(node.id)) nodes.set(node.id, { ...node, degree: 0 });
  };
  const connect = (source: string, target: string) => {
    if (source === target) return;
    const key = source < target ? `${source}|${target}` : `${target}|${source}`;
    if (!edges.has(key)) edges.set(key, { source, target });
  };

  const included = index.notes.filter((note) => options.include(note));
  const allowed = new Set(included.map((note) => note.id));
  for (const note of included) {
    add({
      id: noteKey(note.id),
      kind: 'note',
      label: note.title,
      noteId: note.id,
      group: options.groupOf(note),
    });
  }
  for (const note of included) {
    for (const ref of index.outgoing.get(note.id) ?? []) {
      const { link } = ref;
      if (link.kind === 'note') {
        if (ref.targetId) {
          if (allowed.has(ref.targetId)) connect(noteKey(note.id), noteKey(ref.targetId));
        } else if (options.showUnresolved && link.target.length > 0) {
          const id = `unresolved:${link.target.toLowerCase()}`;
          add({ id, kind: 'unresolved', label: link.target, noteId: null, group: null });
          connect(noteKey(note.id), id);
        }
      } else if (options.showAttachments && link.target.length > 0) {
        const id = `${link.kind}:${link.target.toLowerCase()}`;
        add({ id, kind: link.kind, label: link.target, noteId: null, group: null });
        connect(noteKey(note.id), id);
      }
    }
    if (options.showTags) {
      for (const tag of index.parsed.get(note.id)?.tags ?? []) {
        const id = `tag:${tag.toLowerCase()}`;
        add({ id, kind: 'tag', label: `#${tag}`, noteId: null, group: null });
        connect(noteKey(note.id), id);
      }
    }
  }

  for (const edge of edges.values()) {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (source) source.degree += 1;
    if (target) target.degree += 1;
  }

  let keep = new Set(nodes.keys());
  if (options.focus) {
    const start = noteKey(options.focus.noteId);
    const neighbours = new Map<string, string[]>();
    for (const edge of edges.values()) {
      neighbours.set(edge.source, [...(neighbours.get(edge.source) ?? []), edge.target]);
      neighbours.set(edge.target, [...(neighbours.get(edge.target) ?? []), edge.source]);
    }
    keep = new Set(nodes.has(start) ? [start] : []);
    let frontier = [...keep];
    for (let depth = 0; depth < options.focus.depth; depth += 1) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const other of neighbours.get(id) ?? []) {
          if (!keep.has(other)) {
            keep.add(other);
            next.push(other);
          }
        }
      }
      frontier = next;
    }
  }
  if (!options.showOrphans && !options.focus) {
    for (const node of nodes.values()) if (node.degree === 0) keep.delete(node.id);
  }
  return {
    nodes: [...nodes.values()].filter((node) => keep.has(node.id)),
    edges: [...edges.values()].filter((edge) => keep.has(edge.source) && keep.has(edge.target)),
  };
}
