import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { FolderOpen, SearchX } from 'lucide-react';
import { assetUrl, formatBytes, type Asset, type AssetFolder } from '@shared/assets';
import { assetActions } from '@renderer/lib/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { ConfirmDialog, ContextMenu, EmptyState, cx } from '@renderer/ui';
import { PromptDialog } from '../../Shell/PromptDialog';
import { KIND_ICONS, folderLabel, folderOptions, type AssetDragData } from './kinds';
import styles from './AssetGrid.module.scss';

export interface SelectModifiers {
  ctrl: boolean;
  shift: boolean;
}

export interface AssetGridProps {
  assets: Asset[];
  folders: AssetFolder[];
  selectedIds: ReadonlySet<string>;
  layout: 'grid' | 'list';
  showPath: boolean;
  searching: boolean;
  onSelect: (id: string, modifiers: SelectModifiers) => void;
  onOpen: (id: string) => void;
}

type Dialog = { kind: 'rename'; id: string } | { kind: 'delete'; ids: string[] } | null;

interface CardProps {
  asset: Asset;
  dragIds: string[];
  selected: boolean;
  layout: 'grid' | 'list';
  path: string | null;
  onSelect: (modifiers: SelectModifiers) => void;
  onOpen: () => void;
}

export function AssetThumbnail({ asset, className }: { asset: Asset; className?: string | undefined }) {
  const Icon = KIND_ICONS[asset.kind];
  return asset.kind === 'image' ? (
    <img src={assetUrl(asset.id)} alt="" loading="lazy" className={className} />
  ) : (
    <Icon aria-hidden="true" className={className} />
  );
}

function AssetCard({ asset, dragIds, selected, layout, path, onSelect, onOpen }: CardProps) {
  const data: AssetDragData = { type: 'asset', ids: dragIds };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: asset.id, data });

  function modifiers(event: MouseEvent | KeyboardEvent): SelectModifiers {
    return { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey };
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={asset.name}
      className={cx(
        styles['card'],
        styles[layout],
        selected && styles['selected'],
        isDragging && styles['dragging'],
      )}
      onClick={(event) => {
        onSelect(modifiers(event));
      }}
      onDoubleClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onSelect(modifiers(event));
          return;
        }
        listeners?.['onKeyDown']?.(event);
      }}
    >
      <div className={styles['thumb']}>
        <AssetThumbnail asset={asset} className={styles['preview']} />
      </div>
      <div className={styles['meta']}>
        <span className={styles['name']} title={asset.name}>
          {asset.name}
        </span>
        <span className={styles['size']}>{formatBytes(asset.size)}</span>
        {path !== null ? <span className={styles['path']}>{path}</span> : null}
      </div>
    </div>
  );
}

export function AssetGrid({
  assets,
  folders,
  selectedIds,
  layout,
  showPath,
  searching,
  onSelect,
  onOpen,
}: AssetGridProps) {
  const { t } = useTranslation('assets');
  const { t: tc } = useTranslation('common');
  const [dialog, setDialog] = useState<Dialog>(null);
  const renaming = dialog?.kind === 'rename' ? assets.find((asset) => asset.id === dialog.id) : undefined;
  const deleting = dialog?.kind === 'delete' ? dialog.ids : [];

  function groupOf(id: string): string[] {
    return selectedIds.has(id) && selectedIds.size > 1 ? Array.from(selectedIds) : [id];
  }

  if (assets.length === 0) {
    return (
      <EmptyState
        icon={searching ? <SearchX /> : <FolderOpen />}
        title={searching ? t('empty.search') : t('empty.folder')}
        description={searching ? t('empty.searchHint') : t('empty.folderHint')}
        className={styles['empty']}
      />
    );
  }

  return (
    <>
      <div role="group" aria-label={t('files')} className={cx(styles['grid'], styles[`${layout}Layout`])}>
        {assets.map((asset) => (
          <ContextMenu.Root key={asset.id}>
            <ContextMenu.Trigger asChild>
              <div className={styles['slot']}>
                <AssetCard
                  asset={asset}
                  dragIds={groupOf(asset.id)}
                  selected={selectedIds.has(asset.id)}
                  layout={layout}
                  path={
                    showPath ? (asset.folderId ? folderLabel(folders, asset.folderId) : t('topLevel')) : null
                  }
                  onSelect={(modifiers) => {
                    onSelect(asset.id, modifiers);
                  }}
                  onOpen={() => {
                    onOpen(asset.id);
                  }}
                />
              </div>
            </ContextMenu.Trigger>
            <ContextMenu.Content>
              <ContextMenu.Item
                onSelect={() => {
                  setDialog({ kind: 'rename', id: asset.id });
                }}
              >
                {t('asset.rename')}
              </ContextMenu.Item>
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger>{t('asset.moveTo')}</ContextMenu.SubTrigger>
                <ContextMenu.SubContent>
                  {folderOptions(folders, t('topLevel')).map((option) => (
                    <ContextMenu.Item
                      key={option.value}
                      disabled={(asset.folderId ?? 'root') === option.value}
                      onSelect={() =>
                        void assetActions.move(
                          groupOf(asset.id),
                          option.value === 'root' ? null : option.value,
                        )
                      }
                    >
                      {option.label}
                    </ContextMenu.Item>
                  ))}
                </ContextMenu.SubContent>
              </ContextMenu.Sub>
              <ContextMenu.Item onSelect={() => void assetActions.exportToDisk(asset.id)}>
                {t('asset.export')}
              </ContextMenu.Item>
              <ContextMenu.Separator />
              <ContextMenu.Item
                onSelect={() => {
                  setDialog({ kind: 'delete', ids: groupOf(asset.id) });
                }}
              >
                {groupOf(asset.id).length > 1
                  ? t('asset.deleteMany', { count: groupOf(asset.id).length })
                  : t('asset.delete')}
              </ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Root>
        ))}
      </div>
      {renaming ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={t('asset.rename')}
          label={t('asset.fileName')}
          initialValue={renaming.name}
          submitLabel={tc('actions.rename')}
          onSubmit={(name) => assetActions.update(renaming.id, { name }).then(() => undefined)}
        />
      ) : null}
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={deleting.length > 1 ? t('asset.deleteMany', { count: deleting.length }) : t('asset.delete')}
        description={
          deleting.length > 1
            ? t('asset.deleteManyConfirm', { count: deleting.length })
            : t('asset.deleteConfirm', { name: assets.find((asset) => asset.id === deleting[0])?.name ?? '' })
        }
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        closeLabel={tc('actions.close')}
        destructive
        onConfirm={async () => {
          if (deleting.length > 0) await assetActions.remove(deleting);
        }}
      />
    </>
  );
}
