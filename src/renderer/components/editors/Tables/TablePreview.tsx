import { useMemo } from 'react';
import { computeTable, formatCell } from '@shared/tables';
import { useTranslation } from '@renderer/lib/i18n';
import { displayValue, useTableLookup, useTableSnapshot } from '@renderer/lib/tables';
import { cx } from '@renderer/ui';
import styles from './TablePreview.module.scss';

export interface TablePreviewProps {
  tableId: string;
  limit?: number;
  className?: string | undefined;
}

export function TablePreview({ tableId, limit = 20, className }: TablePreviewProps) {
  const { t } = useTranslation('tables');
  const snapshot = useTableSnapshot(tableId);
  const referenced = useMemo(
    () =>
      (snapshot?.table.columns ?? []).flatMap((column) =>
        column.kind === 'reference' && column.tableId !== null ? [column.tableId] : [],
      ),
    [snapshot?.table.columns],
  );
  const lookup = useTableLookup(referenced);
  const computed = useMemo(
    () => (snapshot ? computeTable(snapshot.table, snapshot.rows, lookup) : new Map()),
    [snapshot, lookup],
  );
  if (!snapshot) return null;
  const { table, rows } = snapshot;
  const shown = rows.slice(0, limit);
  return (
    <div className={cx(styles['preview'], className)}>
      <table className={styles['table']}>
        <thead>
          <tr>
            <th scope="col">{table.keyName}</th>
            {table.columns.map((column) => (
              <th key={column.id} scope="col">
                {column.label || column.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.key}</th>
              {table.columns.map((column) => (
                <td key={column.id}>
                  {formatCell(column, displayValue(column, row, computed) ?? null, lookup)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length ? (
        <p className={styles['more']}>{t('library.rows', { count: rows.length })}</p>
      ) : null}
    </div>
  );
}
