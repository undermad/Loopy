import { SlidersHorizontal } from 'lucide-react';
import { useActiveBoardId, useBoardSelection, useBoardSnapshot } from '@renderer/lib/board';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { EmptyState, ScrollArea } from '@renderer/ui';
import { BoardProperties } from './BoardProperties';
import { EdgeProperties } from './EdgeProperties';
import { NodeProperties } from './NodeProperties';
import styles from './PropertiesEditor.module.scss';

export function PropertiesEditor(_props: EditorProps) {
  const { t } = useTranslation('editors');
  const activeBoardId = useActiveBoardId();
  const selection = useBoardSelection();
  const snapshot = useBoardSnapshot(selection?.boardId ?? activeBoardId);

  if (!snapshot) {
    return (
      <EmptyState
        icon={<SlidersHorizontal />}
        title={t('properties.nothing')}
        description={t('properties.selectHint')}
      />
    );
  }

  const selected = selection ? snapshot.nodes.filter((node) => selection.nodeIds.includes(node.id)) : [];
  if (selected.length > 1) {
    return (
      <EmptyState icon={<SlidersHorizontal />} title={t('properties.multiple', { count: selected.length })} />
    );
  }
  const node = selected[0];
  const edges = selection ? snapshot.edges.filter((edge) => selection.edgeIds.includes(edge.id)) : [];
  const edge = !node && edges.length === 1 ? edges[0] : undefined;

  return (
    <ScrollArea className={styles['scroll']}>
      <div className={styles['panel']}>
        {node ? (
          <NodeProperties key={node.id} board={snapshot.board} node={node} />
        ) : edge ? (
          <EdgeProperties key={edge.id} edge={edge} />
        ) : (
          <BoardProperties key={snapshot.board.id} board={snapshot.board} />
        )}
      </div>
    </ScrollArea>
  );
}
