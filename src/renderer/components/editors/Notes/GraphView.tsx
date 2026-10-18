import { useEffect, useMemo, useRef, useState } from 'react';
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type ForceLink,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { Crosshair, Network, Plus, Settings2, Trash2 } from 'lucide-react';
import type { EditorProps } from '@renderer/lib/editors';
import { useAssetsSnapshot } from '@renderer/lib/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { buildGraph, searchNotes, useActiveNoteId, useNoteIndex, type GraphNode } from '@renderer/lib/notes';
import { EmptyState, IconButton, Input, Popover, Switch, ToggleGroup } from '@renderer/ui';
import { folderPathOf } from './paths';
import { useNoteNavigation } from './useNoteNavigation';
import styles from './GraphView.module.scss';

interface GraphGroup {
  query: string;
  colour: string;
}

interface Settings {
  scope: 'global' | 'local';
  depth: number;
  search: string;
  showTags: boolean;
  showAttachments: boolean;
  showOrphans: boolean;
  showUnresolved: boolean;
  groups: GraphGroup[];
  repel: number;
  linkDistance: number;
  centre: number;
  nodeSize: number;
  labels: boolean;
}

const DEFAULTS: Settings = {
  scope: 'global',
  depth: 1,
  search: '',
  showTags: false,
  showAttachments: false,
  showOrphans: true,
  showUnresolved: false,
  groups: [],
  repel: 120,
  linkDistance: 60,
  centre: 0.06,
  nodeSize: 1,
  labels: true,
};

const GROUP_COLOURS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2'];

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode>;

function readSettings(state: Record<string, unknown>): Settings {
  const pick = <K extends keyof Settings>(key: K, valid: (value: unknown) => boolean): Settings[K] =>
    valid(state[key]) ? (state[key] as Settings[K]) : DEFAULTS[key];
  const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
  const isBoolean = (value: unknown) => typeof value === 'boolean';
  return {
    scope: state['scope'] === 'local' ? 'local' : 'global',
    depth: pick('depth', isNumber),
    search: pick('search', (value) => typeof value === 'string'),
    showTags: pick('showTags', isBoolean),
    showAttachments: pick('showAttachments', isBoolean),
    showOrphans: pick('showOrphans', isBoolean),
    showUnresolved: pick('showUnresolved', isBoolean),
    groups: pick('groups', (value) => Array.isArray(value)),
    repel: pick('repel', isNumber),
    linkDistance: pick('linkDistance', isNumber),
    centre: pick('centre', isNumber),
    nodeSize: pick('nodeSize', isNumber),
    labels: pick('labels', isBoolean),
  };
}

function radius(node: GraphNode, size: number): number {
  return (3 + Math.sqrt(node.degree) * 1.6) * size;
}

function cssVar(element: Element, name: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles['slider']}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
      />
    </label>
  );
}

