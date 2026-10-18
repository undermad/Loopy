import { useRef } from 'react';
import type { NodeProps } from '@xyflow/react';
import { itemData } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { AssetLinkCard } from '../../../AssetLinkCard/AssetLinkCard';
import { useBoardActions } from '../BoardContext';
import { ItemFrame } from './ItemFrame';
import type { ItemFlowNode } from './TextItem';
import styles from './items.module.scss';

const CLICK_DISTANCE = 4;

export function LinkItem({ data, selected, dragging, width, height }: NodeProps<ItemFlowNode>) {
  const { t } = useTranslation('editors');
  const actions = useBoardActions();
  const press = useRef<{ x: number; y: number } | null>(null);
  const { node } = data;
  const content = itemData({ type: 'link', data: node.data });
  const target = content.target;

  return (
    <ItemFrame
      node={node}
      label={content.name || t('properties.link')}
      selected={selected}
      dragging={dragging}
      width={width ?? node.width}
      height={height ?? node.height}
    >
      {() =>
        target ? (
          <div
            className={styles['link']}
            onPointerDownCapture={(event) => {
              press.current = { x: event.clientX, y: event.clientY };
            }}
            onClickCapture={(event) => {
              const start = press.current;
              press.current = null;
              const moved =
                start !== null &&
                Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_DISTANCE;
              if (moved) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
          >
            <AssetLinkCard
              link={target}
              inert={!selected}
              onOpen={(link) => {
                if (link.kind !== 'asset') actions.openLink({ kind: link.kind, id: link.id });
              }}
            />
          </div>
        ) : (
          <span className={styles['linkEmpty']}>{t('assetLink.missing')}</span>
        )
      }
    </ItemFrame>
  );
}
