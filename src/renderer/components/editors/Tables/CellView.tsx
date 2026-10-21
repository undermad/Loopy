import type { BoardLink } from '@shared/board';
import { assetUrl } from '@shared/assets';
import { formatCell, type TableColumn, type TableLookup, type TableRow } from '@shared/tables';
import { useAsset } from '@renderer/lib/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { displayValue, type Computed } from '@renderer/lib/tables';
import { Tag, cx } from '@renderer/ui';
import { useResolvedLink } from '../../AssetLinkCard/AssetLinkCard';
import styles from './TableGrid.module.scss';

function LinkName({ link }: { link: BoardLink }) {
  const resolved = useResolvedLink(link);
  return <span className={cx(styles['chip'], resolved.missing && styles['missing'])}>{resolved.name}</span>;
}

function ImageCell({ id }: { id: string }) {
  const asset = useAsset(id);
  const { t } = useTranslation('editors');
  if (!asset) return <span className={styles['missing']}>{t('assetLink.missing')}</span>;
  return (
    <span className={styles['image']}>
      <img src={assetUrl(id)} alt="" />
      <span>{asset.name}</span>
    </span>
  );
}

function isLink(value: unknown): value is BoardLink {
  return typeof value === 'object' && value !== null && 'kind' in value && 'id' in value;
}

export interface CellViewProps {
  column: TableColumn;
  row: TableRow;
  computed: Computed;
  lookup: TableLookup;
  onToggle: () => void;
}

export function CellView({ column, row, computed, lookup, onToggle }: CellViewProps) {
  const value = displayValue(column, row, computed);
  switch (column.kind) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          className={styles['checkbox']}
          aria-label={column.label || column.id}
          checked={value === true}
          onChange={onToggle}
        />
      );
    case 'formula': {
      const result = computed.get(row.id)?.[column.id];
      if (!result || 'value' in result) return <>{typeof value === 'number' ? String(value) : ''}</>;
      return result.error === 'empty' ? null : <span className={styles['error']}>#{result.error}</span>;
    }
    case 'colour':
      return typeof value === 'string' ? (
        <span className={styles['colour']}>
          <span className={styles['swatch']} style={{ background: value }} />
          {value}
        </span>
      ) : null;
    case 'choice': {
      const picked = Array.isArray(value)
        ? value.filter((item) => typeof item === 'string')
        : typeof value === 'string'
          ? [value]
          : [];
      return (
        <span className={styles['chips']}>
          {picked.map((item) => {
            const colour = column.options.find((option) => option.value === item)?.colour?.hex;
            return (
              <Tag key={item} size="sm" {...(colour ? { color: colour } : {})}>
                {item}
              </Tag>
            );
          })}
        </span>
      );
    }
    case 'image':
      return typeof value === 'string' ? <ImageCell id={value} /> : null;
    case 'link': {
      const links = Array.isArray(value) ? value.filter(isLink) : isLink(value) ? [value] : [];
      return (
        <span className={styles['chips']}>
          {links.map((link) => (
            <LinkName key={`${link.kind}:${link.id}`} link={link} />
          ))}
        </span>
      );
    }
    case 'reference': {
      const text = formatCell(column, value ?? null, lookup);
      return <span className={cx(text.includes('?') && styles['missing'])}>{text}</span>;
    }
    default:
      return <>{formatCell(column, value ?? null, lookup)}</>;
  }
}
