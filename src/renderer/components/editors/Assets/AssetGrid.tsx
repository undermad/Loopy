import type { KeyboardEvent, MouseEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { FolderOpen, SearchX } from 'lucide-react';
import { assetUrl, formatBytes, type Asset, type AssetFolder } from '@shared/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { ContextMenu, EmptyState, cx } from '@renderer/ui';
import { AssetMenuItems, type AssetMenuActions } from './AssetMenu';
import { InlineName } from './InlineName';
import { KIND_ICONS, folderLabel, type AssetDragData } from './kinds';
import styles from './AssetGrid.module.scss';

export interface SelectModifiers {
  ctrl: boolean;
  shift: boolean;
}

export function modifiersOf(event: MouseEvent | KeyboardEvent): SelectModifiers {
  return { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey };
}

export interface AssetGridProps {
  assets: Asset[];
  folders: AssetFolder[];
  selectedIds: ReadonlySet<string>;
  layout: 'grid' | 'list';
  showPath: boolean;
  searching: boolean;
  renamingKey: string | null;
  menu: AssetMenuActions;
  dragFor: (key: string) => AssetDragData;
  onSelect: (id: string, modifiers: SelectModifiers) => void;
  onOpen: (id: string) => void;
  onRenameDone: (id: string, name: string | null) => void;
}

interface CardProps {
  asset: Asset;
  drag: AssetDragData;
  selected: boolean;
  renaming: boolean;
  layout: 'grid' | 'list';
  path: string | null;
  onSelect: (modifiers: SelectModifiers) => void;
  onOpen: () => void;
  onRenameDone: (name: string | null) => void;
}

export function AssetThumbnail({ asset, className }: { asset: Asset; className?: string | undefined }) {
  const Icon = KIND_ICONS[asset.kind];
  return asset.kind === 'image' ? (
    <img src={assetUrl(asset.id)} alt="" loading="lazy" className={className} />
  ) : (
    <Icon aria-hidden="true" className={className} />
  );
}

function AssetCard({
  asset,
  drag,
  selected,
  renaming,
  layout,
  path,
  onSelect,
  onOpen,
  onRenameDone,
}: CardProps) {
  const { t } = useTranslation('assets');
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: asset.id,
    data: drag,
    disabled: renaming,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={asset.name}
      data-key={asset.id}
      className={cx(
        styles['card'],
        styles[layout],
        selected && styles['selected'],
        isDragging && styles['dragging'],
      )}
      onClick={(event) => {
        onSelect(modifiersOf(event));
      }}
      onDoubleClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onSelect(modifiersOf(event));
          return;
        }
        listeners?.['onKeyDown']?.(event);
      }}
    >
      <div className={styles['thumb']}>
        <AssetThumbnail asset={asset} className={styles['preview']} />
      </div>
      <div className={styles['meta']}>
        {renaming ? (
          <InlineName value={asset.name} label={t('asset.fileName')} onDone={onRenameDone} />
        ) : (
          <span className={styles['name']} title={asset.name}>
            {asset.name}
          </span>
        )}
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
  renamingKey,
  menu,
  dragFor,
  onSelect,
  onOpen,
  onRenameDone,
}: AssetGridProps) {
  const { t } = useTranslation('assets');

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
    <div role="group" aria-label={t('files')} className={cx(styles['grid'], styles[`${layout}Layout`])}>
      {assets.map((asset) => (
        <ContextMenu.Root key={asset.id}>
          <ContextMenu.Trigger asChild>
            <div className={styles['slot']}>
              <AssetCard
                asset={asset}
                drag={dragFor(asset.id)}
                selected={selectedIds.has(asset.id)}
                renaming={renamingKey === asset.id}
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
                onRenameDone={(name) => {
                  onRenameDone(asset.id, name);
                }}
              />
            </div>
          </ContextMenu.Trigger>
          <ContextMenu.Content>
            <AssetMenuItems
              entry={{
                key: asset.id,
                kind: 'file',
                id: asset.id,
                name: asset.name,
                folderId: asset.folderId,
              }}
              group={groupOf(asset.id)}
              folders={folders}
              actions={menu}
            />
          </ContextMenu.Content>
        </ContextMenu.Root>
      ))}
    </div>
  );
}
