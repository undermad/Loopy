import { useEffect, useRef, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { itemData, withData } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { useBoardActions } from '../BoardContext';
import { ItemFrame } from './ItemFrame';
import type { ItemFlowNode } from './TextItem';
import styles from './items.module.scss';

export function ContainerItem({ data, selected, dragging, width, height }: NodeProps<ItemFlowNode>) {
  const { t } = useTranslation('editors');
  const actions = useBoardActions();
  const { node } = data;
  const content = itemData({ type: 'container', data: node.data });
  const [local, setLocal] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const title = content.title || t('board.containerTitle');
  const editing = local || actions.editingId === node.id;

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  function commit() {
    setLocal(false);
    if (actions.editingId === node.id) actions.setEditingId(null);
    if (draft !== null && draft !== content.title) {
      actions.updateNode(withData(node, { title: draft.slice(0, 80) }));
    }
    setDraft(null);
  }

  return (
    <ItemFrame
      node={node}
      label={content.name || title}
      selected={selected}
      dragging={dragging}
      width={width ?? node.width}
      height={height ?? node.height}
      className={styles['container']}
    >
      {() =>
        content.showTitle ? (
          editing ? (
            <input
              ref={input}
              className={`nodrag ${styles['titleEdit'] ?? ''}`}
              value={draft ?? content.title}
              aria-label={t('properties.title')}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'Escape') {
                  event.preventDefault();
                  commit();
                }
                event.stopPropagation();
              }}
            />
          ) : (
            <div
              className={styles['title']}
              onDoubleClick={(event) => {
                if (content.locked) return;
                event.stopPropagation();
                setDraft(null);
                setLocal(true);
              }}
            >
              {title}
            </div>
          )
        ) : null
      }
    </ItemFrame>
  );
}
