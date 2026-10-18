import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import {
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  useStore as useFlowStore,
  type Connection,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodePositionChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PenTool, Plus, Unlink } from 'lucide-react';
import {
  EDGE_HANDLES,
  type BoardChanges,
  type BoardEdge,
  type BoardNode,
  type EdgeHandle,
} from '@shared/board';
import { assetUrl, type Asset } from '@shared/assets';
import {
  assetDropZoneProps,
  importFiles,
  pickFiles,
  useAssetDropZone,
  useAssetsSnapshot,
  type AssetDragDetail,
} from '@renderer/lib/assets';
import {
  absoluteRect,
  boardScopeProps,
  bringToFront,
  childSelection,
  commitChanges,
  containerAt,
  createEdge,
  createItem,
  descendants,
  dockCluster,
  dockGroup,
  dockItems,
  rotateCluster,
  rotateVector,
  rotationOf,
  clusterSelection,
  drillTarget,
  duplicateItems,
  effectiveZ,
  enteredScopes,
  findDock,
  getBoardNodes,
  getBoardSelection,
  isReachable,
  itemAt,
  fitSize,
  measureImage,
  gridStep,
  loadBoard,
  copyItems,
  BOARD_CLIPBOARD_TYPE,
  parseClip,
  pasteItems,
  recallClip,
  rememberClip,
  serialiseClip,
  type BoardClip,
  nextZ,
  parentSelection,
  presetSize,
  reparent,
  seams,
  selectedDockGroup,
  transformGroup,
  sendToBack,
  setActiveBoard,
  setBoardSelection,
  setLiveGeometry,
  sidesBetween,
  snapToStep,
  splitSeam,
  undock,
  useBoardSelection,
  useBoardSnapshot,
  useLiveLayers,
  useBoards,
  withData,
  alignItems,
  distributeItems,
  quickCreate,
  snapGuides,
  type Alignment,
  type DockSnap,
  type Guide,
  type ItemPreset,
  type Side,
  type LiveGeometry,
  type Point,
  type Rect,
  type Segment,
} from '@renderer/lib/board';
import { findCardTemplate, useCardTemplates } from '@renderer/lib/cards';
import { readableTextColour } from '@renderer/lib/colour';
import type { EditorProps } from '@renderer/lib/editors';
import { useEditTarget } from '@renderer/lib/commands';
import { useSettings } from '@renderer/lib/settings';
import { useTranslation } from '@renderer/lib/i18n';
import { useColourFromRef } from '@renderer/lib/palettes';
import { panelActions, usePanelOpen, type PanelPlacement } from '@renderer/lib/workspaces';
import { EmptyState, Spinner, cx, useToast } from '@renderer/ui';
import { AreaHeaderContent } from '../../Shell/AreaHeaderContent';
import { ArrowEdge } from './ArrowEdge';
import { BoardActionsContext, type BoardActions, type DropTarget } from './BoardContext';
import { BoardContextMenu, type BoardMenuActions } from './BoardContextMenu';
import { BoardHeader, type BoardPanel } from './BoardHeader';
import { BoardToolbar } from './BoardToolbar';
import { CreationOverlay, type Placement } from './CreationOverlay';
import { DockGroupFrame } from './DockGroupFrame';
import { QUICK_MENU_SIZE, QuickCreateMenu, type QuickChoice } from './QuickCreateMenu';
import { Grid } from './Grid';
import { SelectionGuard } from './SelectionGuard';
import { TemplateEditorDialog } from './cards/TemplateEditorDialog';
import { CardItem } from './items/CardItem';
import { ContainerItem } from './items/ContainerItem';
import { FileItem } from './items/FileItem';
import { ImageItem } from './items/ImageItem';
import { TextItem } from './items/TextItem';
import { readViewport, settleNodeChanges, toFlowEdges, toFlowNodes } from './boardFlow';
import { presetForTool, readShape, readTool, toolForKey, type BoardTool } from './tools';
import styles from './BoardEditor.module.scss';

const nodeTypes = {
  text: TextItem,
  image: ImageItem,
  container: ContainerItem,
  card: CardItem,
  file: FileItem,
};
const edgeTypes = { arrow: ArrowEdge };
export const PROPERTIES_WIDTH = 320;
const PANEL_PLACEMENT: Record<BoardPanel, { width: number; placement: PanelPlacement }> = {
  assets: { width: 300, placement: { side: 'before' } },
  layers: { width: 280, placement: { anchor: 'properties', direction: 'column' } },
  properties: { width: PROPERTIES_WIDTH, placement: {} },
};

const NO_IDS: string[] = [];

function flag(state: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = state[key];
  return typeof value === 'boolean' ? value : fallback;
}
const QUICK_GAP = 48;
const OPPOSITE: Record<Side, Side> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };

interface QuickOpen {
  left: number;
  top: number;
  at: Point;
  link: { sourceId: string; side: Side | null; handle: EdgeHandle | null } | null;
}
const MIN_ZOOM = 0.01;
const MAX_ZOOM = 20;
const DOCK_DISTANCE = 16;
const GUIDE_DISTANCE = 6;
const QUICK_SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
const ALIGN_KEYS: Record<string, Alignment> = {
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'top',
  KeyS: 'bottom',
  KeyH: 'centre',
  KeyV: 'middle',
};

interface DragSession {
  primaryId: string;
  ids: string[];
  followers: string[];
  start: Map<string, Point>;
  alt: boolean;
  delta: Point;
  snap: DockSnap | null;
}

function shifted(point: Point | undefined, delta: Point): Point {
  return { x: (point?.x ?? 0) + delta.x, y: (point?.y ?? 0) + delta.y };
}

function useModifierHeld(key: 'Control' | 'Alt' | 'Shift'): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const update = (event: globalThis.KeyboardEvent | MouseEvent) => {
      setHeld(
        key === 'Control' ? event.ctrlKey || event.metaKey : key === 'Shift' ? event.shiftKey : event.altKey,
      );
    };
    const release = () => {
      setHeld(false);
    };
    window.addEventListener('keydown', update);
    window.addEventListener('keyup', update);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', update);
      window.removeEventListener('keyup', update);
      window.removeEventListener('blur', release);
    };
  }, [key]);
  return held;
}

interface Draft {
  base: unknown;
  nodes: Node[];
}

function isHandle(value: string | null | undefined): value is EdgeHandle {
  return (EDGE_HANDLES as readonly string[]).includes(value ?? '');
}

function isTyping(target: EventTarget): boolean {
  const element = target as HTMLElement;
  return (
    element.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) ||
    element.closest('[role="dialog"], [role="menu"]') !== null
  );
}

interface CanvasProps extends Pick<EditorProps, 'state' | 'setState'> {
  boardId: string;
  onEditTemplate: (templateId: string | null) => void;
}

