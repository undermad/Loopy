import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Brush,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  File,
  Frame,
  GripVertical,
  Image,
  Layers,
  LayoutTemplate,
  Link2,
  ListTodo,
  Lock,
  LockOpen,
  Shapes,
  Table2,
  Type,
} from 'lucide-react';
import type { BoardNode, BoardNodeType } from '@shared/board';
import {
  boardScopeProps,
  commitChanges,
  itemData,
  layerRows,
  moveLayer,
  setBoardSelection,
  setLiveLayers,
  useActiveBoardId,
  useBoardSelection,
  useBoardSnapshot,
  withData,
  type LayerRow,
  useBoards,
} from '@renderer/lib/board';
import { useAssetsSnapshot } from '@renderer/lib/assets';
import { findCardTemplate } from '@renderer/lib/cards';
import { usePalettes } from '@renderer/lib/palettes';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { EmptyState, IconButton, ScrollArea, cx } from '@renderer/ui';
import styles from './LayersEditor.module.scss';

const ICONS: Record<BoardNodeType, typeof Type> = {
  text: Type,
  image: Image,
  container: Frame,
  card: LayoutTemplate,
  file: File,
  link: Link2,
  drawing: Brush,
  icon: Shapes,
  checklist: ListTodo,
  table: Table2,
  embed: Eye,
};

function firstLine(text: string): string {
  return text.split('\n', 1)[0]?.trim() ?? '';
}

function useItemLabel(): (node: BoardNode) => string {
  const { t } = useTranslation('editors');
  const assets = useAssetsSnapshot().assets;
  const boards = useBoards() ?? [];
  const palettes = usePalettes() ?? [];
  return (node) => {
    const data = itemData(node);
    if (data.name) return data.name;
    if (node.type === 'link') {
      const { target } = itemData({ type: 'link', data: node.data });
      const source = target?.kind === 'board' ? boards : palettes;
      return source.find((item) => item.id === target?.id)?.name ?? t('properties.link');
    }
    if (node.type === 'file') {
      const { assetId } = itemData({ type: 'file', data: node.data });
      return assets.find((asset) => asset.id === assetId)?.name ?? t('properties.file');
    }
    if (node.type === 'text')
      return firstLine(itemData({ type: 'text', data: node.data }).text) || t('properties.text');
    if (node.type === 'container')
      return itemData({ type: 'container', data: node.data }).title || t('board.containerTitle');
    if (node.type === 'image')
      return itemData({ type: 'image', data: node.data }).alt || t('properties.image');
    if (node.type === 'drawing') return t('properties.drawing');
    const card = itemData({ type: 'card', data: node.data });
    return findCardTemplate(card.templateId)?.name ?? t('properties.card');
  };
}

interface RowProps {
  row: LayerRow;
  label: string;
  selected: boolean;
  collapsed: boolean;
  onSelect: (additive: boolean) => void;
  onToggleCollapsed: () => void;
  onRename: (name: string) => void;
}

