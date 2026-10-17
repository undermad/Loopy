import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import {
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  useStore as useFlowStore,
  type Connection,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PenTool } from 'lucide-react';
import { EDGE_HANDLES, type BoardChanges, type BoardEdge, type EdgeHandle } from '@shared/board';
import { assetUrl, type Asset } from '@shared/assets';
import { importFiles, pickFiles, useAssetsSnapshot } from '@renderer/lib/assets';
import {
  absoluteRect,
  bringToFront,
  commitChanges,
  containerAt,
  createEdge,
  createItem,
  descendants,
  duplicateItems,
  fitSize,
  measureImage,
  gridStep,
  loadBoard,
  nextZ,
  presetSize,
  reparent,
  sendToBack,
  setActiveBoard,
  setBoardSelection,
  setLiveGeometry,
  sidesBetween,
  snapToStep,
  useBoardSnapshot,
  useBoards,
  withData,
  type ItemPreset,
  type LiveGeometry,
  type Point,
  type Rect,
} from '@renderer/lib/board';
import { findCardTemplate, useCardTemplates } from '@renderer/lib/cards';
import { readableTextColour } from '@renderer/lib/colour';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { useColourFromRef } from '@renderer/lib/palettes';
import { panelActions, usePanelOpen } from '@renderer/lib/workspaces';
import { EmptyState, Spinner, useToast } from '@renderer/ui';
import { AreaHeaderContent } from '../../Shell/AreaHeaderContent';
import { ArrowEdge } from './ArrowEdge';
import { BoardActionsContext, type BoardActions } from './BoardContext';
import { BoardContextMenu, type BoardMenuActions } from './BoardContextMenu';
import { BoardHeader } from './BoardHeader';
import { BoardToolbar } from './BoardToolbar';
import { CreationOverlay, type Placement } from './CreationOverlay';
import { Grid } from './Grid';
import { SelectionGuard } from './SelectionGuard';
import { TemplateEditorDialog } from './cards/TemplateEditorDialog';
import { CardItem } from './items/CardItem';
import { ContainerItem } from './items/ContainerItem';
import { ImageItem } from './items/ImageItem';
import { TextItem } from './items/TextItem';
import { readViewport, settleNodeChanges, toFlowEdges, toFlowNodes } from './boardFlow';
import { presetForTool, readShape, readTool, toolForKey, type BoardTool } from './tools';
import styles from './BoardEditor.module.scss';

