import type { NodeProps } from '@xyflow/react';
import { LayoutTemplate } from 'lucide-react';
import { itemData, withData } from '@renderer/lib/board';
import { updateSavedCard, useBoardCard, valueText } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import { useBoardActions } from '../BoardContext';
import { CardFace } from '../../Cards/CardFace';
import { ItemFrame } from './ItemFrame';
import type { ItemFlowNode } from './TextItem';
import styles from './items.module.scss';

export function CardItem({ data, selected, dragging, width, height }: NodeProps<ItemFlowNode>) {
  const { t } = useTranslation('editors');
  const actions = useBoardActions();
  const { node } = data;
  const content = itemData({ type: 'card', data: node.data });
  const { card, layout, values } = useBoardCard(content);
  const title = Object.values(values).find((value) => typeof value === 'string' && value.trim());
  const templateName = layout && 'name' in layout && typeof layout.name === 'string' ? layout.name : null;

  return (
    <ItemFrame
      node={node}
      label={
        [content.name, card?.name, typeof title === 'string' ? title : '', templateName].find(Boolean) ??
        t('properties.card')
      }
      selected={selected}
      dragging={dragging}
      width={width ?? node.width}
      height={height ?? node.height}
      layers={[layout?.style]}
    >
      {() => (
        <>
          {layout ? (
            <CardFace
              className={cx('nowheel', styles['cardBody'], !selected && styles['cardInert'])}
              layout={layout}
              values={values}
              editable={!content.locked}
              onChange={(fieldId, value) => {
                const next = { ...values, [fieldId]: value };
                if (card) void updateSavedCard(card.id, { values: next });
                actions.updateNode(withData(node, { values: next }));
              }}
            />
          ) : (
            <div className={styles['cardMissing']}>
              <LayoutTemplate aria-hidden="true" />
              <span>{content.templateId ? t('board.templateMissing') : t('board.chooseTemplate')}</span>
              {Object.entries(content.values).map(([key, value]) => (
                <span key={key} className={styles['cardValue']}>
                  {valueText(value)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </ItemFrame>
  );
}
