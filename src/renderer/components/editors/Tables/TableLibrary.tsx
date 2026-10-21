import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Copy, MoreHorizontal, Plus, Sheet, Trash2 } from 'lucide-react';
import type { BoardLink } from '@shared/board';
import type { DataTableSummary } from '@shared/tables';
import { reportAssetDrag } from '@renderer/lib/assets';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { createTable, deleteTable, duplicateTable, useTables } from '@renderer/lib/tables';
import { openInEditor, tableTarget, useWorkspaceNames } from '@renderer/lib/workspaces';
import { Button, ConfirmDialog, DropdownMenu, IconButton, Input } from '@renderer/ui';
import styles from './TableLibrary.module.scss';

const DRAG_DISTANCE = 4;

function useLinkDrag() {
  const dragged = useRef(false);
  function start(event: ReactPointerEvent, link: BoardLink) {
    if (event.button !== 0) return;
    const originX = event.clientX;
    const originY = event.clientY;
    dragged.current = false;
    const move = (moved: PointerEvent) => {
      if (!dragged.current && Math.hypot(moved.clientX - originX, moved.clientY - originY) < DRAG_DISTANCE)
        return;
      dragged.current = true;
      reportAssetDrag([], moved.clientX, moved.clientY, 'move', [link]);
    };
    const end = (ended: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (!dragged.current) return;
      reportAssetDrag([], ended.clientX, ended.clientY, ended.type === 'pointerup' ? 'drop' : 'cancel', [
        link,
      ]);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }
  return { start, wasDragged: () => dragged.current };
}

function uniqueName(base: string, taken: readonly string[]): string {
  const names = new Set(taken.map((name) => name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let index = 2;
  while (names.has(`${base} ${String(index)}`.toLowerCase())) index += 1;
  return `${base} ${String(index)}`;
}

export function TableLibrary({ state, setState }: EditorProps) {
  const { t } = useTranslation('tables');
  const names = useWorkspaceNames();
  const tables = useTables() ?? [];
  const drag = useLinkDrag();
  const [deleting, setDeleting] = useState<DataTableSummary | null>(null);
  const search = typeof state['search'] === 'string' ? state['search'] : '';
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = tables.filter((table) => words.every((word) => table.name.toLowerCase().includes(word)));

  function open(id: string) {
    openInEditor(tableTarget(id, names));
  }

  async function create() {
    const name = uniqueName(
      t('library.untitled'),
      tables.map((table) => table.name),
    );
    const { table } = await createTable({
      name,
      columns: [{ id: 'name', label: t('library.firstColumn'), kind: 'text' }],
    });
    open(table.id);
  }

  async function duplicate(table: DataTableSummary) {
    const name = uniqueName(
      t('library.copyName', { name: table.name }),
      tables.map((item) => item.name),
    );
    await duplicateTable(table.id, name);
  }

  return (
    <div className={styles['library']}>
      <div className={styles['actions']}>
        <Button size="sm" icon={<Plus aria-hidden="true" />} onClick={() => void create()}>
          {t('library.newTable')}
        </Button>
      </div>
      <Input
        type="search"
        size="sm"
        aria-label={t('library.search')}
        placeholder={t('library.search')}
        value={search}
        onChange={(event) => {
          setState({ search: event.target.value });
        }}
      />
      {tables.length === 0 ? (
        <p className={styles['empty']}>{t('library.empty')}</p>
      ) : shown.length === 0 ? (
        <p className={styles['empty']}>{t('library.noMatches')}</p>
      ) : (
        <ul className={styles['list']} aria-label={t('library.title')}>
          {shown.map((table) => (
            <li key={table.id} className={styles['item']}>
              <button
                type="button"
                className={styles['row']}
                title={t('library.drag')}
                onPointerDown={(event) => {
                  drag.start(event, { kind: 'table', id: table.id });
                }}
                onClick={() => {
                  if (!drag.wasDragged()) open(table.id);
                }}
              >
                <Sheet aria-hidden="true" />
                <span className={styles['name']}>{table.name}</span>
                <span className={styles['detail']}>{t('library.rows', { count: table.rowCount })}</span>
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <IconButton label={t('library.more', { name: table.name })} size="sm" tooltip={false}>
                    <MoreHorizontal aria-hidden="true" />
                  </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item
                    onSelect={() => {
                      open(table.id);
                    }}
                  >
                    <Sheet aria-hidden="true" />
                    {t('library.open')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={() => void duplicate(table)}>
                    <Copy aria-hidden="true" />
                    {t('library.duplicate')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    onSelect={() => {
                      setDeleting(table);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    {t('library.delete')}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t('library.deleteTitle', { name: deleting?.name ?? '' })}
        description={t('library.deleteDescription')}
        confirmLabel={t('library.deleteConfirm')}
        cancelLabel={t('library.cancel')}
        closeLabel={t('library.close')}
        destructive
        onConfirm={async () => {
          if (deleting) await deleteTable(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
