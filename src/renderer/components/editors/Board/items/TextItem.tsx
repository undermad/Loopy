import { useEffect, useRef, useState } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import type { BoardNode } from '@shared/board';
import { itemData, withData } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import { useBoardActions } from '../BoardContext';
import { ItemFrame } from './ItemFrame';
import styles from './items.module.scss';

export type ItemFlowNode = Node<{ node: BoardNode }>;

export function TextItem({ data, selected, dragging, width, height }: NodeProps<ItemFlowNode>) {
  const { t } = useTranslation('editors');
  const actions = useBoardActions();
  const { node } = data;
  const content = itemData({ type: 'text', data: node.data });
  const [local, setLocal] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const locked = content.locked;
  const editing = local || actions.editingId === node.id;

  useEffect(() => {
    if (editing) {
      area.current?.focus();
      area.current?.select();
    }
  }, [editing]);

  function start() {
    if (locked) return;
    setDraft(null);
    setLocal(true);
  }

  function commit() {
    setLocal(false);
    if (actions.editingId === node.id) actions.setEditingId(null);
    if (draft !== null && draft !== content.text) actions.updateNode(withData(node, { text: draft }));
    setDraft(null);
  }

  return (
    <ItemFrame
      node={node}
      label={content.name || content.text || t('properties.text')}
      selected={selected}
      dragging={dragging}
      width={width ?? node.width}
      height={height ?? node.height}
      onDoubleClick={start}
      onKeyDown={(event) => {
        if (!editing && event.key === 'Enter' && event.target === event.currentTarget) {
          event.preventDefault();
          start();
        }
      }}
    >
      {({ style }) =>
        editing ? (
          <textarea
            ref={area}
            className={cx('nodrag nowheel nopan', styles['textEdit'])}
            style={{ textAlign: style.align }}
            value={draft ?? content.text}
            placeholder={t('board.textPlaceholder')}
            aria-label={t('properties.text')}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                commit();
              }
              event.stopPropagation();
            }}
          />
        ) : (
          <div
            className={cx(styles['text'], !content.text && styles['placeholder'])}
            title={t('board.editHint')}
          >
            {content.text || t('board.textPlaceholder')}
          </div>
        )
      }
    </ItemFrame>
  );
}
