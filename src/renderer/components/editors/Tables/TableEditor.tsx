import { useMemo, useState } from 'react';
import { Download, Plus, Redo2, Rows3, Sheet, Undo2 } from 'lucide-react';
import {
  TABLE_COLUMN_KINDS,
  TABLE_EXPORT_FORMATS,
  columnIdFrom,
  computeTable,
  tableColumnSchema,
  validateTable,
  type DataTable,
  type IssueCode,
  type RowOp,
  type TableColumn,
  type TableColumnKind,
} from '@shared/tables';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import {
  editRows,
  exportTable,
  filterRows,
  nextRowKey,
  redoTable,
  sortRows,
  undoTable,
  updateTable,
  useTableHistory,
  useTableLookup,
  useTableMissing,
  useTableSnapshot,
  useTables,
  type SortState,
} from '@renderer/lib/tables';
import { Button, DropdownMenu, EmptyState, IconButton, Input, Spinner, useToast } from '@renderer/ui';
import { ColumnSettings } from './ColumnSettings';
import { duplicateKeyOf } from './messages';
import { TableGrid } from './TableGrid';
import styles from './TableEditor.module.scss';

function readSort(value: unknown): SortState | null {
  if (typeof value !== 'object' || value === null) return null;
  const { columnId, direction } = value as Record<string, unknown>;
  if (direction !== 'asc' && direction !== 'desc') return null;
  return { columnId: typeof columnId === 'string' ? columnId : null, direction };
}

function NameInput({ table }: { table: DataTable }) {
  const { t } = useTranslation('tables');
  const [draft, setDraft] = useState(table.name);
  const [base, setBase] = useState(table.name);
  if (base !== table.name) {
    setBase(table.name);
    setDraft(table.name);
  }
  const commit = () => {
    const name = draft.trim();
    if (name === '' || name === table.name) setDraft(table.name);
    else void updateTable(table.id, { name: name.slice(0, 80) });
  };
  return (
    <Input
      size="sm"
      className={styles['name']}
      aria-label={t('editor.name')}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') setDraft(table.name);
      }}
    />
  );
}

