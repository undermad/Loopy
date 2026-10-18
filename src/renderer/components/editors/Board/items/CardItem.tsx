import type { NodeProps } from '@xyflow/react';
import { LayoutTemplate } from 'lucide-react';
import { itemData, withData } from '@renderer/lib/board';
import { useCardTemplate } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { useResolvedColour } from '@renderer/lib/palettes';
import { cx } from '@renderer/ui';
import { useBoardActions } from '../BoardContext';
import { CardView } from '../cards/CardView';
import { ItemFrame } from './ItemFrame';
import type { ItemFlowNode } from './TextItem';
import styles from './items.module.scss';

export function CardItem({ data, selected, dragging, width, height }: NodeProps<ItemFlowNode>) {
  const { t } = useTranslation('editors');
  const actions = useBoardActions();
  const { node } = data;
  const content = itemData({ type: 'card', data: node.data });
  const template = useCardTemplate(content.templateId);
  const accent = useResolvedColour(template?.accent ?? null);
  const title = Object.values(content.values).find((value) => typeof value === 'string' && value.trim());

  return (
    <ItemFrame
      node={node}
      label={
        content.name || (typeof title === 'string' ? title : '') || (template?.name ?? t('properties.card'))
      }
      selected={selected}
      dragging={dragging}
      width={width ?? node.width}
      height={height ?? node.height}
      layers={[template?.style]}
    >
      {() => (
        <>
          {accent ? <span className={styles['accent']} style={{ background: accent }} /> : null}
          {template ? (
            <CardView
              className={cx('nowheel', styles['cardBody'], !selected && styles['cardInert'])}
              layout={template}
              values={content.values}
              editable={!content.locked}
              onChange={(fieldId, value) => {
                actions.updateNode(withData(node, { values: { ...content.values, [fieldId]: value } }));
              }}
            />
          ) : (
            <div className={styles['cardMissing']}>
              <LayoutTemplate aria-hidden="true" />
              <span>{content.templateId ? t('board.templateMissing') : t('board.chooseTemplate')}</span>
              {Object.entries(content.values).map(([key, value]) => (
                <span key={key} className={styles['cardValue']}>
                  {Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </ItemFrame>
  );
}
