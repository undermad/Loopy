import type { NodeProps } from '@xyflow/react';
import { FileX } from 'lucide-react';
import { assetUrl, formatBytes } from '@shared/assets';
import { useAsset } from '@renderer/lib/assets';
import { itemData } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import { KIND_ICONS } from '../../Assets/kinds';
import { ItemFrame } from './ItemFrame';
import type { ItemFlowNode } from './TextItem';
import styles from './items.module.scss';

export function FileItem({ data, selected, dragging, width, height }: NodeProps<ItemFlowNode>) {
  const { t } = useTranslation('editors');
  const { t: ta } = useTranslation('assets');
  const { node } = data;
  const content = itemData({ type: 'file', data: node.data });
  const asset = useAsset(content.assetId);
  const Icon = asset ? KIND_ICONS[asset.kind] : FileX;

  return (
    <ItemFrame
      node={node}
      label={content.name || (asset?.name ?? t('properties.file'))}
      selected={selected}
      dragging={dragging}
      width={width ?? node.width}
      height={height ?? node.height}
    >
      {() => (
        <div className={styles['file']}>
          {asset?.kind === 'video' ? (
            <video
              className={cx('nodrag nowheel', styles['video'], !selected && styles['cardInert'])}
              src={assetUrl(asset.id)}
              controls
              preload="metadata"
              aria-label={asset.name}
            />
          ) : (
            <div className={styles['fileRow']}>
              <Icon aria-hidden="true" className={styles['fileIcon']} />
              <div className={styles['fileText']}>
                <span className={styles['fileName']}>{asset?.name ?? t('board.fileMissing')}</span>
                {asset ? (
                  <span className={styles['fileMeta']}>
                    {ta(`kinds.${asset.kind}`)} · {formatBytes(asset.size)}
                  </span>
                ) : null}
              </div>
            </div>
          )}
          {asset?.kind === 'audio' ? (
            <audio
              className={cx('nodrag', styles['audio'], !selected && styles['cardInert'])}
              src={assetUrl(asset.id)}
              controls
              preload="metadata"
              aria-label={asset.name}
            />
          ) : null}
        </div>
      )}
    </ItemFrame>
  );
}
