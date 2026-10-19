import type { Board, BoardNode } from '@shared/board';
import { ITEM_KINDS } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { PropertySection } from '@renderer/ui';
import { AlignSection } from './AlignSection';
import { ArrangeSection } from './ArrangeSection';
import { AppearanceSection, TypographySection, styleTarget } from './StyleSections';
import styles from './PropertiesEditor.module.scss';

export interface SelectionPropertiesProps {
  board: Board;
  nodes: BoardNode[];
  selected: BoardNode[];
}

export function SelectionProperties({ board, nodes, selected }: SelectionPropertiesProps) {
  const { t } = useTranslation('editors');
  const ids = selected.map((node) => node.id);
  const styled = selected.filter((node) => ITEM_KINDS[node.type].appearance);
  const texts = selected.filter((node) => ITEM_KINDS[node.type].text);
  return (
    <section className={styles['section']} aria-label={t('properties.multiple', { count: selected.length })}>
      <h3 className={styles['heading']}>{t('properties.multiple', { count: selected.length })}</h3>
      <PropertySection title={t('properties.sections.layout')}>
        <AlignSection boardId={board.id} ids={ids} nodes={nodes} />
        <ArrangeSection boardId={board.id} ids={ids} nodes={nodes} />
      </PropertySection>
      {styled.length > 0 ? <AppearanceSection target={styleTarget(styled)} /> : null}
      {texts.length > 0 ? <TypographySection target={styleTarget(texts)} /> : null}
    </section>
  );
}
