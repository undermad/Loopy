import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import type { BoardEdge, BoardNode } from '@shared/board';
import { useTranslation } from '@renderer/lib/i18n';
import { ContextMenu } from '@renderer/ui';

export type MenuTarget = { kind: 'node'; node: BoardNode } | { kind: 'edge'; edge: BoardEdge } | null;

export interface BoardMenuActions {
  duplicate: (node: BoardNode) => void;
  front: (node: BoardNode) => void;
  back: (node: BoardNode) => void;
  toggleLock: (node: BoardNode) => void;
  release: (node: BoardNode) => void;
  detach: (node: BoardNode) => void;
  editTemplate: (node: BoardNode) => void;
  removeNode: (node: BoardNode) => void;
  reverseEdge: (edge: BoardEdge) => void;
  removeEdge: (edge: BoardEdge) => void;
}

export interface BoardContextMenuProps {
  nodes: BoardNode[];
  edges: BoardEdge[];
  actions: BoardMenuActions;
  className?: string | undefined;
  children: ReactNode;
}

const DRAG_TOLERANCE = 4;

export function BoardContextMenu({ nodes, edges, actions, className, children }: BoardContextMenuProps) {
  const { t } = useTranslation('editors');
  const [target, setTarget] = useState<MenuTarget>(null);
  const pressed = useRef<{ x: number; y: number } | null>(null);

  function locate(event: MouseEvent<HTMLDivElement>) {
    const start = pressed.current;
    pressed.current = null;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_TOLERANCE) {
      event.preventDefault();
      return;
    }
    const element = event.target as HTMLElement;
    const nodeId = element.closest('.react-flow__node')?.getAttribute('data-id');
    const edgeId = element.closest('.react-flow__edge')?.getAttribute('data-id');
    const node = nodeId ? nodes.find((item) => item.id === nodeId) : undefined;
    const edge = !node && edgeId ? edges.find((item) => item.id === edgeId) : undefined;
    if (node) setTarget({ kind: 'node', node });
    else if (edge) setTarget({ kind: 'edge', edge });
    else {
      setTarget(null);
      event.preventDefault();
    }
  }

  const node = target?.kind === 'node' ? target.node : null;
  const locked = node?.data['locked'] === true;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={className}
          onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
            if (event.button === 2) pressed.current = { x: event.clientX, y: event.clientY };
          }}
          onContextMenu={locate}
        >
          {children}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Content aria-label={t('board.menu.label')}>
        {node ? (
          <>
            <ContextMenu.Item
              onSelect={() => {
                actions.duplicate(node);
              }}
            >
              {t('board.menu.duplicate')}
              <ContextMenu.Shortcut>Ctrl+D</ContextMenu.Shortcut>
            </ContextMenu.Item>
            <ContextMenu.Item
              onSelect={() => {
                actions.front(node);
              }}
            >
              {t('board.menu.front')}
              <ContextMenu.Shortcut>]</ContextMenu.Shortcut>
            </ContextMenu.Item>
            <ContextMenu.Item
              onSelect={() => {
                actions.back(node);
              }}
            >
              {t('board.menu.back')}
              <ContextMenu.Shortcut>[</ContextMenu.Shortcut>
            </ContextMenu.Item>
            <ContextMenu.Item
              onSelect={() => {
                actions.toggleLock(node);
              }}
            >
              {locked ? t('board.menu.unlock') : t('board.menu.lock')}
              <ContextMenu.Shortcut>Ctrl+L</ContextMenu.Shortcut>
            </ContextMenu.Item>
            {node.parentId ? (
              <ContextMenu.Item
                onSelect={() => {
                  actions.release(node);
                }}
              >
                {t('board.menu.release')}
              </ContextMenu.Item>
            ) : null}
            {typeof node.data['dock'] === 'string' ? (
              <ContextMenu.Item
                onSelect={() => {
                  actions.detach(node);
                }}
              >
                {t('board.menu.detach')}
              </ContextMenu.Item>
            ) : null}
            {node.type === 'card' ? (
              <ContextMenu.Item
                onSelect={() => {
                  actions.editTemplate(node);
                }}
              >
                {t('board.menu.editTemplate')}
              </ContextMenu.Item>
            ) : null}
            <ContextMenu.Separator />
            <ContextMenu.Item
              disabled={locked}
              onSelect={() => {
                actions.removeNode(node);
              }}
            >
              {t('board.menu.delete')}
              <ContextMenu.Shortcut>Del</ContextMenu.Shortcut>
            </ContextMenu.Item>
          </>
        ) : null}
        {target?.kind === 'edge' ? (
          <>
            <ContextMenu.Item
              onSelect={() => {
                actions.reverseEdge(target.edge);
              }}
            >
              {t('properties.reverse')}
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item
              onSelect={() => {
                actions.removeEdge(target.edge);
              }}
            >
              {t('board.menu.delete')}
            </ContextMenu.Item>
          </>
        ) : null}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}
