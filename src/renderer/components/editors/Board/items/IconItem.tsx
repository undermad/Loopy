import type { NodeProps } from '@xyflow/react';
import { itemData, ownStyle, resolveItemStyle } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { GameIcon } from '../../../GameIcon/GameIcon';
import { ItemFrame } from './ItemFrame';
import type { ItemFlowNode } from './TextItem';
import styles from './items.module.scss';

export function IconItem({ data, selected, dragging, width, height }: NodeProps<ItemFlowNode>) {
  const { t } = useTranslation('editors');
  const { node } = data;
  const content = itemData({ type: 'icon', data: node.data });
  const w = width ?? node.width;
  const h = height ?? node.height;
  const { padding } = resolveItemStyle('icon', ownStyle(node));
  const size = Math.max(8, Math.min(w, h) - padding * 2);
  const name = t(`icons.${content.icon as 'star'}`, { defaultValue: content.icon });
  return (
    <ItemFrame
      node={node}
      label={content.name || name}
      selected={selected}
      dragging={dragging}
      width={w}
      height={h}
    >
      {({ text }) => (
        <span className={styles['icon']} role="img" aria-label={name}>
          <GameIcon name={content.icon} size={size} color={text} />
        </span>
      )}
    </ItemFrame>
  );
}
