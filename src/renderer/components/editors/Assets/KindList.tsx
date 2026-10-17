import { useState, type DragEvent } from 'react';
import { ASSET_KINDS, type AssetKind } from '@shared/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import { KIND_ICONS, hasFiles } from './kinds';
import styles from './FolderTree.module.scss';

export interface KindListProps {
  counts: Record<AssetKind, number>;
  selected: AssetKind;
  onSelect: (kind: AssetKind) => void;
  onImport: (files: FileList) => void;
}

export function KindList({ counts, selected, onSelect, onImport }: KindListProps) {
  const { t } = useTranslation('assets');
  const [hover, setHover] = useState<AssetKind | null>(null);

  function onDragOver(event: DragEvent<HTMLDivElement>, kind: AssetKind) {
    if (!hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    setHover(kind);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    setHover(null);
    if (event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    onImport(event.dataTransfer.files);
  }

  return (
    <div role="listbox" aria-label={t('kindList')} className={styles['tree']}>
      {ASSET_KINDS.map((kind) => {
        const Icon = KIND_ICONS[kind];
        const active = selected === kind;
        return (
          <div
            key={kind}
            role="option"
            tabIndex={active ? 0 : -1}
            aria-selected={active}
            className={cx(styles['row'], active && styles['selected'], hover === kind && styles['over'])}
            style={{ paddingLeft: 'var(--space-2)' }}
            onClick={() => {
              onSelect(kind);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(kind);
              }
            }}
            onDragOver={(event) => {
              onDragOver(event, kind);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHover(null);
            }}
            onDrop={onDrop}
          >
            <span className={styles['icon']} aria-hidden="true">
              <Icon />
            </span>
            <span className={styles['name']}>{t(`kinds.${kind}`)}</span>
            <span className={styles['count']}>{counts[kind]}</span>
          </div>
        );
      })}
    </div>
  );
}
