import {
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { ArrowDown, ArrowUp, Settings2 } from 'lucide-react';
import type { BoardLink } from '@shared/board';
import {
  formatCell,
  parseCell,
  parseDelimited,
  toDelimited,
  type DataTable,
  type IssueCode,
  type RowOp,
  type TableColumn,
  type TableLookup,
  type TableRow,
} from '@shared/tables';
import { assetDropZoneProps, useAssetDropZone } from '@renderer/lib/assets';
import { isEditable, useEditTarget } from '@renderer/lib/commands';
import { useTranslation } from '@renderer/lib/i18n';
import {
  copyMatrix,
  displayValue,
  fillDownOps,
  pasteOps,
  visibleRange,
  type CellRange,
  type Computed,
  type SortState,
} from '@renderer/lib/tables';
import { IconButton, cx } from '@renderer/ui';
import { CellView } from './CellView';
import { cellErrorMessage, useMessages } from './messages';
import styles from './TableGrid.module.scss';

export const ROW_HEIGHT = 30;
const HEADER_HEIGHT = 34;
const KEY_WIDTH = 160;
const OVERSCAN = 6;
const FALLBACK_HEIGHT = 480;

interface Point {
  row: number;
  column: number;
}

interface Selection {
  anchor: Point;
  focus: Point;
}

interface Editing extends Point {
  draft: string;
}

export interface TableGridProps {
  table: DataTable;
  rows: readonly TableRow[];
  computed: Computed;
  issues: ReadonlyMap<string, ReadonlyMap<string, IssueCode>>;
  lookup: TableLookup;
  sort: SortState | null;
  activeColumn: string | null;
  onSort: (columnId: string | null) => void;
  onOpenColumn: (columnId: string) => void;
  onResize: (columnId: string, width: number) => void;
  onEdit: (ops: RowOp[]) => Promise<boolean>;
  onUndo: () => void;
  onRedo: () => void;
  onError: (message: string) => void;
}

export const KEY_COLUMN = '__key';

function rangeOf(selection: Selection): CellRange {
  return {
    top: Math.min(selection.anchor.row, selection.focus.row),
    bottom: Math.max(selection.anchor.row, selection.focus.row),
    left: Math.min(selection.anchor.column, selection.focus.column),
    right: Math.max(selection.anchor.column, selection.focus.column),
  };
}

function inRange(range: CellRange, row: number, column: number): boolean {
  return row >= range.top && row <= range.bottom && column >= range.left && column <= range.right;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function isText(column: TableColumn | undefined): boolean {
  return column?.kind !== 'checkbox' && column?.kind !== 'formula' && column?.kind !== 'link';
}

export function TableGrid({
  table,
  rows,
  computed,
  issues,
  lookup,
  sort,
  activeColumn,
  onSort,
  onOpenColumn,
  onResize,
  onEdit,
  onUndo,
  onRedo,
  onError,
}: TableGridProps) {
  const { t } = useTranslation('tables');
  const messages = useMessages();
  const grid = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(FALLBACK_HEIGHT);
  const [rawSelection, setSelection] = useState<Selection>({
    anchor: { row: 0, column: 0 },
    focus: { row: 0, column: 0 },
  });
  const [editing, setEditingState] = useState<Editing | null>(null);
  const editingRef = useRef<Editing | null>(null);
  const setEditing = (next: Editing | null) => {
    editingRef.current = next;
    setEditingState(next);
  };
  const [dropCell, setDropCell] = useState<Point | null>(null);
  const columnCount = table.columns.length + 1;
  const fit = (point: Point): Point => ({
    row: clamp(point.row, 0, Math.max(0, rows.length - 1)),
    column: clamp(point.column, 0, columnCount - 1),
  });
  const selection: Selection = { anchor: fit(rawSelection.anchor), focus: fit(rawSelection.focus) };
  const range = rangeOf(selection);
  const widths = [KEY_WIDTH, ...table.columns.map((column) => column.width)];
  const template = widths.map((width) => `${String(width)}px`).join(' ');
  const { start, end } = visibleRange({
    scrollTop,
    height,
    rowHeight: ROW_HEIGHT,
    count: rows.length,
    overscan: OVERSCAN,
  });

  useLayoutEffect(() => {
    const element = grid.current;
    if (!element) return;
    const measure = () => {
      setHeight(element.clientHeight > 0 ? element.clientHeight - HEADER_HEIGHT : FALLBACK_HEIGHT);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);

  function reveal(point: Point) {
    const element = grid.current;
    if (!element) return;
    const top = point.row * ROW_HEIGHT;
    const view = element.clientHeight > 0 ? element.clientHeight - HEADER_HEIGHT : FALLBACK_HEIGHT;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (top + ROW_HEIGHT > element.scrollTop + view) element.scrollTop = top + ROW_HEIGHT - view;
  }

  function select(point: Point, extend: boolean) {
    const next = {
      row: clamp(point.row, 0, Math.max(0, rows.length - 1)),
      column: clamp(point.column, 0, columnCount - 1),
    };
    setSelection((current) =>
      extend ? { anchor: current.anchor, focus: next } : { anchor: next, focus: next },
    );
    reveal(next);
  }

  function columnAt(index: number): TableColumn | undefined {
    return table.columns[index - 1];
  }

  function rawText(point: Point): string {
    const row = rows[point.row];
    if (!row) return '';
    if (point.column === 0) return row.key;
    const column = columnAt(point.column);
    return column ? formatCell(column, row.cells[column.id], lookup) : '';
  }

  function startEditing(point: Point, draft?: string) {
    const column = columnAt(point.column);
    if (!rows[point.row] || (point.column > 0 && !isText(column))) return;
    setEditing({ ...point, draft: draft ?? rawText(point) });
  }

  function focusGrid() {
    grid.current?.focus({ preventScroll: true });
  }

  function commitOps(current: Editing): RowOp[] {
    const row = rows[current.row];
    if (!row) return [];
    if (current.column === 0) {
      const key = current.draft.trim();
      if (key === '') onError(t('errors.emptyKey'));
      return key === '' || key === row.key ? [] : [{ op: 'update', id: row.id, key }];
    }
    const column = columnAt(current.column);
    if (!column) return [];
    const parsed = parseCell(column, current.draft, lookup);
    if ('error' in parsed) {
      onError(cellErrorMessage(messages, column, parsed.error, current.draft));
      return [];
    }
    if (JSON.stringify(parsed.value) === JSON.stringify(row.cells[column.id] ?? null)) return [];
    return [{ op: 'update', id: row.id, cells: { [column.id]: parsed.value } }];
  }

  async function commit(current: Editing, move: Point | null) {
    if (editingRef.current !== current) return;
    setEditing(null);
    const ops = commitOps(current);
    if (move) select(move, false);
    focusGrid();
    if (ops.length > 0) await onEdit(ops);
  }

  function clearOps(): RowOp[] {
    const ops: RowOp[] = [];
    for (let index = range.top; index <= range.bottom; index += 1) {
      const row = rows[index];
      if (!row) continue;
      const cells: Record<string, null> = {};
      for (let column = Math.max(1, range.left); column <= range.right; column += 1) {
        const definition = columnAt(column);
        if (definition && definition.kind !== 'formula' && row.cells[definition.id] !== undefined)
          cells[definition.id] = null;
      }
      if (Object.keys(cells).length > 0) ops.push({ op: 'update', id: row.id, cells });
    }
    return ops;
  }

  function copyText(): string {
    return toDelimited(copyMatrix(table, rows, range, lookup, computed), '\t');
  }

  async function pasteText(text: string) {
    const matrix = parseDelimited(text.replace(/\r?\n$/, ''), '\t');
    if (matrix.length === 0) return;
    const result = pasteOps(
      table,
      rows,
      selection.focus.row === range.top ? { row: range.top, column: range.left } : selection.focus,
      matrix,
      lookup,
    );
    if (result.errors.length > 0) onError(t('errors.pasteSkipped', { count: result.errors.length }));
    if (result.ops.length > 0) await onEdit(result.ops);
  }

  function toggle(row: TableRow, column: TableColumn) {
    const value = displayValue(column, row) === true;
    void onEdit([{ op: 'update', id: row.id, cells: { [column.id]: !value } }]);
  }

  useEditTarget(grid, (command, focused) => {
    if (isEditable(focused)) return false;
    if (command === 'undo') onUndo();
    else if (command === 'redo') onRedo();
    else if (command === 'copy' || command === 'cut') {
      void navigator.clipboard.writeText(copyText());
      if (command === 'cut') void onEdit(clearOps());
    } else if (command === 'paste') void navigator.clipboard.readText().then(pasteText);
    else if (command === 'delete') void onEdit(clearOps());
    else
      setSelection({
        anchor: { row: 0, column: 0 },
        focus: { row: rows.length - 1, column: columnCount - 1 },
      });
    return true;
  });

  useAssetDropZone(grid, (detail) => {
    const element = document
      .elementsFromPoint(detail.x, detail.y)
      .map((candidate) => candidate.closest<HTMLElement>('[data-row][data-column]'))
      .find((candidate) => candidate !== null);
    const point = element
      ? { row: Number(element.dataset['row']), column: Number(element.dataset['column']) }
      : null;
    const column = point ? columnAt(point.column) : undefined;
    const accepts =
      (column?.kind === 'link' && detail.links.length > 0) ||
      (column?.kind === 'image' && detail.ids.length > 0);
    if (detail.phase !== 'drop') {
      setDropCell(detail.phase === 'move' && accepts ? point : null);
      return;
    }
    setDropCell(null);
    const row = point ? rows[point.row] : undefined;
    if (!row || !column || !accepts) return;
    if (column.kind === 'image') {
      void onEdit([{ op: 'update', id: row.id, cells: { [column.id]: detail.ids[0] ?? null } }]);
      return;
    }
    const wanted = detail.links.filter(
      (link) => column.linkKinds.length === 0 || column.linkKinds.includes(link.kind),
    );
    if (wanted.length === 0) return;
    const current = row.cells[column.id];
    const existing: BoardLink[] = Array.isArray(current)
      ? current.filter((item): item is BoardLink => typeof item === 'object')
      : [];
    const value = column.multiple ? [...existing, ...wanted] : (wanted[0] ?? null);
    void onEdit([{ op: 'update', id: row.id, cells: { [column.id]: value } }]);
  });

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (editing || event.target !== grid.current) return;
    const mod = event.ctrlKey || event.metaKey;
    const { focus } = selection;
    const extend = event.shiftKey;
    const move = (row: number, column: number) => {
      event.preventDefault();
      select({ row, column }, extend);
    };
    if (mod) {
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) onUndo();
      else if (key === 'y' || (key === 'z' && event.shiftKey)) onRedo();
      else if (key === 'd') void onEdit(fillDownOps(table, rows, range));
      else if (key === 'a')
        setSelection({
          anchor: { row: 0, column: 0 },
          focus: { row: rows.length - 1, column: columnCount - 1 },
        });
      else return;
      event.preventDefault();
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        move(focus.row + 1, focus.column);
        return;
      case 'ArrowUp':
        move(focus.row - 1, focus.column);
        return;
      case 'ArrowRight':
        move(focus.row, focus.column + 1);
        return;
      case 'ArrowLeft':
        move(focus.row, focus.column - 1);
        return;
      case 'Home':
        move(focus.row, 0);
        return;
      case 'End':
        move(focus.row, columnCount - 1);
        return;
      case 'PageDown':
        move(focus.row + Math.floor(height / ROW_HEIGHT), focus.column);
        return;
      case 'PageUp':
        move(focus.row - Math.floor(height / ROW_HEIGHT), focus.column);
        return;
      case 'Tab':
        event.preventDefault();
        select({ row: focus.row, column: focus.column + (event.shiftKey ? -1 : 1) }, false);
        return;
      case 'Enter':
      case 'F2':
        event.preventDefault();
        startEditing(focus);
        return;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        void onEdit(clearOps());
        return;
      case ' ': {
        const row = rows[focus.row];
        const column = columnAt(focus.column);
        if (row && column?.kind === 'checkbox') {
          event.preventDefault();
          toggle(row, column);
          return;
        }
        break;
      }
      case 'Escape':
        setSelection({ anchor: focus, focus });
        return;
    }
    if (event.key.length === 1 && !event.altKey) {
      event.preventDefault();
      startEditing(focus, event.key);
    }
  }

  function onEditorKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!editing) return;
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      void commit(editing, { row: editing.row + 1, column: editing.column });
    } else if (event.key === 'Tab') {
      event.preventDefault();
      void commit(editing, { row: editing.row, column: editing.column + (event.shiftKey ? -1 : 1) });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(null);
      focusGrid();
    }
  }

  function onCopy(event: ClipboardEvent<HTMLDivElement>) {
    if (editing) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', copyText());
  }

  function onCut(event: ClipboardEvent<HTMLDivElement>) {
    if (editing) return;
    onCopy(event);
    void onEdit(clearOps());
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    if (editing) return;
    event.preventDefault();
    void pasteText(event.clipboardData.getData('text/plain'));
  }

  function onCellPointerDown(event: ReactPointerEvent, point: Point) {
    if (event.button !== 0 || (event.target as HTMLElement).closest('input')) return;
    if (editing && (editing.row !== point.row || editing.column !== point.column)) void commit(editing, null);
    select(point, event.shiftKey);
  }

  function startResize(event: ReactPointerEvent, column: TableColumn) {
    event.preventDefault();
    event.stopPropagation();
    const origin = event.clientX;
    const startWidth = column.width;
    let width = startWidth;
    const header = grid.current;
    const move = (moved: PointerEvent) => {
      width = clamp(Math.round(startWidth + moved.clientX - origin), 48, 800);
      header?.style.setProperty(`--width-${column.id}`, `${String(width)}px`);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      if (width !== startWidth) onResize(column.id, width);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  }

  const style = { '--columns': template, '--row-height': `${String(ROW_HEIGHT)}px` } as CSSProperties;
  const datalist = editing ? suggestions(columnAt(editing.column), lookup) : [];
  const listId = `table-suggestions-${table.id}`;

  return (
    <div
      ref={grid}
      role="grid"
      aria-label={table.name}
      aria-rowcount={rows.length + 1}
      aria-colcount={columnCount}
      aria-multiselectable="true"
      tabIndex={0}
      className={styles['grid']}
      style={style}
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop);
      }}
      onKeyDown={onKeyDown}
      onCopy={onCopy}
      onCut={onCut}
      onPaste={onPaste}
      {...assetDropZoneProps}
    >
      <div role="row" aria-rowindex={1} className={cx(styles['row'], styles['header'])}>
        {[null, ...table.columns].map((column, index) => {
          const id = column?.id ?? KEY_COLUMN;
          const label = column ? column.label || column.id : table.keyName;
          const sorted = sort?.columnId === (column?.id ?? null);
          return (
            <div
              key={id}
              role="columnheader"
              aria-colindex={index + 1}
              aria-sort={sorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
              className={cx(styles['headerCell'], activeColumn === id && styles['activeColumn'])}
            >
              <button
                type="button"
                className={styles['sort']}
                aria-label={t('editor.sortBy', { name: label })}
                title={column ? column.description : t('editor.keyHint')}
                onClick={() => {
                  onSort(column?.id ?? null);
                }}
              >
                <span className={styles['label']}>{label}</span>
                {sorted ? (
                  sort.direction === 'asc' ? (
                    <ArrowUp aria-hidden="true" />
                  ) : (
                    <ArrowDown aria-hidden="true" />
                  )
                ) : null}
              </button>
              <IconButton
                label={t('editor.settingsFor', { name: label })}
                size="sm"
                tooltip={false}
                className={styles['settings']}
                onClick={() => {
                  onOpenColumn(id);
                }}
              >
                <Settings2 aria-hidden="true" />
              </IconButton>
              {column ? (
                <span
                  className={styles['resize']}
                  aria-hidden="true"
                  onPointerDown={(event) => {
                    startResize(event, column);
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className={styles['body']} style={{ height: rows.length * ROW_HEIGHT }}>
        {rows.slice(start, end).map((row, offset) => {
          const index = start + offset;
          const rowIssues = issues.get(row.id);
          return (
            <div
              key={row.id}
              role="row"
              aria-rowindex={index + 2}
              className={styles['row']}
              style={{ transform: `translateY(${String(index * ROW_HEIGHT)}px)` }}
            >
              {[null, ...table.columns].map((column, columnIndex) => {
                const issue = column ? rowIssues?.get(column.id) : undefined;
                const selected = inRange(range, index, columnIndex);
                const focused = selection.focus.row === index && selection.focus.column === columnIndex;
                const isEditing = editing?.row === index && editing.column === columnIndex;
                return (
                  <div
                    key={column?.id ?? KEY_COLUMN}
                    role="gridcell"
                    aria-colindex={columnIndex + 1}
                    aria-selected={selected}
                    aria-invalid={issue ? true : undefined}
                    title={issue ? messages.issue(issue) : undefined}
                    data-row={index}
                    data-column={columnIndex}
                    className={cx(
                      styles['cell'],
                      columnIndex === 0 && styles['keyCell'],
                      selected && styles['selected'],
                      focused && styles['focused'],
                      issue && styles['invalid'],
                      column?.kind === 'formula' && styles['computed'],
                      dropCell?.row === index && dropCell.column === columnIndex && styles['dropTarget'],
                    )}
                    onPointerDown={(event) => {
                      onCellPointerDown(event, { row: index, column: columnIndex });
                    }}
                    onDoubleClick={() => {
                      startEditing({ row: index, column: columnIndex });
                    }}
                  >
                    {isEditing ? (
                      <input
                        className={styles['editor']}
                        aria-label={t('editor.editCell')}
                        value={editing.draft}
                        list={datalist.length > 0 ? listId : undefined}
                        autoFocus
                        onChange={(event) => {
                          setEditing({ ...editing, draft: event.target.value });
                        }}
                        onKeyDown={onEditorKeyDown}
                        onBlur={() => void commit(editing, null)}
                      />
                    ) : column ? (
                      <CellView
                        column={column}
                        row={row}
                        computed={computed}
                        lookup={lookup}
                        onToggle={() => {
                          toggle(row, column);
                        }}
                      />
                    ) : (
                      row.key
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {datalist.length > 0 ? (
        <datalist id={listId}>
          {datalist.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}

function suggestions(column: TableColumn | undefined, lookup: TableLookup): string[] {
  if (column?.kind === 'choice') return column.options.map((option) => option.value);
  if (column?.kind === 'reference' && column.tableId !== null)
    return lookup.rowsOf(column.tableId).map((row) => row.key);
  return [];
}
