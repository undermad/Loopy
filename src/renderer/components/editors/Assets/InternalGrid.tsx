import { useDraggable } from '@dnd-kit/core';
import { Palette, PenTool, SearchX, Shapes } from 'lucide-react';
import type { AssetFolder } from '@shared/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { ContextMenu, EmptyState, cx } from '@renderer/ui';
import { modifiersOf, type SelectModifiers } from './AssetGrid';
import { AssetMenuItems, type AssetMenuActions } from './AssetMenu';
import { InlineName } from './InlineName';
import { folderLabel, internalKey, type AssetDragData, type InternalItem } from './kinds';
import gridStyles from './AssetGrid.module.scss';
import styles from './InternalGrid.module.scss';

export interface InternalGridProps {
  items: InternalItem[];
  folders: AssetFolder[];
  selectedKeys: ReadonlySet<string>;
  renamingKey: string | null;
  layout: 'grid' | 'list';
  showPath: boolean;
  searching: boolean;
  label: string;
  menu: AssetMenuActions;
  dragFor: (key: string) => AssetDragData;
  onSelect: (item: InternalItem, modifiers: SelectModifiers) => void;
  onOpen: (item: InternalItem) => void;
  onRenameDone: (item: InternalItem, name: string | null) => void;
}

export function InternalThumbnail({
  item,
  className,
}: {
  item: InternalItem;
  className?: string | undefined;
}) {
  if (item.kind === 'palette' && item.colours.length > 0) {
    return (
      <span className={cx(styles['swatches'], className)} aria-hidden="true">
        {item.colours.slice(0, 8).map((hex, index) => (
          <span key={`${hex}-${String(index)}`} style={{ background: hex }} />
        ))}
      </span>
    );
  }
  const Icon = item.kind === 'board' ? PenTool : Palette;
  return <Icon aria-hidden="true" className={className} />;
}

interface CardProps {
  item: InternalItem;
  drag: AssetDragData;
  selected: boolean;
  renaming: boolean;
  layout: 'grid' | 'list';
  path: string | null;
  onSelect: (modifiers: SelectModifiers) => void;
  onOpen: () => void;
  onRenameDone: (name: string | null) => void;
}

function InternalCard({
  item,
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
    id: internalKey(item),
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
      aria-label={item.name}
      data-internal={item.kind}
      data-key={internalKey(item)}
      className={cx(
        gridStyles['card'],
        gridStyles[layout],
        selected && gridStyles['selected'],
        isDragging && gridStyles['dragging'],
      )}
      onClick={(event) => {
        onSelect(modifiersOf(event));
      }}
      onDoubleClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onOpen();
          return;
        }
        listeners?.['onKeyDown']?.(event);
      }}
    >
      <div className={cx(gridStyles['thumb'], styles['thumb'])}>
        <InternalThumbnail item={item} className={gridStyles['preview']} />
      </div>
      <div className={gridStyles['meta']}>
        {renaming ? (
          <InlineName value={item.name} label={t('item.name')} onDone={onRenameDone} />
        ) : (
          <span className={gridStyles['name']} title={item.name}>
            {item.name}
          </span>
        )}
        <span className={gridStyles['size']}>{t(`internalKinds.${item.kind}`)}</span>
        {path !== null ? <span className={gridStyles['path']}>{path}</span> : null}
      </div>
    </div>
  );
}

export function InternalGrid({
  items,
  folders,
  selectedKeys,
  renamingKey,
  layout,
  showPath,
  searching,
  label,
  menu,
  dragFor,
  onSelect,
  onOpen,
  onRenameDone,
}: InternalGridProps) {
  const { t } = useTranslation('assets');
  if (items.length === 0) {
    return (
      <EmptyState
        icon={searching ? <SearchX /> : <Shapes />}
        title={searching ? t('empty.search') : t('empty.internal')}
        description={searching ? t('empty.searchHint') : t('empty.internalHint')}
        className={gridStyles['empty']}
      />
    );
  }

  function groupOf(key: string): string[] {
    return selectedKeys.has(key) && selectedKeys.size > 1 ? Array.from(selectedKeys) : [key];
  }

  return (
    <div role="group" aria-label={label} className={cx(gridStyles['grid'], gridStyles[`${layout}Layout`])}>
      {items.map((item) => {
        const key = internalKey(item);
        return (
          <ContextMenu.Root key={key}>
            <ContextMenu.Trigger asChild>
              <div className={gridStyles['slot']}>
                <InternalCard
                  item={item}
                  drag={dragFor(key)}
                  selected={selectedKeys.has(key)}
                  renaming={renamingKey === key}
                  layout={layout}
                  path={
                    showPath
                      ? item.folderId
                        ? folderLabel(folders, item.folderId)
                        : t(item.kind === 'board' ? 'boards' : 'palettes')
                      : null
                  }
                  onSelect={(modifiers) => {
                    onSelect(item, modifiers);
                  }}
                  onOpen={() => {
                    onOpen(item);
                  }}
                  onRenameDone={(name) => {
                    onRenameDone(item, name);
                  }}
                />
              </div>
            </ContextMenu.Trigger>
            <ContextMenu.Content>
              <AssetMenuItems
                entry={{ key, kind: item.kind, id: item.id, name: item.name, folderId: item.folderId }}
                group={groupOf(key)}
                folders={folders}
                actions={menu}
              />
            </ContextMenu.Content>
          </ContextMenu.Root>
        );
      })}
    </div>
  );
}
