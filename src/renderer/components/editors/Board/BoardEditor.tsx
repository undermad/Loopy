import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PenTool } from 'lucide-react';
import { commitChanges, loadBoard, useBoardSnapshot, useBoards } from '@renderer/lib/board';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { EmptyState, Spinner } from '@renderer/ui';
import { AreaHeaderContent } from '../../Shell/AreaHeaderContent';
import { BoardHeader } from './BoardHeader';
import { NoteNode } from './NoteNode';
import { newEdge, newNote, nodeFromFlow, readViewport, toFlowEdges, toFlowNodes } from './boardFlow';
import styles from './BoardEditor.module.scss';

const nodeTypes = { note: NoteNode };

function Canvas({ boardId, state, setState }: { boardId: string } & Pick<EditorProps, 'state' | 'setState'>) {
  const { t } = useTranslation('editors');
  const snapshot = useBoardSnapshot(boardId);
  const flow = useReactFlow();
  const grid = state['grid'] !== false;
  const minimap = state['minimap'] === true;
  const pending = useRef(new Map<string, Node>());

  useEffect(() => {
    if (!snapshot) void loadBoard(boardId);
  }, [boardId, snapshot]);

  const onNoteChange = useCallback(
    (id: string, text: string) => {
      const node = snapshot?.nodes.find((candidate) => candidate.id === id);
      if (node) void commitChanges(boardId, { upsertNodes: [{ ...node, data: { ...node.data, text } }] });
    },
    [boardId, snapshot],
  );

  const nodes = useMemo(
    () => (snapshot ? toFlowNodes(snapshot, onNoteChange) : []),
    [snapshot, onNoteChange],
  );
  const edges = useMemo(() => (snapshot ? toFlowEdges(snapshot) : []), [snapshot]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!snapshot) return;
      const next = applyNodeChanges(changes, nodes);
      const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id);
      const settled: string[] = [];
      for (const change of changes) {
        if (change.type === 'position' || change.type === 'dimensions') {
          const flowNode = next.find((candidate) => candidate.id === change.id);
          if (flowNode) pending.current.set(change.id, flowNode);
          const finished = change.type === 'position' ? change.dragging === false : change.resizing === false;
          if (finished) settled.push(change.id);
        }
      }
      const settledNodes = settled.flatMap((id) => {
        const flowNode = pending.current.get(id);
        const original = snapshot.nodes.find((candidate) => candidate.id === id);
        pending.current.delete(id);
        return flowNode && original ? [nodeFromFlow(original, flowNode)] : [];
      });
      if (settledNodes.length > 0 || removed.length > 0) {
        void commitChanges(boardId, { upsertNodes: settledNodes, removeNodeIds: removed });
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
      void commitChanges(boardId, { upsertNodes: [newNote(boardId, position.x - 100, position.y - 60, z)] });
    },
    [boardId, flow, snapshot],
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
      panOnScroll
      selectionOnDrag
      panOnDrag={[1, 2]}
      zoomOnDoubleClick={false}
      minZoom={0.1}
      maxZoom={4}
      deleteKeyCode={['Backspace', 'Delete']}
      proOptions={{ hideAttribution: true }}
      className={styles['flow']}
      style={{ background: snapshot.board.backgroundColor }}
    >
      {grid ? <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} /> : null}
      {minimap ? <MiniMap pannable zoomable className={styles['minimap']} /> : null}
    </ReactFlow>
  );
}

function BoardArea({ state, setState }: EditorProps) {
  const { t } = useTranslation('editors');
  const boards = useBoards();
  const flow = useReactFlow();
  const requested = typeof state['boardId'] === 'string' ? state['boardId'] : null;
  const board = boards?.find((item) => item.id === requested) ?? boards?.[0] ?? null;

  if (boards === null) {
    return (
      <div className={styles['loading']}>
        <Spinner label={t('board.loading')} />
      </div>
    );
  }

  return (
    <div className={styles['editor']}>
      <AreaHeaderContent>
        <BoardHeader
          boards={boards}
          board={board}
          grid={state['grid'] !== false}
          minimap={state['minimap'] === true}
          onSelect={(boardId) => {
            setState({ boardId });
          }}
          onToggle={(key, value) => {
            setState({ [key]: value });
          }}
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
