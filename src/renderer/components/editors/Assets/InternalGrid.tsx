import { useDraggable } from '@dnd-kit/core';
import { Palette, PenTool, SearchX, Shapes } from 'lucide-react';
import type { AssetFolder } from '@shared/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { EmptyState, cx } from '@renderer/ui';
import { folderLabel, internalKey, type InternalDragData, type InternalItem } from './kinds';
import gridStyles from './AssetGrid.module.scss';
import styles from './InternalGrid.module.scss';

export interface InternalGridProps {
  items: InternalItem[];
  folders: AssetFolder[];
  selectedKey: string;
  layout: 'grid' | 'list';
  showPath: boolean;
  searching: boolean;
  label: string;
  onSelect: (item: InternalItem) => void;
  onOpen: (item: InternalItem) => void;
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

function InternalCard({
  item,
  selected,
  layout,
  path,
  onSelect,
  onOpen,
}: {
  item: InternalItem;
  selected: boolean;
  layout: 'grid' | 'list';
  path: string | null;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation('assets');
  const data: InternalDragData = { type: 'internal', kind: item.kind, id: item.id };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: internalKey(item), data });
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
      className={cx(
        gridStyles['card'],
        gridStyles[layout],
        selected && gridStyles['selected'],
        isDragging && gridStyles['dragging'],
      )}
      onClick={onSelect}
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
        <span className={gridStyles['name']} title={item.name}>
          {item.name}
        </span>
        <span className={gridStyles['size']}>{t(`internalKinds.${item.kind}`)}</span>
        {path !== null ? <span className={gridStyles['path']}>{path}</span> : null}
      </div>
    </div>
  );
}

export function InternalGrid({
  items,
  folders,
  selectedKey,
  layout,
  showPath,
  searching,
  label,
  onSelect,
  onOpen,
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
  return (
    <div role="group" aria-label={label} className={cx(gridStyles['grid'], gridStyles[`${layout}Layout`])}>
      {items.map((item) => (
        <div key={internalKey(item)} className={gridStyles['slot']}>
          <InternalCard
            item={item}
            selected={selectedKey === internalKey(item)}
            layout={layout}
            path={
              showPath
                ? item.folderId
                  ? folderLabel(folders, item.folderId)
                  : t(item.kind === 'board' ? 'boards' : 'palettes')
                : null
            }
            onSelect={() => {
              onSelect(item);
            }}
            onOpen={() => {
              onOpen(item);
            }}
          />
        </div>
      ))}
    </div>
  );
}