export function TableEditor({ state, setState }: EditorProps) {
  const { t } = useTranslation('tables');
  const toast = useToast();
  const tableId = typeof state['tableId'] === 'string' ? state['tableId'] : null;
  const snapshot = useTableSnapshot(tableId);
  const missing = useTableMissing(tableId);
  const tables = useTables() ?? [];
  const history = useTableHistory(tableId);
  const search = typeof state['search'] === 'string' ? state['search'] : '';
  const sort = readSort(state['sort']);
  const column = typeof state['column'] === 'string' ? state['column'] : null;
  const referenced = useMemo(
    () =>
      (snapshot?.table.columns ?? []).flatMap((item) =>
        item.kind === 'reference' && item.tableId !== null ? [item.tableId] : [],
      ),
    [snapshot?.table.columns],
  );
  const lookup = useTableLookup(referenced);
  const computed = useMemo(
    () => (snapshot ? computeTable(snapshot.table, snapshot.rows, lookup) : new Map()),
    [snapshot, lookup],
  );
  const issueList = useMemo(
    () => (snapshot ? validateTable(snapshot.table, snapshot.rows, lookup) : []),
    [snapshot, lookup],
  );
  const issues = useMemo(() => {
    const byRow = new Map<string, Map<string, IssueCode>>();
    for (const issue of issueList) {
      const row = byRow.get(issue.rowId) ?? new Map<string, IssueCode>();
      row.set(issue.columnId, issue.code);
      byRow.set(issue.rowId, row);
    }
    return byRow;
  }, [issueList]);
  const rows = useMemo(() => {
    if (!snapshot) return [];
    const filtered = filterRows(snapshot.rows, search, snapshot.table, lookup, computed);
    return sortRows(filtered, sort, snapshot.table, lookup, computed);
  }, [snapshot, search, sort, lookup, computed]);

  if (tableId === null)
    return (
      <EmptyState
        className={styles['empty']}
        icon={<Sheet aria-hidden="true" />}
        title={t('editor.noTable')}
        description={t('editor.noTableHint')}
      />
    );
  if (missing)
    return (
      <EmptyState
        className={styles['empty']}
        icon={<Sheet aria-hidden="true" />}
        title={t('editor.missing')}
      />
    );
  if (!snapshot) return <Spinner />;
  const { table } = snapshot;

  function fail(error: unknown) {
    const key = duplicateKeyOf(error);
    toast.show({ title: key === null ? t('errors.generic') : t('errors.key', { key }), variant: 'danger' });
  }

  async function edit(ops: RowOp[]): Promise<boolean> {
    if (ops.length === 0) return true;
    try {
      await editRows(table.id, ops);
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  function saveColumns(columns: TableColumn[]) {
    void updateTable(table.id, { columns }, { record: true }).catch(fail);
  }

  function addColumn(kind: TableColumnKind) {
    const label = t(`kinds.${kind}`);
    const id = columnIdFrom(
      label,
      table.columns.map((item) => item.id),
      [table.keyName],
    );
    saveColumns([...table.columns, tableColumnSchema.parse({ id, label, kind })]);
    setState({ column: id });
  }

  function addRow() {
    void edit([{ op: 'insert', key: nextRowKey(snapshot?.rows ?? []) }]);
  }

  function toggleSort(columnId: string | null) {
    if (sort?.columnId !== columnId) setState({ sort: { columnId, direction: 'asc' } });
    else if (sort.direction === 'asc') setState({ sort: { columnId, direction: 'desc' } });
    else setState({ sort: null });
  }

  return (
    <div className={styles['editor']}>
      <div className={styles['toolbar']} role="toolbar" aria-label={table.name}>
        <NameInput table={table} />
        <Input
          type="search"
          size="sm"
          className={styles['search']}
          aria-label={t('editor.searchRows')}
          placeholder={t('editor.searchRows')}
          value={search}
          onChange={(event) => {
            setState({ search: event.target.value });
          }}
        />
        <Button size="sm" variant="secondary" icon={<Rows3 aria-hidden="true" />} onClick={addRow}>
          {t('editor.addRow')}
        </Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button size="sm" variant="secondary" icon={<Plus aria-hidden="true" />}>
              {t('editor.addColumn')}
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start">
            {TABLE_COLUMN_KINDS.map((kind) => (
              <DropdownMenu.Item
                key={kind}
                onSelect={() => {
                  addColumn(kind);
                }}
              >
                {t(`kinds.${kind}`)}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button size="sm" variant="secondary" icon={<Download aria-hidden="true" />}>
              {t('editor.export')}
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start">
            {TABLE_EXPORT_FORMATS.map((format) => (
              <DropdownMenu.Item
                key={format}
                onSelect={() => {
                  void exportTable(table.id, format)
                    .then((result) => {
                      if (result.status === 'exported')
                        toast.show({ title: t('editor.exported', { name: table.name }), variant: 'success' });
                    })
                    .catch(() => {
                      toast.show({
                        title: t('editor.exportFailed', { name: table.name }),
                        variant: 'danger',
                      });
                    });
                }}
              >
                {t(`formats.${format}`, { key: table.keyName })}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <IconButton
          label={t('editor.undo')}
          size="sm"
          disabled={!history.canUndo}
          onClick={() => void undoTable(table.id).catch(fail)}
        >
          <Undo2 aria-hidden="true" />
        </IconButton>
        <IconButton
          label={t('editor.redo')}
          size="sm"
          disabled={!history.canRedo}
          onClick={() => void redoTable(table.id).catch(fail)}
        >
          <Redo2 aria-hidden="true" />
        </IconButton>
        <span className={styles['status']}>
          {t('editor.rowCount', { count: snapshot.rows.length })}
          {issueList.length > 0 ? (
            <span className={styles['problems']}>{t('editor.problems', { count: issueList.length })}</span>
          ) : null}
        </span>
      </div>
      <div className={styles['main']}>
        <div className={styles['gridArea']}>
          <TableGrid
            table={table}
            rows={rows}
            computed={computed}
            issues={issues}
            lookup={lookup}
            sort={sort}
            activeColumn={column}
            onSort={toggleSort}
            onOpenColumn={(id) => {
              setState({ column: column === id ? null : id });
            }}
            onResize={(id, width) => {
              saveColumns(table.columns.map((item) => (item.id === id ? { ...item, width } : item)));
            }}
            onEdit={edit}
            onUndo={() => void undoTable(table.id).catch(fail)}
            onRedo={() => void redoTable(table.id).catch(fail)}
            onError={(message) => {
              toast.show({ title: message, variant: 'danger' });
            }}
          />
        </div>
        {column ? (
          <ColumnSettings
            table={table}
            columnId={column}
            tables={tables.filter((item) => item.id !== table.id)}
            onColumns={saveColumns}
            onKeyName={(keyName) => {
              void updateTable(table.id, { keyName }, { record: true }).catch(fail);
            }}
            onClose={() => {
              setState({ column: null });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