function LayerItem({ row, label, selected, collapsed, onSelect, onToggleCollapsed, onRename }: RowProps) {
  const { t } = useTranslation('editors');
  const { node, depth, hasChildren } = row;
  const data = itemData(node);
  const [draft, setDraft] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });
  const Icon = ICONS[node.type];

  return (
    <li
      ref={setNodeRef}
      className={cx(
        styles['row'],
        selected && styles['selected'],
        isDragging && styles['dragging'],
        data.hidden && styles['hidden'],
      )}
      style={{ transform: CSS.Transform.toString(transform), transition, paddingLeft: depth * 14 }}
      aria-level={depth + 1}
    >
      <button
        type="button"
        className={styles['grip']}
        aria-label={t('layers.drag', { name: label })}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" />
      </button>
      {hasChildren ? (
        <button
          type="button"
          className={styles['caret']}
          aria-label={collapsed ? t('layers.expand', { name: label }) : t('layers.collapse', { name: label })}
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </button>
      ) : (
        <span className={styles['caret']} />
      )}
      <Icon aria-hidden="true" className={styles['icon']} />
      {draft === null ? (
        <button
          type="button"
          className={styles['name']}
          aria-pressed={selected}
          onClick={(event) => {
            onSelect(event.shiftKey || event.ctrlKey || event.metaKey);
          }}
          onDoubleClick={() => {
            setDraft(label);
          }}
        >
          {label}
        </button>
      ) : (
        <input
          className={styles['rename']}
          value={draft}
          maxLength={80}
          aria-label={t('layers.rename')}
          ref={(element) => {
            element?.focus();
          }}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={() => {
            if (draft.trim() && draft !== label) onRename(draft.trim());
            setDraft(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') setDraft(null);
          }}
        />
      )}
      <IconButton
        size="sm"
        label={data.hidden ? t('layers.show', { name: label }) : t('layers.hide', { name: label })}
        className={styles['toggle']}
        active={data.hidden}
        onClick={() => {
          void commitChanges(node.boardId, { upsertNodes: [withData(node, { hidden: !data.hidden })] });
        }}
      >
        {data.hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </IconButton>
      <IconButton
        size="sm"
        label={data.locked ? t('layers.unlock', { name: label }) : t('layers.lock', { name: label })}
        className={styles['toggle']}
        active={data.locked}
        onClick={() => {
          void commitChanges(node.boardId, { upsertNodes: [withData(node, { locked: !data.locked })] });
        }}
      >
        {data.locked ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
      </IconButton>
    </li>
  );
}

export function LayersEditor(_props: EditorProps) {
  const { t } = useTranslation('editors');
  const boardId = useActiveBoardId();
  const snapshot = useBoardSnapshot(boardId);
  const selection = useBoardSelection();
  const label = useItemLabel();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!snapshot) {
    return (
      <div className={styles['scope']} {...boardScopeProps}>
        <EmptyState icon={<Layers />} title={t('layers.empty')} description={t('layers.emptyHint')} />
      </div>
    );
  }

  const board = snapshot.board.id;
  const nodes = snapshot.nodes;
  const rows = layerRows(nodes, collapsed);
  const selectedIds = selection?.boardId === board ? selection.nodeIds : [];

  function planned(activeId: string, overId: string | undefined) {
    const moving = nodes.find((node) => node.id === activeId);
    const target = nodes.find((node) => node.id === overId);
    if (!moving || target?.parentId !== moving.parentId) return [];
    const siblings = nodes.filter((node) => node.parentId === moving.parentId).sort((a, b) => a.z - b.z);
    return moveLayer(
      moving.id,
      siblings.findIndex((node) => node.id === target.id),
      nodes,
    );
  }

  function preview({ active, over }: DragOverEvent) {
    setLiveLayers(planned(String(active.id), over ? String(over.id) : undefined));
  }

  function reorder({ active, over }: DragEndEvent) {
    setLiveLayers(null);
    const updates = planned(String(active.id), over ? String(over.id) : undefined);
    if (updates.length > 0) void commitChanges(board, { upsertNodes: updates });
  }

  if (rows.length === 0) {
    return (
      <div className={styles['scope']} {...boardScopeProps}>
        <EmptyState icon={<Layers />} title={t('layers.none')} />
      </div>
    );
  }

  return (
    <ScrollArea className={styles['scroll']} {...boardScopeProps}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragOver={preview}
        onDragEnd={reorder}
        onDragCancel={() => {
          setLiveLayers(null);
        }}
      >
        <SortableContext items={rows.map((row) => row.node.id)} strategy={verticalListSortingStrategy}>
          <ul className={styles['list']} aria-label={t('layers.label')}>
            {rows.map((row) => (
              <LayerItem
                key={row.node.id}
                row={row}
                label={label(row.node)}
                selected={selectedIds.includes(row.node.id)}
                collapsed={collapsed.has(row.node.id)}
                onSelect={(additive) => {
                  const id = row.node.id;
                  const next = additive
                    ? selectedIds.includes(id)
                      ? selectedIds.filter((other) => other !== id)
                      : [...selectedIds, id]
                    : [id];
                  setBoardSelection(board, next);
                }}
                onToggleCollapsed={() => {
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(row.node.id)) next.delete(row.node.id);
                    else next.add(row.node.id);
                    return next;
                  });
                }}
                onRename={(name) => {
                  void commitChanges(board, { upsertNodes: [withData(row.node, { name })] });
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </ScrollArea>
  );
}
