import { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { X } from 'lucide-react';
import { addStep, itemData, removeStep, stepProgress, toggleStep, withData } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import { useBoardActions } from '../BoardContext';
import { ItemFrame } from './ItemFrame';
import type { ItemFlowNode } from './TextItem';
import styles from './items.module.scss';

const INTERACTIVE = 'nodrag nowheel nopan';

export function ChecklistItem({ data, selected, dragging, width, height }: NodeProps<ItemFlowNode>) {
  const { t } = useTranslation('editors');
  const actions = useBoardActions();
  const { node } = data;
  const content = itemData({ type: 'checklist', data: node.data });
  const editable = !content.locked;
  const [draft, setDraft] = useState('');
  const { done, total } = stepProgress(content.items);
  const save = (items: typeof content.items) => {
    actions.updateNode(withData(node, { items }));
  };
  return (
    <ItemFrame
      node={node}
      label={content.name || content.title || t('properties.checklist')}
      selected={selected}
      dragging={dragging}
      width={width ?? node.width}
      height={height ?? node.height}
    >
      {() => (
        <div className={cx(styles['checklist'], 'nowheel', !selected && styles['cardInert'])}>
          {content.title || (content.showProgress && total > 0) ? (
            <div className={styles['checklistHeader']}>
              {content.title ? <strong>{content.title}</strong> : <span />}
              {content.showProgress && total > 0 ? (
                <span className={styles['checklistProgress']}>{`${String(done)}/${String(total)}`}</span>
              ) : null}
            </div>
          ) : null}
          <ul className={styles['checklistSteps']}>
            {content.items.map((step) => (
              <li key={step.id} className={cx(styles['checklistStep'], step.done && styles['checklistDone'])}>
                <label>
                  <input
                    className={INTERACTIVE}
                    type="checkbox"
                    checked={step.done}
                    disabled={!editable}
                    onChange={() => {
                      save(toggleStep(content.items, step.id));
                    }}
                  />
                  <span>{step.text}</span>
                </label>
                {editable && selected ? (
                  <button
                    type="button"
                    className={cx(INTERACTIVE, styles['checklistRemove'])}
                    aria-label={t('cards.removeStep', { text: step.text })}
                    onClick={() => {
                      save(removeStep(content.items, step.id));
                    }}
                  >
                    <X aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {editable && selected ? (
            <input
              className={cx(INTERACTIVE, styles['checklistAdd'])}
              value={draft}
              placeholder={t('cards.addStep')}
              aria-label={t('cards.addStep')}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter' && draft.trim()) {
                  event.preventDefault();
                  save(addStep(content.items, draft));
                  setDraft('');
                }
              }}
            />
          ) : null}
        </div>
      )}
    </ItemFrame>
  );
}
