import { ArrowDown, ArrowUp, BringToFront, SendToBack } from 'lucide-react';
import type { BoardNode } from '@shared/board';
import {
  bringForward,
  bringToFront,
  commitChanges,
  layerPosition,
  sendBackward,
  sendToBack,
} from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { IconButton } from '@renderer/ui';
import styles from './PropertiesEditor.module.scss';

export interface ArrangeSectionProps {
  boardId: string;
  ids: string[];
  nodes: BoardNode[];
}

export function ArrangeSection({ boardId, ids, nodes }: ArrangeSectionProps) {
  const { t } = useTranslation('editors');
  const apply = (updates: BoardNode[]) => {
    if (updates.length > 0) void commitChanges(boardId, { upsertNodes: updates });
  };
  const only = ids.length === 1 ? ids[0] : undefined;
  const position = only ? layerPosition(only, nodes) : null;

  return (
    <>
      <h3 className={styles['heading']}>{t('properties.arrange')}</h3>
      <div className={styles['arrange']}>
        <IconButton
          size="sm"
          label={t('properties.bringToFront')}
          onClick={() => {
            apply(bringToFront(ids, nodes));
          }}
        >
          <BringToFront aria-hidden="true" />
        </IconButton>
        <IconButton
          size="sm"
          label={t('properties.bringForward')}
          onClick={() => {
            apply(bringForward(ids, nodes));
          }}
        >
          <ArrowUp aria-hidden="true" />
        </IconButton>
        <IconButton
          size="sm"
          label={t('properties.sendBackward')}
          onClick={() => {
            apply(sendBackward(ids, nodes));
          }}
        >
          <ArrowDown aria-hidden="true" />
        </IconButton>
        <IconButton
          size="sm"
          label={t('properties.sendToBack')}
          onClick={() => {
            apply(sendToBack(ids, nodes));
          }}
        >
          <SendToBack aria-hidden="true" />
        </IconButton>
        {position && position.count > 0 ? (
          <span className={styles['layerInfo']}>
            {t('properties.layer', { index: position.count - position.index, count: position.count })}
          </span>
        ) : null}
      </div>
    </>
  );
}
