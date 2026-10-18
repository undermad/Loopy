import type { Board, BoardNode } from '@shared/board';
import { useTranslation } from '@renderer/lib/i18n';
import { AlignSection } from './AlignSection';
import { ArrangeSection } from './ArrangeSection';
import styles from './PropertiesEditor.module.scss';

export interface SelectionPropertiesProps {
  board: Board;
  nodes: BoardNode[];
  selected: BoardNode[];
}

export function SelectionProperties({ board, nodes, selected }: SelectionPropertiesProps) {
  const { t } = useTranslation('editors');
  const ids = selected.map((node) => node.id);
  return (
    <section className={styles['section']} aria-label={t('properties.multiple', { count: selected.length })}>
      <h3 className={styles['heading']}>{t('properties.multiple', { count: selected.length })}</h3>
      <AlignSection boardId={board.id} ids={ids} nodes={nodes} />
      <ArrangeSection boardId={board.id} ids={ids} nodes={nodes} />
    </section>
  );
}
