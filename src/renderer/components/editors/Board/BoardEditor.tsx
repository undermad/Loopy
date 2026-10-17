import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import {
  commitChanges,
  gridStep,
  loadBoard,
  setActiveBoard,
  setBoardSelection,
  setLiveGeometry,
  snapToStep,
  useBoardSnapshot,
  useBoards,
} from '@renderer/lib/board';
import type { LiveGeometry } from '@renderer/lib/board';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { panelActions, usePanelOpen } from '@renderer/lib/workspaces';
import { EmptyState, Spinner } from '@renderer/ui';
import { AreaHeaderContent } from '../../Shell/AreaHeaderContent';
import { BoardHeader } from './BoardHeader';
import { Grid } from './Grid';
import { NoteNode } from './NoteNode';
import { SelectionGuard } from './SelectionGuard';
import { newEdge, newNote, readViewport, settleNodeChanges, toFlowEdges, toFlowNodes } from './boardFlow';
import styles from './BoardEditor.module.scss';

const nodeTypes = { note: NoteNode };
export const PROPERTIES_WIDTH = 320;

interface Draft {
  base: unknown;
  nodes: Node[];
}

function Canvas({ boardId, state, setState }: { boardId: string } & Pick<EditorProps, 'state' | 'setState'>) {
  const { t } = useTranslation('editors');
  const snapshot = useBoardSnapshot(boardId);
  const flow = useReactFlow();
  const zoom = useFlowStore((store) => store.transform[2]);
  const grid = state['grid'] !== false;
  const minimap = state['minimap'] === true;
  const snap = state['snap'] === true;
  const pending = useRef(new Map<string, Node>());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!snapshot) void loadBoard(boardId);
  }, [boardId, snapshot]);

  useEffect(() => {
    setActiveBoard(boardId);
  }, [boardId]);

  const onNoteChange = useCallback(
    (id: string, text: string) => {
      const node = snapshot?.nodes.find((candidate) => candidate.id === id);
      if (node) void commitChanges(boardId, { upsertNodes: [{ ...node, data: { ...node.data, text } }] });
    },
    [boardId, snapshot],
  );

  const nodes = useMemo<Node[]>(() => {
    if (draft?.base === snapshot) return draft.nodes;
    if (!snapshot) return [];
    return toFlowNodes(snapshot, onNoteChange).map((node) =>
      selectedIds.includes(node.id) ? { ...node, selected: true } : node,
    );
  }, [draft, snapshot, onNoteChange, selectedIds]);
  const edges = useMemo(() => (snapshot ? toFlowEdges(snapshot) : []), [snapshot]);
  const step = snapshot ? gridStep(snapshot.board, zoom) : 24;

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!snapshot) return;
      const next = applyNodeChanges(changes, nodes);
      setDraft({ base: snapshot, nodes: next });
      const selected = next.filter((node) => node.selected).map((node) => node.id);
      setSelectedIds(selected);
      setBoardSelection(boardId, selected);
      const { updates, removed } = settleNodeChanges(changes, next, snapshot.nodes, pending.current);
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
      if (updates.length > 0 || removed.length > 0) {
        void commitChanges(boardId, { upsertNodes: updates, removeNodeIds: removed });
      }
    },
    [boardId, nodes, snapshot],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id);
      if (removed.length > 0) void commitChanges(boardId, { removeEdgeIds: removed });
      applyEdgeChanges(changes, edges);
    },
    [boardId, edges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      void commitChanges(boardId, { upsertEdges: [newEdge(boardId, connection.source, connection.target)] });
    },
    [boardId],
  );

  const addNote = useCallback(
    (clientX: number, clientY: number) => {
      const position = flow.screenToFlowPosition({ x: clientX, y: clientY });
      const z = (snapshot?.nodes.reduce((max, node) => Math.max(max, node.z), 0) ?? 0) + 1;
      const x = snap ? snapToStep(position.x - 100, step) : position.x - 100;
      const y = snap ? snapToStep(position.y - 60, step) : position.y - 60;
      void commitChanges(boardId, { upsertNodes: [newNote(boardId, x, y, z)] });
    },
    [boardId, flow, snapshot, snap, step],
  );

  if (!snapshot) {
    return (
      <div className={styles['loading']}>
        <Spinner label={t('board.loading')} />
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).classList.contains('react-flow__pane'))
          addNote(event.clientX, event.clientY);
      }}
      defaultViewport={readViewport(state)}
      onMoveEnd={(_event, viewport) => {
        setState({ viewport });
      }}
      snapToGrid={snap}
      snapGrid={[step, step]}
      panOnScroll
      selectionOnDrag
      panOnDrag={[1, 2]}
      zoomOnDoubleClick={false}
      minZoom={0.01}
      maxZoom={20}
      deleteKeyCode={['Backspace', 'Delete']}
      proOptions={{ hideAttribution: true }}
      className={styles['flow']}
      style={{ background: snapshot.board.backgroundColor }}
    >
      <SelectionGuard />
      {grid ? <Grid board={snapshot.board} /> : null}
      {minimap ? <MiniMap pannable zoomable className={styles['minimap']} /> : null}
    </ReactFlow>
  );
}

function BoardArea({ areaId, state, setState }: EditorProps) {
  const { t } = useTranslation('editors');
  const boards = useBoards();
  const flow = useReactFlow();
  const propertiesOpen = usePanelOpen('properties');
  const editorRef = useRef<HTMLDivElement>(null);
  const requested = typeof state['boardId'] === 'string' ? state['boardId'] : null;
  const board = boards?.find((item) => item.id === requested) ?? boards?.[0] ?? null;

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
        <Canvas key={board.id} boardId={board.id} state={state} setState={setState} />
      ) : (
        <EmptyState icon={<PenTool />} title={t('board.empty')} description={t('board.emptyHint')} />
      )}
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
