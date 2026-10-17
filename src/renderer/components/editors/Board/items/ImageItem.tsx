import type { NodeProps } from '@xyflow/react';
import { ImageOff } from 'lucide-react';
import { assetUrl } from '@shared/assets';
import { itemData } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { ItemFrame } from './ItemFrame';
import type { ItemFlowNode } from './TextItem';
import styles from './items.module.scss';

export function ImageItem({ data, selected, dragging, width, height }: NodeProps<ItemFlowNode>) {
  const { t } = useTranslation('editors');
  const { node } = data;
  const content = itemData({ type: 'image', data: node.data });

  return (
    <ItemFrame
      node={node}
      label={content.name || content.alt || t('properties.image')}
      selected={selected}
      dragging={dragging}
      width={width ?? node.width}
      height={height ?? node.height}
    >
      {() =>
        content.assetId ? (
          <img
            className={styles['image']}
            src={assetUrl(content.assetId)}
            alt={content.alt}
            draggable={false}
            style={{ objectFit: content.fit }}
          />
        ) : (
          <div className={styles['imageMissing']}>
            <ImageOff aria-hidden="true" />
            <span>{t('board.imageMissing')}</span>
          </div>
        )
      }
    </ItemFrame>
  );
}
