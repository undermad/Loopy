import { useState, type DragEvent } from 'react';
import { Palette, PenTool } from 'lucide-react';
import { ASSET_KINDS, type AssetKind } from '@shared/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import { KIND_ICONS, hasFiles, type InternalKind } from './kinds';
import styles from './FolderTree.module.scss';

export type KindChoice = AssetKind | InternalKind;

export interface KindListProps {
  counts: Record<AssetKind, number>;
  internalCounts: Record<InternalKind, number>;
  selected: KindChoice;
  onSelect: (kind: KindChoice) => void;
  onImport: (files: FileList) => void;
}

const INTERNAL_ICONS: Record<InternalKind, typeof PenTool> = { board: PenTool, palette: Palette };

export function KindList({ counts, internalCounts, selected, onSelect, onImport }: KindListProps) {
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

  function row(kind: KindChoice, label: string, count: number, Icon: typeof PenTool, external: boolean) {
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
        onDragOver={
          external
            ? (event) => {
                onDragOver(event, kind as AssetKind);
              }
            : undefined
        }
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHover(null);
        }}
        onDrop={external ? onDrop : undefined}
      >
        <span className={styles['icon']} aria-hidden="true">
          <Icon />
        </span>
        <span className={styles['name']}>{label}</span>
        <span className={styles['count']}>{count}</span>
      </div>
    );
  }

  return (
    <div role="listbox" aria-label={t('kindList')} className={styles['tree']}>
      <div role="presentation" className={styles['section']}>
        {t('external')}
      </div>
      {ASSET_KINDS.map((kind) => row(kind, t(`kinds.${kind}`), counts[kind], KIND_ICONS[kind], true))}
      <div role="presentation" className={styles['section']}>
        {t('internal')}
      </div>
      {(['board', 'palette'] as const).map((kind) =>
        row(
          kind,
          t(kind === 'board' ? 'boards' : 'palettes'),
          internalCounts[kind],
          INTERNAL_ICONS[kind],
          false,
        ),
      )}
    </div>
  );
}
