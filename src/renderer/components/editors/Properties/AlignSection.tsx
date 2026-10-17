import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { BoardNode } from '@shared/board';
import { alignItems, commitChanges, distributeItems, type Alignment } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { IconButton } from '@renderer/ui';
import styles from './PropertiesEditor.module.scss';

const ALIGNMENTS: { value: Alignment; icon: ReactNode }[] = [
  { value: 'left', icon: <AlignStartVertical aria-hidden="true" /> },
  { value: 'centre', icon: <AlignCenterVertical aria-hidden="true" /> },
  { value: 'right', icon: <AlignEndVertical aria-hidden="true" /> },
  { value: 'top', icon: <AlignStartHorizontal aria-hidden="true" /> },
  { value: 'middle', icon: <AlignCenterHorizontal aria-hidden="true" /> },
  { value: 'bottom', icon: <AlignEndHorizontal aria-hidden="true" /> },
];

export interface AlignSectionProps {
  boardId: string;
  ids: string[];
  nodes: BoardNode[];
}

export function AlignSection({ boardId, ids, nodes }: AlignSectionProps) {
  const { t } = useTranslation('editors');
  const apply = (updates: BoardNode[]) => {
    if (updates.length > 0) void commitChanges(boardId, { upsertNodes: updates });
  };
  return (
    <>
      <h3 className={styles['heading']}>{t('properties.alignItems')}</h3>
      <div className={styles['arrange']}>
        {ALIGNMENTS.map(({ value, icon }) => (
          <IconButton
            key={value}
            size="sm"
            label={t(`properties.alignTo.${value}`)}
            onClick={() => {
              apply(alignItems(ids, nodes, value));
            }}
          >
            {icon}
          </IconButton>
        ))}
        <IconButton
          size="sm"
          label={t('properties.distributeHorizontal')}
          disabled={ids.length < 3}
          onClick={() => {
            apply(distributeItems(ids, nodes, 'horizontal'));
          }}
        >
          <AlignHorizontalDistributeCenter aria-hidden="true" />
        </IconButton>
        <IconButton
          size="sm"
          label={t('properties.distributeVertical')}
          disabled={ids.length < 3}
          onClick={() => {
            apply(distributeItems(ids, nodes, 'vertical'));
          }}
        >
          <AlignVerticalDistributeCenter aria-hidden="true" />
        </IconButton>
      </div>
    </>
  );
}