function Canvas({ boardId, state, setState, onEditTemplate }: CanvasProps) {
  const { t } = useTranslation('editors');
  const toast = useToast();
  const snapshot = useBoardSnapshot(boardId);
  const flow = useReactFlow();
  const zoom = useFlowStore((store) => store.transform[2]);
  const templateList = useCardTemplates();
  const templates = useMemo(() => templateList ?? [], [templateList]);
  const assetList = useAssetsSnapshot().assets;
  const images = useMemo(() => assetList.filter((asset) => asset.kind === 'image'), [assetList]);
  const preferences = useSettings().editors.board;
  const grid = flag(state, 'grid', preferences.grid);
  const minimap = flag(state, 'minimap', preferences.minimap);
  const snap = flag(state, 'snap', preferences.snap);
  const wheel = preferences.wheel;
  const tool = readTool(state);
  const shape = readShape(state);
  const templateId = typeof state['cardTemplate'] === 'string' ? state['cardTemplate'] : null;
  const pending = useRef(new Map<string, Node>());
  const surface = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const storeSelection = useBoardSelection();
  const liveLayers = useLiveLayers();
  const selectedIds = storeSelection?.boardId === boardId ? storeSelection.nodeIds : NO_IDS;
  const selectedEdgeIds = storeSelection?.boardId === boardId ? storeSelection.edgeIds : NO_IDS;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [dockHint, setDockHint] = useState<Segment | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const [preview, setPreview] = useState<BoardNode[] | null>(null);
  const [quick, setQuick] = useState<QuickOpen | null>(null);
  const screenPointer = useRef<Point | null>(null);
  const pressSelection = useRef<string[]>([]);
  const dragSession = useRef<DragSession | null>(null);
  const deep = useModifierHeld('Control');
  const shiftHeld = useModifierHeld('Shift');
  const snapping = snap || deep;
  const background = useColourFromRef(
    snapshot?.board.backgroundColor ?? '#ffffff',
    snapshot?.board.backgroundRef,
  );
  const gridColor = useColourFromRef(snapshot?.board.gridColor ?? '', snapshot?.board.gridRef);
  const step = snapshot ? gridStep(snapshot.board, zoom) : 24;
  const allNodes = useMemo(() => snapshot?.nodes ?? [], [snapshot]);

  useEffect(() => {
    if (!snapshot) void loadBoard(boardId);
  }, [boardId, snapshot]);

  useEffect(() => {
    setActiveBoard(boardId);
  }, [boardId]);

  const showDropTarget = useCallback((next: DropTarget | null) => {
    setDropTarget((current) => (current?.id === next?.id && current?.kind === next?.kind ? current : next));
  }, []);

  const commit = useCallback(
    (changes: BoardChanges) => {
      void commitChanges(boardId, changes);
    },
    [boardId],
  );

  const dockedPeers = useMemo<ReadonlySet<string>>(() => {
    const only = selectedIds.length === 1 ? selectedIds[0] : undefined;
    if (!only) return new Set();
    return new Set(dockCluster(only, allNodes).filter((id) => id !== only));
  }, [allNodes, selectedIds]);

  const wholeGroup = useMemo(() => selectedDockGroup(selectedIds, allNodes), [allNodes, selectedIds]);
  const wholeGroupIds = useMemo<ReadonlySet<string>>(() => new Set(wholeGroup?.ids ?? []), [wholeGroup]);
  const shownGroup = useMemo(() => {
    if (!wholeGroup || !preview) return wholeGroup;
    const shown = allNodes.map((node) => preview.find((candidate) => candidate.id === node.id) ?? node);
    return dockGroup(wholeGroup.dock, shown);
  }, [allNodes, preview, wholeGroup]);

  const seamList = useMemo(() => {
    const only = selectedIds[0];
    if (wholeGroup) return seams(wholeGroup.ids, allNodes);
    return dockedPeers.size > 0 && only ? seams(dockCluster(only, allNodes), allNodes) : [];
  }, [allNodes, dockedPeers, selectedIds, wholeGroup]);

  const select = useCallback(
    (nodeIds: string[], edgeIds: string[] = []) => {
      setDraft(null);
      setBoardSelection(boardId, nodeIds, edgeIds);
    },
    [boardId],
  );

  const setTool = useCallback(
    (next: BoardTool) => {
      setState({ tool: next });
    },
    [setState],
  );

  const actions = useMemo<BoardActions>(
    () => ({
      boardId,
      textColour: readableTextColour(background),
      editingId,
      setEditingId,
      updateNode: (node) => {
        commit({ upsertNodes: [node] });
      },
      updateEdge: (edge) => {
        commit({ upsertEdges: [edge] });
      },
      openTemplateEditor: onEditTemplate,
      dropTarget,
      dockedPeers,
      wholeGroup: wholeGroupIds,
      snapping,
      keepRatio: shiftHeld,
      previewRotation: (id, angle) => {
        const turned = angle === null ? [] : rotateCluster(id, angle, allNodes);
        setPreview(turned.length > 1 ? turned : null);
      },
      rotateItem: (node, angle) => {
        setPreview(null);
        commit({ upsertNodes: rotateCluster(node.id, angle, allNodes) });
      },
      previewGeometry: (id, rect) => {
        const node = allNodes.find((candidate) => candidate.id === id);
        setPreview(rect && node ? [{ ...node, ...rect }] : null);
      },
      setTransforming,
      gridStep: (scale) => (snapshot ? gridStep(snapshot.board, scale) : 24),
    }),
    [
      allNodes,
      background,
      boardId,
      commit,
      dockedPeers,
      dropTarget,
      editingId,
      onEditTemplate,
      shiftHeld,
      snapping,
      snapshot,
      wholeGroupIds,
    ],
  );

  const baseNodes = useMemo<Node[]>(() => {
    if (draft?.base === snapshot) return draft.nodes;
    if (!snapshot) return [];
    return toFlowNodes(snapshot).map((node) => ({
      ...node,
      deletable: node.data.node.data['locked'] !== true,
    }));
  }, [draft, snapshot]);

  const nodes = useMemo<Node[]>(() => {
    const entered = enteredScopes(selectedIds, allNodes);
    const reordered = Object.keys(liveLayers).length > 0;
    const layered = reordered
      ? allNodes.map((node) => (node.id in liveLayers ? { ...node, z: liveLayers[node.id] ?? node.z } : node))
      : allNodes;
    return baseNodes.map((node) => {
      const { pointerEvents: _ignored, ...style } = node.style ?? {};
      const parentId = node.parentId ?? null;
      const inert = !deep && !isReachable({ parentId }, entered);
      const source = reordered ? layered.find((candidate) => candidate.id === node.id) : undefined;
      const turned = preview?.find((candidate) => candidate.id === node.id);
      return {
        ...node,
        ...(turned
          ? {
              position: { x: turned.x, y: turned.y },
              width: turned.width,
              height: turned.height,
              data: { node: turned },
            }
          : {}),
        ...(source ? { zIndex: effectiveZ(source, layered) } : {}),
        selected: selectedIds.includes(node.id),
        style: inert ? { ...style, pointerEvents: 'none' } : style,
      };
    });
  }, [allNodes, baseNodes, deep, liveLayers, preview, selectedIds]);

  const edges = useMemo(
    () =>
      snapshot
        ? toFlowEdges(snapshot).map((edge) => ({ ...edge, selected: selectedEdgeIds.includes(edge.id) }))
        : [],
    [snapshot, selectedEdgeIds],
  );

  const assistDrag = useCallback(
    (changes: NodeChange[]): NodeChange[] => {
      const session = dragSession.current;
      if (!session || !snapshot) return changes;
      const primary = changes.find(
        (change): change is NodePositionChange =>
          change.type === 'position' && change.id === session.primaryId,
      );
      const source = snapshot.nodes.find((node) => node.id === session.primaryId);
      const start = session.start.get(session.primaryId);
      if (!primary || !source || !start) return changes;
      if (primary.position) {
        let delta = { x: primary.position.x - start.x, y: primary.position.y - start.y };
        const moving = new Set([...session.ids, ...session.followers]);
        const rect = absoluteRect({ ...source, x: start.x + delta.x, y: start.y + delta.y }, snapshot.nodes);
        const candidates = session.alt
          ? []
          : snapshot.nodes
              .filter(
                (node) =>
                  !moving.has(node.id) && node.parentId === source.parentId && node.data['hidden'] !== true,
              )
              .map((node) => ({ id: node.id, rect: absoluteRect(node, snapshot.nodes) }));
        const snapped = findDock(rect, candidates, DOCK_DISTANCE / zoom);
        if (snapped) delta = { x: delta.x + snapped.dx, y: delta.y + snapped.dy };
        let lines: Guide[] = [];
        if (!snapped && !snapping) {
          const blocked = new Set([...moving].flatMap((id) => [id, ...descendants(id, snapshot.nodes)]));
          const others = snapshot.nodes
            .filter((node) => !blocked.has(node.id) && node.data['hidden'] !== true)
            .map((node) => absoluteRect(node, snapshot.nodes));
          const aligned = snapGuides(rect, others, GUIDE_DISTANCE / zoom);
          delta = { x: delta.x + aligned.dx, y: delta.y + aligned.dy };
          lines = aligned.guides;
        }
        session.delta = delta;
        session.snap = snapped;
        setDockHint(snapped?.segment ?? null);
        setGuides(lines);
      }
      const rewritten = changes.map((change) =>
        change.type === 'position' && change.position && session.start.has(change.id)
          ? { ...change, position: shifted(session.start.get(change.id), session.delta) }
          : change,
      );
      const followers: NodeChange[] = session.followers
        .filter((id) => !changes.some((change) => 'id' in change && change.id === id))
        .map((id) => ({
          type: 'position',
          id,
          dragging: primary.dragging ?? false,
          position: shifted(session.start.get(id), session.delta),
        }));
      return [...rewritten, ...followers];
    },
    [snapping, snapshot, zoom],
  );

  const startDrag = useCallback(
    (event: { altKey: boolean }, node: Node, dragging: Node[]) => {
      const ids = dragging.map((item) => item.id);
      const followers = event.altKey
        ? []
        : [...new Set(ids.flatMap((id) => dockCluster(id, allNodes)))].filter((id) => !ids.includes(id));
      const start = new Map(
        allNodes
          .filter((item) => ids.includes(item.id) || followers.includes(item.id))
          .map((item) => [item.id, { x: item.x, y: item.y }]),
      );
      setDragActive(true);
      dragSession.current = {
        primaryId: node.id,
        ids,
        followers,
        start,
        alt: event.altKey,
        delta: { x: 0, y: 0 },
        snap: null,
      };
    },
    [allNodes],
  );

  const endDrag = useCallback(() => {
    const session = dragSession.current;
    dragSession.current = null;
    setDockHint(null);
    setGuides([]);
    setDragActive(false);
    if (!session) return;
    const latest = getBoardNodes(boardId);
    const docking = session.alt
      ? undock(session.ids, latest)
      : session.snap
        ? dockItems([...session.ids, ...session.followers], session.snap.targetId, latest)
        : [];
    if (docking.length > 0) commit({ upsertNodes: docking });
  }, [boardId, commit]);

  const onNodesChange = useCallback(
    (incoming: NodeChange[]) => {
      if (!snapshot) return;
      const changes = assistDrag(incoming);
      const next = applyNodeChanges(changes, nodes);
      setDraft({ base: snapshot, nodes: next });
      if (changes.some((change) => change.type === 'select')) {
        const picked = next.filter((node) => node.selected).map((node) => node.id);
        const only = picked.length === 1 ? picked[0] : undefined;
        const selected = only
          ? clusterSelection(only, getBoardSelection(boardId).nodeIds, snapshot.nodes)
          : picked;
        setBoardSelection(boardId, selected, getBoardSelection(boardId).edgeIds);
      }
      const { updates, removed, moved } = settleNodeChanges(changes, next, snapshot.nodes, pending.current);
      const live: Record<string, LiveGeometry | null> = {};
      for (const change of changes) {
        if (change.type !== 'position' && change.type !== 'dimensions') continue;
        const node = next.find((candidate) => candidate.id === change.id);
        if (node) {
          live[change.id] = {
            x: node.position.x,
            y: node.position.y,
            width: node.width ?? node.measured?.width ?? 0,
            height: node.height ?? node.measured?.height ?? 0,
          };
        }
      }
      for (const node of updates) live[node.id] = null;
      for (const id of removed) live[id] = null;
      if (Object.keys(live).length > 0) setLiveGeometry(live);
      const after = snapshot.nodes.map((node) => updates.find((update) => update.id === node.id) ?? node);
      const settled = updates.map((node) => {
        if (!moved.includes(node.id) || (node.parentId && moved.includes(node.parentId))) return node;
        const rect = absoluteRect(node, after);
        const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        const target = containerAt(centre, after, [node.id])?.id ?? null;
        return target === node.parentId ? node : reparent(node, target, after);
      });
      const removedAll = [...new Set(removed.flatMap((id) => [id, ...descendants(id, snapshot.nodes)]))];
      if (settled.length > 0 || removedAll.length > 0) {
        commit({ upsertNodes: settled, removeNodeIds: removedAll });
      }
    },
    [assistDrag, boardId, commit, nodes, snapshot],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id);
      if (removed.length > 0) commit({ removeEdgeIds: removed });
      const next = applyEdgeChanges(changes, edges);
      const selected = next.filter((edge) => edge.selected).map((edge) => edge.id);
      if (changes.some((change) => change.type === 'select')) {
        setBoardSelection(boardId, getBoardSelection(boardId).nodeIds, selected);
      }
    },
    [boardId, commit, edges],
  );

  const connect = useCallback(
    (sourceId: string, targetId: string, sourceHandle?: string | null, targetHandle?: string | null) => {
      if (!snapshot || sourceId === targetId) return;
      const source = snapshot.nodes.find((node) => node.id === sourceId);
      const target = snapshot.nodes.find((node) => node.id === targetId);
      if (!source || !target) return;
      const sides = sidesBetween(absoluteRect(source, snapshot.nodes), absoluteRect(target, snapshot.nodes));
      const edge = createEdge(boardId, sourceId, targetId, {
        sourceHandle: isHandle(sourceHandle) ? sourceHandle : sides.source,
        targetHandle: isHandle(targetHandle) ? targetHandle : sides.target,
      });
      commit({ upsertEdges: [edge] });
      select([], [edge.id]);
    },
    [boardId, commit, select, snapshot],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      connect(connection.source, connection.target, connection.sourceHandle, connection.targetHandle);
    },
    [connect],
  );

  const place = useCallback(
    (
      preset: ItemPreset,
      placement: Placement,
      data: Record<string, unknown> = {},
      size?: { width: number; height: number },
    ) => {
      if (!snapshot) return null;
      const base = size ?? presetSize(preset);
      const anchor = 'point' in placement ? placement.point : placement.rect;
      let rect: Rect =
        'rect' in placement && placement.rect.width >= 8 && placement.rect.height >= 8
          ? placement.rect
          : { x: anchor.x - base.width / 2, y: anchor.y - base.height / 2, ...base };
      if (snap) {
        rect = {
          x: snapToStep(rect.x, step),
          y: snapToStep(rect.y, step),
          width: Math.max(step, snapToStep(rect.width, step)),
          height: Math.max(step, snapToStep(rect.height, step)),
        };
      }
      const created = createItem({ boardId, preset, rect, z: nextZ(snapshot.nodes), data });
      const parent = containerAt({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, snapshot.nodes);
      const node = parent ? reparent(created, parent.id, [...snapshot.nodes, created]) : created;
      commit({ upsertNodes: [node] });
      select([node.id]);
      return node;
    },
    [boardId, commit, select, snap, snapshot, step],
  );

  const viewportCentre = useCallback((): Point => {
    const bounds = surface.current?.getBoundingClientRect();
    return flow.screenToFlowPosition({
      x: (bounds?.left ?? 0) + (bounds?.width ?? 0) / 2,
      y: (bounds?.top ?? 0) + (bounds?.height ?? 0) / 2,
    });
  }, [flow]);

  const onPlace = useCallback(
    (placement: Placement) => {
      const preset = presetForTool(tool);
      if (!preset) return;
      if (preset === 'card') {
        const template = findCardTemplate(templateId) ?? templates[0] ?? null;
        if (!template) {
          onEditTemplate(null);
          return;
        }
        place(
          'card',
          placement,
          { templateId: template.id, values: {} },
          { width: template.width, height: template.height },
        );
      } else {
        const node = place(preset, placement);
        if (node && (node.type === 'text' || node.type === 'container')) setEditingId(node.id);
      }
      setTool('select');
    },
    [onEditTemplate, place, setTool, templateId, templates, tool],
  );

  const placeImage = useCallback(
    (asset: Pick<Asset, 'id' | 'name' | 'width' | 'height'>, point?: Point) => {
      const size = fitSize(asset.width ?? 0, asset.height ?? 0);
      place('image', { point: point ?? viewportCentre() }, { assetId: asset.id, alt: asset.name }, size);
    },
    [place, viewportCentre],
  );

  const importImages = useCallback(async () => {
    const ids = await pickFiles('auto');
    const centre = viewportCentre();
    const sizes = await Promise.all(ids.map((id) => measureImage(assetUrl(id))));
    ids.forEach((id, index) => {
      placeImage(
        { id, name: '', ...(sizes[index] ?? { width: 0, height: 0 }) },
        { x: centre.x + index * 24, y: centre.y + index * 24 },
      );
    });
  }, [placeImage, viewportCentre]);

  const placeFile = useCallback(
    (asset: Pick<Asset, 'id' | 'kind' | 'width' | 'height'>, point: Point) => {
      const size =
        asset.kind === 'video'
          ? fitSize(asset.width ?? 640, asset.height ?? 360, 360)
          : asset.kind === 'audio'
            ? { width: 300, height: 112 }
            : presetSize('file');
      place('file', { point }, { assetId: asset.id }, size);
    },
    [place],
  );

  const imageFieldAt = useCallback((nodeId: string, x: number, y: number): string | null => {
    const fields = surface.current?.querySelectorAll<HTMLElement>(
      `.react-flow__node[data-id="${CSS.escape(nodeId)}"] [data-kind="image"][data-field-id]`,
    );
    for (const field of fields ?? []) {
      const rect = field.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
        return field.dataset['fieldId'] ?? null;
    }
    return null;
  }, []);

  const dropAssets = useCallback(
    (ids: string[], x: number, y: number) => {
      const point = flow.screenToFlowPosition({ x, y });
      const list = ids.flatMap((id) => assetList.filter((asset) => asset.id === id));
      const first = list[0];
      if (list.length === 1 && first?.kind === 'image') {
        const target = itemAt(point, allNodes);
        if (target?.type === 'image') {
          commit({ upsertNodes: [withData(target, { assetId: first.id, alt: first.name })] });
          select([target.id]);
          return;
        }
        const fieldId = target?.type === 'card' ? imageFieldAt(target.id, x, y) : null;
        if (target && fieldId) {
          const values = (target.data['values'] ?? {}) as Record<string, unknown>;
          commit({ upsertNodes: [withData(target, { values: { ...values, [fieldId]: first.id } })] });
          select([target.id]);
          return;
        }
      }
      list.forEach((asset, index) => {
        const at = { x: point.x + index * 24, y: point.y + index * 24 };
        if (asset.kind === 'image') placeImage(asset, at);
        else placeFile(asset, at);
      });
    },
    [allNodes, assetList, commit, flow, imageFieldAt, placeFile, placeImage, select],
  );

  const importAndPlace = useCallback(
    async (files: File[], point: Point) => {
      const sizes = await Promise.all(
        files.map(async (file) => {
          if (!file.type.startsWith('image/') && !file.type.startsWith('video/'))
            return { width: 0, height: 0 };
          try {
            const bitmap = await createImageBitmap(file);
            const size = { width: bitmap.width, height: bitmap.height };
            bitmap.close();
            return size;
          } catch {
            return { width: 0, height: 0 };
          }
        }),
      );
      const outcome = await importFiles(files, 'auto');
      outcome.ids.forEach((id, index) => {
        const size = sizes[index] ?? { width: 0, height: 0 };
        const file = files[index];
        const at = { x: point.x + index * 24, y: point.y + index * 24 };
        if (file?.type.startsWith('image/')) placeImage({ id, name: file.name, ...size }, at);
        else {
          const kind = file?.type.startsWith('video/')
            ? 'video'
            : file?.type.startsWith('audio/')
              ? 'audio'
              : 'other';
          placeFile({ id, kind, width: size.width || null, height: size.height || null }, at);
        }
      });
      if (outcome.ids.length > 0) {
        toast.show({ title: t('board.imported', { count: outcome.ids.length }), variant: 'success' });
      }
    },
    [placeFile, placeImage, t, toast],
  );

  const dropFiles = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      const files = [...event.dataTransfer.files];
      if (files.length === 0) return;
      event.preventDefault();
      const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      await importAndPlace(files, Number.isFinite(point.x + point.y) ? point : viewportCentre());
    },
    [flow, importAndPlace, viewportCentre],
  );

  const pointer = useRef<Point | null>(null);

  const pastePoint = useCallback((): Point | null => pointer.current, []);

  const pasteClip = useCallback(
    (clip: BoardClip, at: Point | null) => {
      const pasted = pasteItems(clip, boardId, at, allNodes);
      if (pasted.nodes.length === 0) return;
      commit({ upsertNodes: pasted.nodes, upsertEdges: pasted.edges });
      select(pasted.ids);
    },
    [allNodes, boardId, commit, select],
  );

  const pasteText = useCallback(
    (text: string, at: Point | null) => {
      const node = place('text', { point: at ?? viewportCentre() }, { text: text.slice(0, 20_000) });
      if (node) select([node.id]);
    },
    [place, select, viewportCentre],
  );

  const copySelection = useCallback((): { text: string; json: string } | null => {
    const ids = getBoardSelection(boardId).nodeIds;
    if (!snapshot || ids.length === 0) return null;
    const clip = copyItems(ids, snapshot.nodes, snapshot.edges);
    const text = rememberClip(clip, t('board.copied', { count: clip.nodes.length }));
    return { text, json: serialiseClip(clip) };
  }, [boardId, snapshot, t]);

  const removeSelection = useCallback(() => {
    const { nodeIds, edgeIds } = getBoardSelection(boardId);
    const removable = nodeIds.filter(
      (id) => allNodes.find((node) => node.id === id)?.data['locked'] !== true,
    );
    if (removable.length === 0 && edgeIds.length === 0) return;
    commit({
      removeNodeIds: [...new Set(removable.flatMap((id) => [id, ...descendants(id, allNodes)]))],
      removeEdgeIds: edgeIds,
    });
    select([]);
  }, [allNodes, boardId, commit, select]);

  const selectAll = useCallback(() => {
    const first = allNodes.find((node) => node.id === getBoardSelection(boardId).nodeIds[0]);
    const scope = first?.parentId ?? null;
    select(allNodes.filter((node) => node.parentId === scope).map((node) => node.id));
  }, [allNodes, boardId, select]);

  const pasteFromSystem = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      let text = '';
      for (const item of items) {
        const image = item.types.find((type) => type.startsWith('image/'));
        if (image) files.push(new File([await item.getType(image)], 'pasted.png', { type: image }));
        else if (item.types.includes('text/plain')) text = await (await item.getType('text/plain')).text();
      }
      const at = pastePoint();
      const remembered = recallClip(text);
      if (remembered) pasteClip(remembered, at);
      else if (files.length > 0) await importAndPlace(files, at ?? viewportCentre());
      else if (text.trim()) pasteText(text, at);
    } catch {
      toast.show({ title: t('board.pasteFailed'), variant: 'danger' });
    }
  }, [importAndPlace, pasteClip, pastePoint, pasteText, t, toast, viewportCentre]);

  const onCopy = useCallback(
    (event: ClipboardEvent<HTMLDivElement>, cut: boolean) => {
      if (isTyping(event.target)) return;
      const copied = copySelection();
      if (!copied) return;
      event.preventDefault();
      event.clipboardData.setData('text/plain', copied.text);
      event.clipboardData.setData(BOARD_CLIPBOARD_TYPE, copied.json);
      if (cut) removeSelection();
    },
    [copySelection, removeSelection],
  );

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (isTyping(event.target)) return;
      const data = event.clipboardData;
      const json = data.getData(BOARD_CLIPBOARD_TYPE);
      const text = data.getData('text/plain');
      const clip = (json ? parseClip(json) : null) ?? recallClip(text);
      const files = [...data.files];
      if (!clip && files.length === 0 && !text.trim()) return;
      event.preventDefault();
      const at = pastePoint();
      if (clip) pasteClip(clip, at);
      else if (files.length > 0) void importAndPlace(files, at ?? viewportCentre());
      else pasteText(text, at);
    },
    [importAndPlace, pasteClip, pastePoint, pasteText, viewportCentre],
  );

  useEditTarget(surface, (command, focused) => {
    if (isTyping(focused) || command === 'undo' || command === 'redo') return false;
    if (command === 'copy' || command === 'cut') {
      const copied = copySelection();
      if (copied) void navigator.clipboard.writeText(copied.text);
      if (copied && command === 'cut') removeSelection();
    } else if (command === 'paste') void pasteFromSystem();
    else if (command === 'delete') removeSelection();
    else selectAll();
    return true;
  });

  useAssetDropZone(surface, (detail: AssetDragDetail) => {
    if (detail.phase === 'move') {
      const point = flow.screenToFlowPosition({ x: detail.x, y: detail.y });
      const target = containerAt(point, allNodes);
      showDropTarget(target ? { id: target.id, kind: 'add' } : null);
      return;
    }
    showDropTarget(null);
    if (detail.phase === 'drop') dropAssets(detail.ids, detail.x, detail.y);
  });

  const selectedNodes = allNodes.filter((node) => selectedIds.includes(node.id));

  const quickSource =
    preferences.quickButtons &&
    tool === 'select' &&
    !dragActive &&
    !transforming &&
    quick === null &&
    editingId === null &&
    selectedNodes.length === 1 &&
    selectedIds.length === 1
      ? (selectedNodes[0] ?? null)
      : null;
  const quickRect =
    quickSource && quickSource.data['locked'] !== true ? absoluteRect(quickSource, allNodes) : null;

  const quickAdd = useCallback(
    (source: BoardNode, side: Side) => {
      const created = quickCreate(source, side, allNodes);
      commit({ upsertNodes: [created.node], upsertEdges: [created.edge] });
      select([created.node.id]);
      if (created.node.type === 'text') setEditingId(created.node.id);
    },
    [allNodes, commit, select],
  );

  const openQuick = useCallback(
    (clientX: number, clientY: number, link: QuickOpen['link']) => {
      const bounds = surface.current?.getBoundingClientRect();
      const width = bounds?.width ?? 0;
      const height = bounds?.height ?? 0;
      const x = clientX - (bounds?.left ?? 0);
      const y = clientY - (bounds?.top ?? 0);
      setQuick({
        left: width > 0 ? Math.max(8, Math.min(x, width - QUICK_MENU_SIZE.width - 8)) : x,
        top: height > 0 ? Math.max(8, Math.min(y, height - QUICK_MENU_SIZE.height - 8)) : y,
        at: flow.screenToFlowPosition({ x: clientX, y: clientY }),
        link,
      });
    },
    [flow],
  );

  const pickQuick = useCallback(
    (choice: QuickChoice) => {
      const open = quick;
      setQuick(null);
      if (!open) return;
      const link = open.link;
      const source = link ? allNodes.find((node) => node.id === link.sourceId) : undefined;
      if (choice.kind === 'same') {
        if (source && link?.side) quickAdd(source, link.side);
        return;
      }
      let preset: ItemPreset;
      let data: Record<string, unknown> = {};
      let size: { width: number; height: number };
      if (choice.kind === 'preset') {
        preset = choice.preset;
        size = presetSize(preset);
      } else if (choice.kind === 'card') {
        const template = findCardTemplate(choice.templateId);
        preset = 'card';
        data = { templateId: choice.templateId, values: {} };
        size = template ? { width: template.width, height: template.height } : presetSize('card');
      } else {
        const asset = assetList.find((candidate) => candidate.id === choice.assetId);
        preset = 'image';
        data = asset ? { assetId: asset.id, alt: asset.name } : {};
        size = asset ? fitSize(asset.width ?? 0, asset.height ?? 0) : presetSize('image');
      }
      let point = open.at;
      if (source && link?.side) {
        const rect = absoluteRect(source, allNodes);
        const side = link.side;
        const local = {
          x:
            side === 'right'
              ? rect.width / 2 + QUICK_GAP + size.width / 2
              : side === 'left'
                ? -rect.width / 2 - QUICK_GAP - size.width / 2
                : 0,
          y:
            side === 'bottom'
              ? rect.height / 2 + QUICK_GAP + size.height / 2
              : side === 'top'
                ? -rect.height / 2 - QUICK_GAP - size.height / 2
                : 0,
        };
        const turned = rotateVector(local, rotationOf(source.data));
        point = { x: rect.x + rect.width / 2 + turned.x, y: rect.y + rect.height / 2 + turned.y };
      }
      const node = place(preset, { point }, data, size);
      if (!node) return;
      if (source && link) {
        const sides = link.side
          ? { source: link.side, target: OPPOSITE[link.side] }
          : sidesBetween(absoluteRect(source, allNodes), absoluteRect(node, [...allNodes, node]));
        commit({
          upsertEdges: [
            createEdge(boardId, source.id, node.id, {
              sourceHandle: link.handle ?? sides.source,
              targetHandle: sides.target,
            }),
          ],
        });
      }
      if (node.type === 'text' || node.type === 'container') setEditingId(node.id);
    },
    [allNodes, assetList, boardId, commit, place, quick, quickAdd],
  );

  const closeQuick = useCallback(() => {
    setQuick(null);
  }, []);

  const trackDrag = useCallback(
    (node: Node, dragging: Node[]) => {
      const internal = flow.getInternalNode(node.id);
      if (!internal) return;
      const { x, y } = internal.internals.positionAbsolute;
      const width = internal.measured.width ?? node.width ?? 0;
      const height = internal.measured.height ?? node.height ?? 0;
      const target = containerAt(
        { x: x + width / 2, y: y + height / 2 },
        allNodes,
        dragging.map((item) => item.id),
      );
      showDropTarget(
        target ? { id: target.id, kind: target.id === (node.parentId ?? null) ? 'stay' : 'move' } : null,
      );
    },
    [allNodes, flow, showDropTarget],
  );

  const duplicate = useCallback(
    (ids: string[]) => {
      if (!snapshot || ids.length === 0) return;
      const copies = duplicateItems(ids, snapshot.nodes, snapshot.edges);
      commit({ upsertNodes: copies.nodes, upsertEdges: copies.edges });
      select(copies.ids);
    },
    [commit, select, snapshot],
  );

  const menuActions = useMemo<BoardMenuActions>(
    () => ({
      duplicate: (node) => {
        duplicate([node.id]);
      },
      front: (node) => {
        commit({ upsertNodes: bringToFront([node.id], allNodes) });
      },
      back: (node) => {
        commit({ upsertNodes: sendToBack([node.id], allNodes) });
      },
      toggleLock: (node) => {
        commit({ upsertNodes: [withData(node, { locked: node.data['locked'] !== true })] });
      },
      release: (node) => {
        commit({ upsertNodes: [reparent(node, null, allNodes)] });
      },
      detach: (node) => {
        commit({ upsertNodes: undock([node.id], allNodes) });
      },
      editTemplate: (node) => {
        onEditTemplate(typeof node.data['templateId'] === 'string' ? node.data['templateId'] : null);
      },
      removeNode: (node) => {
        commit({ removeNodeIds: [node.id, ...descendants(node.id, allNodes)] });
        select([]);
      },
      reverseEdge: (edge: BoardEdge) => {
        commit({
          upsertEdges: [
            {
              ...edge,
              sourceId: edge.targetId,
              targetId: edge.sourceId,
              data: {
                ...edge.data,
                sourceHandle: edge.data['targetHandle'] ?? null,
                targetHandle: edge.data['sourceHandle'] ?? null,
              },
            },
          ],
        });
      },
      removeEdge: (edge: BoardEdge) => {
        commit({ removeEdgeIds: [edge.id] });
        select([]);
      },
    }),
    [allNodes, commit, duplicate, onEditTemplate, select],
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isTyping(event.target)) return;
    const mod = event.ctrlKey || event.metaKey;
    const ids = selectedNodes.map((node) => node.id);
    if (mod && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      selectAll();
      return;
    }
    const alignment = ALIGN_KEYS[event.code];
    if (
      event.altKey &&
      !mod &&
      ids.length >= 2 &&
      (alignment || event.code === 'KeyH' || event.code === 'KeyV')
    ) {
      event.preventDefault();
      const updates =
        event.shiftKey && (event.code === 'KeyH' || event.code === 'KeyV')
          ? distributeItems(ids, allNodes, event.code === 'KeyH' ? 'horizontal' : 'vertical')
          : alignment
            ? alignItems(ids, allNodes, alignment)
            : [];
      if (updates.length > 0) commit({ upsertNodes: updates });
      return;
    }
    if (event.key === ' ' && !mod && !event.altKey && !event.repeat) {
      event.preventDefault();
      const bounds = surface.current?.getBoundingClientRect();
      const at = screenPointer.current ?? {
        x: (bounds?.left ?? 0) + (bounds?.width ?? 0) / 2,
        y: (bounds?.top ?? 0) + (bounds?.height ?? 0) / 2,
      };
      openQuick(at.x, at.y, null);
      return;
    }
    if (event.key === 'Escape') {
      if (tool !== 'select') setTool('select');
      else {
        const group = ids.length === 1 && ids[0] ? dockCluster(ids[0], allNodes) : ids;
        select(group.length > 1 && ids.length === 1 ? group : parentSelection(ids, allNodes));
      }
      return;
    }
    if (event.key === 'Enter' && !event.defaultPrevented && ids.length > 0) {
      const children = childSelection(ids, allNodes);
      if (children !== ids) {
        event.preventDefault();
        select(children);
      }
      return;
    }
    if (mod && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicate(ids);
      return;
    }
    if (mod && event.key.toLowerCase() === 'l' && selectedNodes.length > 0) {
      event.preventDefault();
      const lock = selectedNodes.some((node) => node.data['locked'] !== true);
      commit({ upsertNodes: selectedNodes.map((node) => withData(node, { locked: lock })) });
      return;
    }
    if (!mod && event.key === ']' && ids.length > 0) {
      commit({ upsertNodes: bringToFront(ids, allNodes) });
      return;
    }
    if (!mod && event.key === '[' && ids.length > 0) {
      commit({ upsertNodes: sendToBack(ids, allNodes) });
      return;
    }
    if (!mod && !event.altKey && event.key.length === 1) {
      const next = toolForKey(event.key);
      if (next === 'rectangle' || next === 'ellipse' || next === 'diamond')
        setState({ tool: next, shape: next });
      else if (next) setTool(next);
    }
  }

  if (!snapshot) {
    return (
      <div className={styles['loading']}>
        <Spinner label={t('board.loading')} />
      </div>
    );
  }

  const creating = presetForTool(tool) !== null;

  return (
    <BoardActionsContext value={actions}>
      <div
        ref={surface}
        className={styles['surface']}
        {...assetDropZoneProps}
        {...boardScopeProps}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onPointerDownCapture={() => {
          pressSelection.current = getBoardSelection(boardId).nodeIds;
          if (!surface.current?.contains(document.activeElement))
            surface.current?.focus({ preventScroll: true });
        }}
        onPointerMove={(event) => {
          pointer.current = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
          screenPointer.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerLeave={() => {
          pointer.current = null;
          screenPointer.current = null;
        }}
        onCopy={(event) => {
          onCopy(event, false);
        }}
        onCut={(event) => {
          onCopy(event, true);
        }}
        onPaste={onPaste}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
          const target = containerAt(point, allNodes);
          showDropTarget(target ? { id: target.id, kind: 'add' } : null);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null))
            showDropTarget(null);
        }}
        onDrop={(event) => {
          showDropTarget(null);
          void dropFiles(event);
        }}
        data-tool={tool}
      >
        <BoardContextMenu
          nodes={snapshot.nodes}
          edges={snapshot.edges}
          actions={menuActions}
          className={styles['menuArea']}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectEnd={(event, state) => {
              if (state.isValid || state.toNode || !state.fromNode) return;
              const point = 'changedTouches' in event ? event.changedTouches[0] : event;
              if (!point) return;
              openQuick(point.clientX, point.clientY, {
                sourceId: state.fromNode.id,
                side: null,
                handle: isHandle(state.fromHandle.id) ? state.fromHandle.id : null,
              });
            }}
            onNodeDragStart={(event, node, dragging) => {
              startDrag(event, node, dragging);
            }}
            onNodeDrag={(_event, node, dragging) => {
              trackDrag(node, dragging);
            }}
            onNodeDragStop={() => {
              showDropTarget(null);
              endDrag();
            }}
            onNodeClick={(event, node) => {
              if (event.shiftKey || tool !== 'select') return;
              const group = dockCluster(node.id, allNodes);
              const current = pressSelection.current;
              const whole =
                group.length > 1 &&
                current.length === group.length &&
                group.every((id) => current.includes(id));
              if (whole) select([node.id]);
            }}
            onNodeDoubleClick={(event, node) => {
              if (node.type !== 'container' || tool !== 'select') return;
              const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
              const target = drillTarget(point, node.id, allNodes);
              if (target) select([target.id]);
            }}
            onEdgeDoubleClick={(_event, edge) => {
              setEditingId(edge.id);
            }}
            onDoubleClick={(event) => {
              if (tool !== 'select') return;
              if ((event.target as HTMLElement).classList.contains('react-flow__pane')) {
                const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
                const node = place('sticky', { point });
                if (node) setEditingId(node.id);
              }
            }}
            multiSelectionKeyCode="Shift"
            selectionKeyCode={null}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={28}
            defaultViewport={readViewport(state)}
            onMoveEnd={(_event, viewport) => {
              setState({ viewport });
            }}
            snapToGrid={snapping}
            snapGrid={[step, step]}
            zoomOnScroll={wheel === 'zoom'}
            panOnScroll={wheel === 'pan'}
            panActivationKeyCode={null}
            selectionOnDrag={tool === 'select'}
            panOnDrag={tool === 'hand' ? true : [1]}
            nodesDraggable={tool === 'select'}
            elementsSelectable={tool === 'select' || tool === 'hand'}
            zoomOnDoubleClick={false}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
            className={styles['flow']}
            style={{ background }}
          >
            <SelectionGuard />
            <ViewportPortal>
              {guides.map((guide, index) => (
                <div
                  key={index}
                  className={styles['guide']}
                  style={
                    guide.axis === 'x'
                      ? {
                          left: guide.position - 0.5 / zoom,
                          top: guide.from,
                          width: 1 / zoom,
                          height: guide.to - guide.from,
                        }
                      : {
                          top: guide.position - 0.5 / zoom,
                          left: guide.from,
                          height: 1 / zoom,
                          width: guide.to - guide.from,
                        }
                  }
                />
              ))}
              {quickSource && quickRect
                ? QUICK_SIDES.map((side) => {
                    const offset = 22 / zoom;
                    const local = {
                      x:
                        side === 'left'
                          ? -quickRect.width / 2 - offset
                          : side === 'right'
                            ? quickRect.width / 2 + offset
                            : 0,
                      y:
                        side === 'top'
                          ? -quickRect.height / 2 - offset
                          : side === 'bottom'
                            ? quickRect.height / 2 + offset
                            : 0,
                    };
                    const turned = rotateVector(local, rotationOf(quickSource.data));
                    const left = quickRect.x + quickRect.width / 2 + turned.x;
                    const top = quickRect.y + quickRect.height / 2 + turned.y;
                    return (
                      <button
                        key={side}
                        type="button"
                        className={cx('nodrag nopan', styles['quick'])}
                        style={{ left, top, scale: String(1 / zoom) }}
                        aria-label={t(`board.quick.${side}`)}
                        title={t(`board.quick.${side}`)}
                        onClick={(event) => {
                          openQuick(event.clientX, event.clientY, {
                            sourceId: quickSource.id,
                            side,
                            handle: null,
                          });
                        }}
                      >
                        <Plus aria-hidden="true" />
                      </button>
                    );
                  })
                : null}
              {dockHint ? (
                <div
                  className={styles['dockHint']}
                  style={{
                    left: Math.min(dockHint.x1, dockHint.x2) - 2 / zoom,
                    top: Math.min(dockHint.y1, dockHint.y2) - 2 / zoom,
                    width: Math.abs(dockHint.x2 - dockHint.x1) + 4 / zoom,
                    height: Math.abs(dockHint.y2 - dockHint.y1) + 4 / zoom,
                  }}
                />
              ) : null}
              {tool === 'select' && shownGroup && !dragActive ? (
                <DockGroupFrame
                  group={shownGroup}
                  label={t('board.dockGroup')}
                  snapping={snapping}
                  keepRatio={shiftHeld}
                  gridStep={actions.gridStep}
                  onStart={() => {
                    setTransforming(true);
                  }}
                  onPreview={(next) => {
                    setPreview(next && wholeGroup ? transformGroup(wholeGroup, next, allNodes) : null);
                    if (!next) setTransforming(false);
                  }}
                  onCommit={(next) => {
                    if (!wholeGroup) return;
                    setPreview(null);
                    commit({ upsertNodes: transformGroup(wholeGroup, next, allNodes) });
                  }}
                />
              ) : null}
              {tool === 'select' && !transforming && !dragActive
                ? seamList.map((seam) => (
                    <button
                      key={seam.a + '-' + seam.b}
                      type="button"
                      className={cx('nodrag nopan', styles['seam'])}
                      style={{ left: seam.point.x, top: seam.point.y, scale: String(1 / zoom) }}
                      aria-label={t('board.detachSeam')}
                      title={t('board.detachSeam')}
                      onClick={() => {
                        commit({ upsertNodes: splitSeam(seam, allNodes) });
                      }}
                    >
                      <Unlink aria-hidden="true" />
                    </button>
                  ))
                : null}
            </ViewportPortal>
            {grid ? <Grid board={{ ...snapshot.board, gridColor }} /> : null}
            {minimap ? <MiniMap pannable zoomable className={styles['minimap']} /> : null}
            {creating || tool === 'arrow' ? (
              <CreationOverlay
                mode={tool === 'arrow' ? 'connect' : 'place'}
                wheel={wheel}
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                nodes={snapshot.nodes}
                onPlace={onPlace}
                onConnect={(sourceId, targetId) => {
                  connect(sourceId, targetId);
                }}
                onConnectEmpty={(sourceId, clientX, clientY) => {
                  openQuick(clientX, clientY, { sourceId, side: null, handle: null });
                }}
              />
            ) : null}
          </ReactFlow>
        </BoardContextMenu>
        {quick ? (
          <QuickCreateMenu
            x={quick.left}
            y={quick.top}
            templates={templates}
            images={images}
            offerSame={Boolean(quick.link?.side)}
            onPick={pickQuick}
            onClose={closeQuick}
          />
        ) : null}
        <BoardToolbar
          tool={tool}
          shape={shape}
          templates={templates}
          templateId={templateId}
          images={images}
          onTool={setTool}
          onShape={(next) => {
            setState({ shape: next });
          }}
          onTemplate={(id) => {
            setState({ cardTemplate: id });
          }}
          onPlaceImage={(asset) => {
            placeImage(asset);
          }}
          onImportImages={() => void importImages()}
          onNewTemplate={() => {
            onEditTemplate(null);
          }}
          onEditTemplates={() => {
            onEditTemplate(templateId ?? templates[0]?.id ?? null);
          }}
        />
      </div>
    </BoardActionsContext>
  );
}

