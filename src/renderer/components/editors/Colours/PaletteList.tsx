import { useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Layers, MoreHorizontal, Plus } from 'lucide-react';
import type { Palette, PaletteCluster } from '@shared/colours';
import { useTranslation } from '@renderer/lib/i18n';
import {
  createCluster,
  deleteCluster,
  deletePalette,
  duplicatePalette,
  groupByCluster,
  moveToCluster,
  renameCluster,
  updatePalette,
} from '@renderer/lib/palettes';
import { Button, ConfirmDialog, DropdownMenu, IconButton, Input, ScrollArea, Tag, cx } from '@renderer/ui';
import { PromptDialog } from '../../Shell/PromptDialog';
import styles from './PaletteList.module.scss';

export interface PaletteListItem {
  palette: Palette;
  unsaved: boolean;
  isNew: boolean;
}

export interface PaletteListProps {
  items: PaletteListItem[];
  clusters: PaletteCluster[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDiscardNew: () => void;
  onCluster: (paletteId: string) => void;
}

type Dialog =
  | { kind: 'rename' | 'delete' | 'newCluster'; palette: Palette }
  | { kind: 'renameCluster' | 'deleteCluster' | 'deleteClusterAll'; cluster: PaletteCluster; count: number }
  | null;

export function PaletteList({
  items,
  clusters,
  selectedId,
  onSelect,
  onNew,
  onDiscardNew,
  onCluster,
}: PaletteListProps) {
  const { t } = useTranslation('colours');
  const { t: tc } = useTranslation('common');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const pending = useRef<Dialog>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const needle = search.trim().toLowerCase();
  const matches = ({ palette }: PaletteListItem) =>
    !needle || palette.name.toLowerCase().includes(needle) || palette.harmony.includes(needle);
  const groups = groupByCluster(items, clusters, (item) => item.palette)
    .map((group) => {
      const clusterMatch = Boolean(needle && group.cluster?.name.toLowerCase().includes(needle));
      return { ...group, visible: clusterMatch ? group.items : group.items.filter(matches), clusterMatch };
    })
    .filter((group) =>
      group.cluster ? !needle || group.clusterMatch || group.visible.length > 0 : group.visible.length > 0,
    );
  const visibleCount = groups.reduce((total, group) => total + group.visible.length, 0);

  async function duplicate(palette: Palette) {
    const copy = await duplicatePalette(palette.id, t('library.copyName', { name: palette.name }));
    if (copy) onSelect(copy.id);
  }

  function queue(next: Dialog) {
    pending.current = next;
  }

  function openQueued(event: Event) {
    if (!pending.current) return;
    event.preventDefault();
    setDialog(pending.current);
    pending.current = null;
  }

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderItem({ palette, unsaved, isNew }: PaletteListItem) {
    const shown = palette.name.trim() || t('library.untitled');
    return (
      <li key={palette.id} className={cx(styles['item'], palette.id === selectedId && styles['selected'])}>
        <button
          type="button"
          className={styles['select']}
          aria-label={t('library.select', { name: shown })}
          aria-current={palette.id === selectedId ? 'true' : undefined}
          onClick={() => {
            onSelect(palette.id);
          }}
        >
          <span className={styles['name']}>
            <span className={styles['nameText']}>{shown}</span>
            {unsaved ? (
              <Tag size="sm" className={styles['unsaved']}>
                {t('library.unsaved')}
              </Tag>
            ) : null}
          </span>
          <span className={styles['strip']} aria-hidden="true">
            {palette.colours.map((colour) => (
              <span key={colour.id} style={{ background: colour.hex }} />
            ))}
          </span>
          <span className={styles['meta']}>
            {t(`harmony.${palette.harmony}`)} · {t('library.colours', { count: palette.colours.length })}
          </span>
        </button>
        {isNew ? (
          <IconButton
            label={t('library.discard')}
            size="sm"
            tooltip={false}
            className={styles['menu']}
            onClick={onDiscardNew}
          >
            <MoreHorizontal aria-hidden="true" />
          </IconButton>
        ) : (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton label={t('library.menu')} size="sm" tooltip={false} className={styles['menu']}>
                <MoreHorizontal aria-hidden="true" />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" onCloseAutoFocus={openQueued}>
              <DropdownMenu.Item
                onSelect={() => {
                  queue({ kind: 'rename', palette });
                }}
              >
                {t('library.rename')}
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => void duplicate(palette)}>
                {t('library.duplicate')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => {
                  onCluster(palette.id);
                }}
              >
                {t('library.generateCluster')}
              </DropdownMenu.Item>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>{t('library.moveTo')}</DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  {clusters.map((cluster) => (
                    <DropdownMenu.Item
                      key={cluster.id}
                      disabled={cluster.id === palette.clusterId}
                      onSelect={() => void moveToCluster(palette.id, cluster.id)}
                    >
                      {cluster.name}
                    </DropdownMenu.Item>
                  ))}
                  {clusters.length > 0 ? <DropdownMenu.Separator /> : null}
                  <DropdownMenu.Item
                    onSelect={() => {
                      queue({ kind: 'newCluster', palette });
                    }}
                  >
                    {t('library.newCluster')}
                  </DropdownMenu.Item>
                  {palette.clusterId ? (
                    <DropdownMenu.Item onSelect={() => void moveToCluster(palette.id, null)}>
                      {t('library.removeFromCluster')}
                    </DropdownMenu.Item>
                  ) : null}
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                onSelect={() => {
                  queue({ kind: 'delete', palette });
                }}
              >
                {t('library.delete')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
      </li>
    );
  }

  function renderCluster(cluster: PaletteCluster, members: PaletteListItem[], total: number) {
    const open = !collapsed.has(cluster.id) || Boolean(needle);
    const first = members[0]?.palette.id;
    return (
      <li key={cluster.id} className={styles['cluster']}>
        <div className={styles['clusterHeader']}>
          <button
            type="button"
            className={styles['clusterToggle']}
            aria-expanded={open}
            aria-label={t('library.clusterToggle', { name: cluster.name })}
            onClick={() => {
              toggle(cluster.id);
            }}
          >
            {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
            <Layers aria-hidden="true" className={styles['clusterIcon']} />
            <span className={styles['nameText']}>{cluster.name}</span>
            <span className={styles['count']}>{t('library.clusterPalettes', { count: total })}</span>
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton label={t('library.clusterMenu')} size="sm" tooltip={false}>
                <MoreHorizontal aria-hidden="true" />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" onCloseAutoFocus={openQueued}>
              <DropdownMenu.Item
                onSelect={() => {
                  queue({ kind: 'renameCluster', cluster, count: total });
                }}
              >
                {t('library.renameCluster')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                disabled={!first}
                onSelect={() => {
                  if (first) onCluster(first);
                }}
              >
                {t('library.extendCluster')}
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                onSelect={() => {
                  queue({ kind: 'deleteCluster', cluster, count: total });
                }}
              >
                {t('library.deleteCluster')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                disabled={total === 0}
                onSelect={() => {
                  queue({ kind: 'deleteClusterAll', cluster, count: total });
                }}
              >
                {t('library.deleteClusterAll')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
        {open ? (
          members.length > 0 ? (
            <ul className={styles['clusterItems']} aria-label={cluster.name}>
              {members.map(renderItem)}
            </ul>
          ) : (
            <p className={styles['clusterEmpty']}>{t('library.clusterEmpty')}</p>
          )
        ) : null}
      </li>
    );
  }

  const confirm =
    dialog?.kind === 'delete'
      ? {
          title: t('library.delete'),
          description: t('library.deleteConfirm', { name: dialog.palette.name }),
          run: async () => {
            const remaining = await deletePalette(dialog.palette.id);
            const next = remaining[0];
            if (next && dialog.palette.id === selectedId) onSelect(next.id);
          },
        }
      : dialog?.kind === 'deleteCluster' || dialog?.kind === 'deleteClusterAll'
        ? {
            title:
              dialog.kind === 'deleteCluster' ? t('library.deleteCluster') : t('library.deleteClusterAll'),
            description:
              dialog.kind === 'deleteCluster'
                ? t('library.deleteClusterConfirm', { name: dialog.cluster.name })
                : t('library.deleteClusterAllConfirm', { name: dialog.cluster.name, count: dialog.count }),
            run: async () => {
              const library = await deleteCluster(dialog.cluster.id, dialog.kind === 'deleteClusterAll');
              const stillThere = library.palettes.some((palette) => palette.id === selectedId);
              const next = library.palettes[0];
              if (!stillThere && next) onSelect(next.id);
            },
          }
        : null;

  return (
    <div className={styles['list']}>
      <div className={styles['tools']}>
        <Input
          size="sm"
          type="search"
          value={search}
          aria-label={t('library.search')}
          placeholder={t('library.search')}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
        <IconButton label={t('library.new')} size="sm" variant="secondary" onClick={onNew}>
          <Plus aria-hidden="true" />
        </IconButton>
      </div>
      <ScrollArea className={styles['scroll']}>
        {items.length === 0 && clusters.length === 0 ? (
          <div className={styles['empty']}>
            <p>{t('library.empty')}</p>
            <p className={styles['hint']}>{t('library.emptyHint')}</p>
            <Button size="sm" variant="primary" icon={<Plus aria-hidden="true" />} onClick={onNew}>
              {t('library.new')}
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <p className={styles['empty']}>{t('library.noMatch')}</p>
        ) : (
          <ul className={styles['items']} aria-label={t('library.title')}>
            {groups.map((group) =>
              group.cluster ? (
                renderCluster(
                  group.cluster,
                  group.visible,
                  items.filter((item) => item.palette.clusterId === group.cluster?.id).length,
                )
              ) : (
                <li key="ungrouped" className={styles['loose']}>
                  {clusters.length > 0 && visibleCount > 0 ? (
                    <h3 className={styles['groupLabel']}>{t('library.ungrouped')}</h3>
                  ) : null}
                  <ul className={styles['clusterItems']} aria-label={t('library.ungrouped')}>
                    {group.visible.map(renderItem)}
                  </ul>
                </li>
              ),
            )}
          </ul>
        )}
      </ScrollArea>
      {dialog?.kind === 'rename' ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={t('library.rename')}
          label={t('library.name')}
          initialValue={dialog.palette.name}
          submitLabel={tc('actions.rename')}
          onSubmit={(name) => updatePalette(dialog.palette.id, { name }).then(() => undefined)}
        />
      ) : null}
      {dialog?.kind === 'renameCluster' ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={t('library.renameCluster')}
          label={t('library.clusterName')}
          initialValue={dialog.cluster.name}
          submitLabel={tc('actions.rename')}
          onSubmit={(name) => renameCluster(dialog.cluster.id, name).then(() => undefined)}
        />
      ) : null}
      {dialog?.kind === 'newCluster' ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={t('library.newCluster')}
          label={t('library.clusterName')}
          initialValue={t('cluster.defaultName', { name: dialog.palette.name })}
          submitLabel={tc('actions.create')}
          onSubmit={(name) => createCluster({ name, paletteIds: [dialog.palette.id] }).then(() => undefined)}
        />
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        closeLabel={tc('actions.close')}
        destructive
        onConfirm={async () => {
          await confirm?.run();
        }}
      />
    </div>
  );
}
