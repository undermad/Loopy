import { useState } from 'react';
import type { Board, BoardUnit } from '@shared/board';
import { BOARD_UNITS, updateBoard } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { Field, Input, Select } from '@renderer/ui';
import { ProjectColourPicker } from '../../ProjectColourPicker/ProjectColourPicker';
import { NumberField } from './NumberField';
import styles from './PropertiesEditor.module.scss';

export function BoardProperties({ board }: { board: Board }) {
  const { t } = useTranslation('editors');
  const [name, setName] = useState<string | null>(null);

  function commitName() {
    const next = (name ?? board.name).trim();
    setName(null);
    if (next && next !== board.name) void updateBoard(board.id, { name: next });
  }

  return (
    <section className={styles['section']} aria-label={t('properties.board')}>
      <h3 className={styles['heading']}>{t('properties.board')}</h3>
      <Field label={t('properties.name')}>
        <Input
          size="sm"
          value={name ?? board.name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </Field>
      <div className={styles['swatchRow']}>
        <ProjectColourPicker
          size="sm"
          value={{ hex: board.backgroundColor, ref: board.backgroundRef }}
          label={t('properties.background')}
          onChange={(value) =>
            void updateBoard(board.id, { backgroundColor: value.hex, backgroundRef: value.ref })
          }
        />
        <span>{t('properties.background')}</span>
      </div>
      <div className={styles['swatchRow']}>
        <ProjectColourPicker
          size="sm"
          value={{ hex: board.gridColor, ref: board.gridRef }}
          label={t('properties.gridColor')}
          onChange={(value) => void updateBoard(board.id, { gridColor: value.hex, gridRef: value.ref })}
        />
        <span>{t('properties.gridColor')}</span>
      </div>
      <Field label={t('properties.unit')}>
        <Select
          size="sm"
          value={board.unit}
          aria-label={t('properties.unit')}
          options={BOARD_UNITS.map((unit) => ({ value: unit, label: t(`properties.units.${unit}`) }))}
          onValueChange={(unit) => void updateBoard(board.id, { unit: unit as BoardUnit })}
        />
      </Field>
      <NumberField
        label={t('properties.unitScale')}
        value={board.unitScale}
        min={0.001}
        step={1}
        onCommit={(unitScale) => void updateBoard(board.id, { unitScale })}
      />
    </section>
  );
}