const nodeTypes = { text: TextItem, image: ImageItem, container: ContainerItem, card: CardItem };
const edgeTypes = { arrow: ArrowEdge };
export const PROPERTIES_WIDTH = 320;

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
  const images = useAssetsSnapshot().assets.filter((asset) => asset.kind === 'image');
  const grid = state['grid'] !== false;
  const minimap = state['minimap'] === true;
  const snap = state['snap'] === true;
  const tool = readTool(state);
  const shape = readShape(state);
  const templateId = typeof state['cardTemplate'] === 'string' ? state['cardTemplate'] : null;
  const pending = useRef(new Map<string, Node>());
  const surface = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const commit = useCallback(
    (changes: BoardChanges) => {
      void commitChanges(boardId, changes);
    },
    [boardId],
  );

  const selection = useRef({ nodeIds: [] as string[], edgeIds: [] as string[] });

  const select = useCallback(
    (nodeIds: string[], edgeIds: string[] = []) => {
      setDraft(null);
      setSelectedIds(nodeIds);
      setSelectedEdgeIds(edgeIds);
      selection.current = { nodeIds, edgeIds };
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
    }),
    [background, boardId, commit, editingId, onEditTemplate],
  );

  const nodes = useMemo<Node[]>(() => {
    if (draft?.base === snapshot) return draft.nodes;
    if (!snapshot) return [];
    return toFlowNodes(snapshot).map((node) => ({
      ...node,
      deletable: node.data.node.data['locked'] !== true,
      selected: selectedIds.includes(node.id),
    }));
  }, [draft, snapshot, selectedIds]);

  const edges = useMemo(
    () =>
      snapshot
        ? toFlowEdges(snapshot).map((edge) => ({ ...edge, selected: selectedEdgeIds.includes(edge.id) }))
        : [],
    [snapshot, selectedEdgeIds],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!snapshot) return;
      const next = applyNodeChanges(changes, nodes);
      setDraft({ base: snapshot, nodes: next });
      const selected = next.filter((node) => node.selected).map((node) => node.id);
      setSelectedIds(selected);
      selection.current = { ...selection.current, nodeIds: selected };
      setBoardSelection(boardId, selected, selection.current.edgeIds);
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
    [boardId, commit, nodes, snapshot],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id);
      if (removed.length > 0) commit({ removeEdgeIds: removed });
      const next = applyEdgeChanges(changes, edges);
      const selected = next.filter((edge) => edge.selected).map((edge) => edge.id);
      if (changes.some((change) => change.type === 'select')) {
        setSelectedEdgeIds(selected);
        selection.current = { ...selection.current, edgeIds: selected };
        setBoardSelection(boardId, selection.current.nodeIds, selected);
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

  const dropFiles = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith('image/'));
      if (files.length === 0) return;
      event.preventDefault();
      const point = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const sizes = await Promise.all(
        files.map(async (file) => {
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
        placeImage(
          { id, name: files[index]?.name ?? '', ...size },
          { x: point.x + index * 24, y: point.y + index * 24 },
        );
      });
      if (outcome.ids.length > 0) {
        toast.show({ title: t('board.imported', { count: outcome.ids.length }), variant: 'success' });
      }
    },
    [flow, placeImage, t, toast],
  );

  const selectedNodes = allNodes.filter((node) => selectedIds.includes(node.id));

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
    if (event.key === 'Escape') {
      setTool('select');
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
        onKeyDown={onKeyDown}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault();
        }}
        onDrop={(event) => void dropFiles(event)}
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
            connectionMode={ConnectionMode.Loose}
            connectionRadius={28}
            defaultViewport={readViewport(state)}
            onMoveEnd={(_event, viewport) => {
              setState({ viewport });
            }}
            snapToGrid={snap}
            snapGrid={[step, step]}
            panOnScroll
            selectionOnDrag={tool === 'select'}
            panOnDrag={tool === 'hand' ? true : [1, 2]}
            nodesDraggable={tool === 'select'}
            elementsSelectable={tool === 'select' || tool === 'hand'}
            zoomOnDoubleClick={false}
            minZoom={0.01}
            maxZoom={20}
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
            className={styles['flow']}
            style={{ background }}
          >
            <SelectionGuard />
            {grid ? <Grid board={{ ...snapshot.board, gridColor }} /> : null}
            {minimap ? <MiniMap pannable zoomable className={styles['minimap']} /> : null}
            {creating || tool === 'arrow' ? (
              <CreationOverlay
                mode={tool === 'arrow' ? 'connect' : 'place'}
                nodes={snapshot.nodes}
                onPlace={onPlace}
                onConnect={(sourceId, targetId) => {
                  connect(sourceId, targetId);
                }}
              />
            ) : null}
          </ReactFlow>
        </BoardContextMenu>
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
  const boards = useBoards();
  const flow = useReactFlow();
  const propertiesOpen = usePanelOpen('properties');
  const editorRef = useRef<HTMLDivElement>(null);
  const [templateEditor, setTemplateEditor] = useState<{ templateId: string | null; key: number } | null>(
    null,
  );
  const requested = typeof state['boardId'] === 'string' ? state['boardId'] : null;
  const board = boards?.find((item) => item.id === requested) ?? boards?.[0] ?? null;

  const openTemplateEditor = useCallback((templateId: string | null) => {
    setTemplateEditor({ templateId, key: Date.now() });
  }, []);

  function toggleProperties() {
    const width = editorRef.current?.getBoundingClientRect().width ?? 0;
    panelActions.toggle(areaId, 'properties', width, PROPERTIES_WIDTH);
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
          grid={state['grid'] !== false}
          minimap={state['minimap'] === true}
          snap={state['snap'] === true}
          properties={propertiesOpen}
          onSelect={(boardId) => {
            setState({ boardId });
          }}
          onToggle={(key, value) => {
            setState({ [key]: value });
          }}
          onToggleProperties={toggleProperties}
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