function BoardArea({ areaId, state, setState }: EditorProps) {
  const { t } = useTranslation('editors');
  const preferences = useSettings().editors.board;
  const boards = useBoards();
  const flow = useReactFlow();
  const propertiesOpen = usePanelOpen('properties');
  const assetsOpen = usePanelOpen('assets');
  const layersOpen = usePanelOpen('layers');
  const editorRef = useRef<HTMLDivElement>(null);
  const [templateEditor, setTemplateEditor] = useState<{ templateId: string | null; key: number } | null>(
    null,
  );
  const requested = typeof state['boardId'] === 'string' ? state['boardId'] : null;
  const board = boards?.find((item) => item.id === requested) ?? boards?.[0] ?? null;

  const openTemplateEditor = useCallback((templateId: string | null) => {
    setTemplateEditor({ templateId, key: Date.now() });
  }, []);

  function togglePanel(panel: BoardPanel) {
    const width = editorRef.current?.getBoundingClientRect().width ?? 0;
    const { width: panelWidth, placement } = PANEL_PLACEMENT[panel];
    panelActions.toggle(areaId, panel, width, panelWidth, placement);
  }

  if (boards === null) {
    return (
      <div className={styles['loading']}>
        <Spinner label={t('board.loading')} />
      </div>
    );
  }

  return (
    <div ref={editorRef} className={styles['editor']}>
      <AreaHeaderContent>
        <BoardHeader
          boards={boards}
          board={board}
          grid={flag(state, 'grid', preferences.grid)}
          minimap={flag(state, 'minimap', preferences.minimap)}
          snap={flag(state, 'snap', preferences.snap)}
          panels={{ assets: assetsOpen, layers: layersOpen, properties: propertiesOpen }}
          onSelect={(boardId) => {
            setState({ boardId });
          }}
          onToggle={(key, value) => {
            setState({ [key]: value });
          }}
          onTogglePanel={togglePanel}
          onZoom={(action) => {
            if (action === 'in') void flow.zoomIn();
            if (action === 'out') void flow.zoomOut();
            if (action === 'fit') void flow.fitView({ padding: 0.2 });
            if (action === 'reset') void flow.zoomTo(1);
          }}
        />
      </AreaHeaderContent>
      {board ? (
        <Canvas
          key={board.id}
          boardId={board.id}
          state={state}
          setState={setState}
          onEditTemplate={openTemplateEditor}
        />
      ) : (
        <EmptyState icon={<PenTool />} title={t('board.empty')} description={t('board.emptyHint')} />
      )}
      {templateEditor ? (
        <TemplateEditorDialog
          key={templateEditor.key}
          open
          templateId={templateEditor.templateId}
          onOpenChange={(open) => {
            if (!open) setTemplateEditor(null);
          }}
          onSaved={(template) => {
            setState({ cardTemplate: template.id });
          }}
        />
      ) : null}
    </div>
  );
}

export function BoardEditor(props: EditorProps) {
  return (
    <ReactFlowProvider>
      <BoardArea {...props} />
    </ReactFlowProvider>
  );
}
