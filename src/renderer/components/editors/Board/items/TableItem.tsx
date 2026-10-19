import { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { itemData, setCell, withData } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import { useBoardActions } from '../BoardContext';
import { ItemFrame } from './ItemFrame';
import type { ItemFlowNode } from './TextItem';
import styles from './items.module.scss';

const INTERACTIVE = 'nodrag nowheel nopan';

function Cell({
  value,
  label,
  editable,
  onCommit,
}: {
  value: string;
  label: string;
  editable: boolean;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (!editable) return <>{value}</>;
  return (
    <input
      className={cx(INTERACTIVE, styles['tableInput'])}
      value={draft ?? value}
      aria-label={label}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={() => {
        if (draft !== null && draft !== value) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

export function TableItem({ data, selected, dragging, width, height }: NodeProps<ItemFlowNode>) {
  const { t } = useTranslation('editors');
  const actions = useBoardActions();
  const { node } = data;
  const content = itemData({ type: 'table', data: node.data });
  const editable = selected && !content.locked;
  const [head, ...body] = content.header ? content.rows : [undefined, ...content.rows];
  const offset = content.header ? 1 : 0;
  const cell = (row: number, column: number, value: string) => (
    <Cell
      value={value}
      editable={editable}
      label={t('board.cellLabel', { row: row + 1, column: column + 1 })}
      onCommit={(next) => {
        actions.updateNode(withData(node, { rows: setCell(content.rows, row, column, next) }));
      }}
    />
  );
  return (
    <ItemFrame
      node={node}
      label={content.name || t('properties.table')}
      selected={selected}
      dragging={dragging}
      width={width ?? node.width}
      height={height ?? node.height}
    >
      {() => (
        <div className={cx(styles['tableWrap'], 'nowheel', !selected && styles['cardInert'])}>
          <table className={styles['table']}>
            {head ? (
              <thead>
                <tr>
                  {head.map((value, column) => (
                    <th key={column} scope="col">
                      {cell(0, column, value)}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {body.map((cells, index) => (
                <tr key={index}>
                  {(cells ?? []).map((value, column) => (
                    <td key={column}>{cell(index + offset, column, value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ItemFrame>
  );
}