export function GraphView({ state, setState }: EditorProps) {
  const { t } = useTranslation('notes');
  const settings = readSettings(state);
  const index = useNoteIndex();
  const activeId = useActiveNoteId();
  const { folders } = useAssetsSnapshot();
  const nav = useNoteNavigation();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const view = useRef({ x: 0, y: 0, k: 1 });
  const hovered = useRef<string | null>(null);
  const simulation = useRef<Simulation<SimNode, SimLink> | null>(null);
  const draw = useRef<() => void>(() => undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const local = settings.scope === 'local';
  const focusId = local ? activeId : null;
  const pathOf = useMemo(() => (noteFolder: string | null) => folderPathOf(folders, noteFolder), [folders]);

  const data = useMemo(() => {
    if (local && !focusId) return { nodes: [], edges: [] };
    const filter = settings.search.trim()
      ? new Set(
          searchNotes(index, settings.search, (note) => pathOf(note.folderId)).map((hit) => hit.note.id),
        )
      : null;
    const groupSets = settings.groups.map(
      (group) =>
        new Set(
          group.query.trim()
            ? searchNotes(index, group.query, (note) => pathOf(note.folderId)).map((hit) => hit.note.id)
            : [],
        ),
    );
    return buildGraph(index, {
      showTags: settings.showTags,
      showAttachments: settings.showAttachments,
      showOrphans: settings.showOrphans,
      showUnresolved: settings.showUnresolved,
      include: (note) => filter === null || filter.has(note.id) || note.id === focusId,
      groupOf: (note) => {
        const found = groupSets.findIndex((set) => set.has(note.id));
        return found < 0 ? null : found;
      },
      focus: focusId ? { noteId: focusId, depth: settings.depth } : null,
    });
  }, [
    index,
    settings.search,
    settings.groups,
    settings.showTags,
    settings.showAttachments,
    settings.showOrphans,
    settings.showUnresolved,
    settings.depth,
    focusId,
    local,
    pathOf,
  ]);

  useEffect(() => {
    const element = wrap.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const nodes: SimNode[] = data.nodes.map((node) => {
      const known = positions.current.get(node.id);
      return {
        ...node,
        x: known?.x ?? (Math.random() - 0.5) * 200,
        y: known?.y ?? (Math.random() - 0.5) * 200,
      };
    });
    const links: SimLink[] = data.edges.map((edge) => ({ source: edge.source, target: edge.target }));
    const sim = forceSimulation<SimNode, SimLink>(nodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((node) => node.id)
          .distance(settings.linkDistance),
      )
      .force('charge', forceManyBody<SimNode>().strength(-settings.repel))
      .force('x', forceX<SimNode>(0).strength(settings.centre))
      .force('y', forceY<SimNode>(0).strength(settings.centre))
      .force(
        'collide',
        forceCollide<SimNode>((node) => radius(node, settings.nodeSize) + 2),
      )
      .alpha(positions.current.size > 0 ? 0.3 : 1);
    sim.on('tick', () => {
      for (const node of nodes) positions.current.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
      draw.current();
    });
    simulation.current = sim;
    return () => {
      sim.stop();
    };
  }, [data, settings.linkDistance, settings.repel, settings.centre, settings.nodeSize]);

  const paint = () => {
    const element = canvas.current;
    const sim = simulation.current;
    const context = element?.getContext('2d');
    if (!element || !sim || !context) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = size;
    if (element.width !== Math.round(width * ratio)) element.width = Math.round(width * ratio);
    if (element.height !== Math.round(height * ratio)) element.height = Math.round(height * ratio);
    const colours = {
      fg: cssVar(element, '--color-fg', '#222'),
      muted: cssVar(element, '--color-fg-muted', '#888'),
      border: cssVar(element, '--color-border', '#ccc'),
      accent: cssVar(element, '--color-accent', '#4f46e5'),
      tag: cssVar(element, '--color-success', '#16a34a'),
      loopy: cssVar(element, '--color-warning', '#d97706'),
      bg: cssVar(element, '--color-bg', '#fff'),
    };
    const { x, y, k } = view.current;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.translate(width / 2 + x, height / 2 + y);
    context.scale(k, k);
    const nodes = sim.nodes();
    const links = sim.force<ForceLink<SimNode, SimLink>>('link')?.links() ?? [];
    const hover = hovered.current;
    const neighbours = new Set<string>();
    if (hover) {
      neighbours.add(hover);
      for (const link of links) {
        const source = (link.source as SimNode).id;
        const target = (link.target as SimNode).id;
        if (source === hover) neighbours.add(target);
        if (target === hover) neighbours.add(source);
      }
    }
    context.lineWidth = 1 / k;
    for (const link of links) {
      const source = link.source as SimNode;
      const target = link.target as SimNode;
      const lit = hover !== null && (source.id === hover || target.id === hover);
      context.strokeStyle = lit ? colours.accent : colours.border;
      context.globalAlpha = hover && !lit ? 0.25 : 1;
      context.beginPath();
      context.moveTo(source.x ?? 0, source.y ?? 0);
      context.lineTo(target.x ?? 0, target.y ?? 0);
      context.stroke();
    }
    for (const node of nodes) {
      const r = radius(node, settings.nodeSize);
      const dim = hover !== null && !neighbours.has(node.id);
      context.globalAlpha = dim ? 0.25 : 1;
      let fill = colours.muted;
      if (node.kind === 'tag') fill = colours.tag;
      else if (node.kind !== 'note' && node.kind !== 'unresolved') fill = colours.loopy;
      else if (node.group !== null) fill = settings.groups[node.group]?.colour ?? fill;
      if (node.noteId !== null && node.noteId === activeId) fill = colours.accent;
      context.beginPath();
      context.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
      if (node.kind === 'unresolved') {
        context.strokeStyle = colours.muted;
        context.stroke();
      } else {
        context.fillStyle = fill;
        context.fill();
      }
      const showLabel = settings.labels && (k > 0.7 || neighbours.has(node.id) || node.noteId === activeId);
      if (showLabel) {
        context.globalAlpha = dim ? 0.2 : Math.min(1, (k - 0.4) * 2) || 1;
        context.fillStyle = colours.fg;
        context.font = `${String(11 / Math.max(k, 0.8))}px ${cssVar(element, '--font-family', 'sans-serif')}`;
        context.textAlign = 'center';
        context.fillText(node.label, node.x ?? 0, (node.y ?? 0) + r + 11 / Math.max(k, 0.8));
      }
    }
    context.globalAlpha = 1;
  };

  useEffect(() => {
    draw.current = paint;
  });

  useEffect(() => {
    draw.current();
  }, [size, activeId, settings.labels, settings.groups]);

  function toWorld(clientX: number, clientY: number) {
    const rect = canvas.current?.getBoundingClientRect();
    const { x, y, k } = view.current;
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    return {
      x: (clientX - left - size.width / 2 - x) / k,
      y: (clientY - top - size.height / 2 - y) / k,
    };
  }

  function nodeAt(clientX: number, clientY: number): SimNode | null {
    const point = toWorld(clientX, clientY);
    const nodes = simulation.current?.nodes() ?? [];
    for (let position = nodes.length - 1; position >= 0; position -= 1) {
      const node = nodes[position];
      if (!node) continue;
      const r = radius(node, settings.nodeSize) + 3;
      if (Math.hypot((node.x ?? 0) - point.x, (node.y ?? 0) - point.y) <= r) return node;
    }
    return null;
  }

  function openNode(node: GraphNode) {
    if (node.noteId) {
      nav.openNote(node.noteId);
      return;
    }
    if (node.kind === 'tag') {
      nav.openTag(node.label.replace(/^#/, ''));
      return;
    }
    if (node.kind === 'unresolved') {
      void nav.openLink({ kind: 'note', target: node.label, subpath: null, alias: null }, null);
      return;
    }
    void nav.openLink({ kind: node.kind, target: node.label, subpath: null, alias: null }, null);
  }

  const drag = useRef<{ node: SimNode | null; x: number; y: number; moved: boolean } | null>(null);

  const update = (patch: Partial<Settings>) => {
    setState(patch);
  };

  const empty = data.nodes.length === 0;

  return (
    <div className={styles['graph']}>
      <div className={styles['toolbar']}>
        <ToggleGroup
          aria-label={t('graph.label')}
          size="sm"
          value={settings.scope}
          onValueChange={(value) => {
            if (value) update({ scope: value as Settings['scope'] });
          }}
          items={[
            { value: 'global', label: t('graph.global') },
            { value: 'local', label: t('graph.local') },
          ]}
        />
        {local ? (
          <label className={styles['depth']}>
            {t('graph.depth')}
            <input
              type="range"
              min={1}
              max={4}
              step={1}
              value={settings.depth}
              onChange={(event) => {
                update({ depth: Number(event.target.value) });
              }}
            />
          </label>
        ) : null}
        <span className={styles['spacer']} />
        <IconButton
          label={t('graph.reset')}
          size="sm"
          onClick={() => {
            view.current = { x: 0, y: 0, k: 1 };
            draw.current();
          }}
        >
          <Crosshair aria-hidden="true" />
        </IconButton>
        <Popover.Root>
          <Popover.Trigger asChild>
            <IconButton label={t('graph.settings')} size="sm">
              <Settings2 aria-hidden="true" />
            </IconButton>
          </Popover.Trigger>
          <Popover.Content align="end" className={styles['settings']}>
            <Input
              size="sm"
              type="search"
              value={settings.search}
              placeholder={t('graph.search')}
              aria-label={t('graph.search')}
              onChange={(event) => {
                update({ search: event.target.value });
              }}
            />
            <Switch
              size="sm"
              label={t('graph.tags')}
              checked={settings.showTags}
              onCheckedChange={(checked) => {
                update({ showTags: checked });
              }}
            />
            <Switch
              size="sm"
              label={t('graph.attachments')}
              checked={settings.showAttachments}
              onCheckedChange={(checked) => {
                update({ showAttachments: checked });
              }}
            />
            <Switch
              size="sm"
              label={t('graph.orphans')}
              checked={settings.showOrphans}
              onCheckedChange={(checked) => {
                update({ showOrphans: checked });
              }}
            />
            <Switch
              size="sm"
              label={t('graph.unresolved')}
              checked={settings.showUnresolved}
              onCheckedChange={(checked) => {
                update({ showUnresolved: checked });
              }}
            />
            <Switch
              size="sm"
              label={t('graph.labels')}
              checked={settings.labels}
              onCheckedChange={(checked) => {
                update({ labels: checked });
              }}
            />
            <div className={styles['heading']}>{t('graph.groups')}</div>
            {settings.groups.map((group, position) => (
              <div key={String(position)} className={styles['group']}>
                <input
                  type="color"
                  value={group.colour}
                  aria-label={t('graph.groupColour')}
                  onChange={(event) => {
                    update({
                      groups: settings.groups.map((item, at) =>
                        at === position ? { ...item, colour: event.target.value } : item,
                      ),
                    });
                  }}
                />
                <Input
                  size="sm"
                  value={group.query}
                  placeholder="tag:#enemy"
                  aria-label={t('graph.groupQuery')}
                  onChange={(event) => {
                    update({
                      groups: settings.groups.map((item, at) =>
                        at === position ? { ...item, query: event.target.value } : item,
                      ),
                    });
                  }}
                />
                <IconButton
                  label={t('graph.removeGroup')}
                  size="sm"
                  onClick={() => {
                    update({ groups: settings.groups.filter((_item, at) => at !== position) });
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </IconButton>
              </div>
            ))}
            <button
              type="button"
              className={styles['add']}
              onClick={() => {
                update({
                  groups: [
                    ...settings.groups,
                    {
                      query: '',
                      colour: GROUP_COLOURS[settings.groups.length % GROUP_COLOURS.length] ?? '#e11d48',
                    },
                  ],
                });
              }}
            >
              <Plus aria-hidden="true" />
              {t('graph.addGroup')}
            </button>
            <Slider
              label={t('graph.repel')}
              value={settings.repel}
              min={10}
              max={600}
              step={10}
              onChange={(value) => {
                update({ repel: value });
              }}
            />
            <Slider
              label={t('graph.linkDistance')}
              value={settings.linkDistance}
              min={10}
              max={300}
              step={5}
              onChange={(value) => {
                update({ linkDistance: value });
              }}
            />
            <Slider
              label={t('graph.centre')}
              value={settings.centre}
              min={0}
              max={0.3}
              step={0.01}
              onChange={(value) => {
                update({ centre: value });
              }}
            />
            <Slider
              label={t('graph.nodeSize')}
              value={settings.nodeSize}
              min={0.5}
              max={3}
              step={0.1}
              onChange={(value) => {
                update({ nodeSize: value });
              }}
            />
          </Popover.Content>
        </Popover.Root>
      </div>
      <div ref={wrap} className={styles['stage']}>
        {empty ? (
          <EmptyState
            icon={<Network />}
            title={local && !activeId ? t('graph.noNote') : t('graph.empty')}
            description={t('graph.emptyHint')}
          />
        ) : null}
        <canvas
          ref={canvas}
          className={styles['canvas']}
          style={{ width: size.width, height: size.height }}
          role="img"
          aria-label={t('graph.canvas')}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const node = nodeAt(event.clientX, event.clientY);
            drag.current = { node, x: event.clientX, y: event.clientY, moved: false };
            if (node) {
              node.fx = node.x ?? null;
              node.fy = node.y ?? null;
            }
          }}
          onPointerMove={(event) => {
            const current = drag.current;
            if (!current) {
              const node = nodeAt(event.clientX, event.clientY);
              const id = node?.id ?? null;
              if (id !== hovered.current) {
                hovered.current = id;
                event.currentTarget.style.cursor = node ? 'pointer' : 'grab';
                draw.current();
              }
              return;
            }
            const dx = event.clientX - current.x;
            const dy = event.clientY - current.y;
            if (Math.hypot(dx, dy) > 3) current.moved = true;
            if (current.node) {
              const point = toWorld(event.clientX, event.clientY);
              current.node.fx = point.x;
              current.node.fy = point.y;
              simulation.current?.alphaTarget(0.3).restart();
            } else {
              view.current = { ...view.current, x: view.current.x + dx, y: view.current.y + dy };
              current.x = event.clientX;
              current.y = event.clientY;
              draw.current();
            }
          }}
          onPointerUp={() => {
            const current = drag.current;
            drag.current = null;
            if (!current) return;
            if (current.node) {
              current.node.fx = null;
              current.node.fy = null;
              simulation.current?.alphaTarget(0);
              if (!current.moved) openNode(current.node);
            }
          }}
          onPointerLeave={() => {
            if (hovered.current !== null) {
              hovered.current = null;
              draw.current();
            }
          }}
          onWheel={(event) => {
            const before = toWorld(event.clientX, event.clientY);
            const k = Math.min(4, Math.max(0.15, view.current.k * Math.exp(-event.deltaY * 0.0015)));
            view.current = { ...view.current, k };
            const after = toWorld(event.clientX, event.clientY);
            view.current = {
              k,
              x: view.current.x + (after.x - before.x) * k,
              y: view.current.y + (after.y - before.y) * k,
            };
            draw.current();
          }}
        />
        <ul className={styles['srOnly']} aria-label={t('graph.label')}>
          {data.nodes.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => {
                  openNode(node);
                }}
              >
                {node.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
