import { IdCard, NotebookText, Palette, PenTool, Unlink } from 'lucide-react';
import { assetUrl, type Asset } from '@shared/assets';
import { frontmatterEnd } from '@shared/markdown';
import type { TicketLink } from '@shared/tickets';
import { useAssetsSnapshot } from '@renderer/lib/assets';
import { useBoards } from '@renderer/lib/board';
import { useSavedCards } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { useNotes } from '@renderer/lib/notes';
import { usePalettes } from '@renderer/lib/palettes';
import { useTables } from '@renderer/lib/tables';
import { cx } from '@renderer/ui';
import { KIND_ICONS } from '../editors/Assets/kinds';
import styles from './AssetLinkCard.module.scss';

export interface ResolvedLink {
  link: TicketLink;
  name: string;
  detail: string;
  colours: string[];
  asset: Asset | null;
  missing: boolean;
}

export function useResolvedLink(link: TicketLink): ResolvedLink {
  const { t } = useTranslation('editors');
  const boards = useBoards() ?? [];
  const palettes = usePalettes() ?? [];
  const { assets } = useAssetsSnapshot();
  const notes = useNotes();
  const cards = useSavedCards() ?? [];
  const tables = useTables() ?? [];
  const detail = t(`assetLink.kinds.${link.kind}`);
  if (link.kind === 'board') {
    const board = boards.find((item) => item.id === link.id);
    return {
      link,
      name: board?.name ?? t('assetLink.missing'),
      detail,
      colours: [],
      asset: null,
      missing: !board,
    };
  }
  if (link.kind === 'palette') {
    const palette = palettes.find((item) => item.id === link.id);
    return {
      link,
      name: palette?.name ?? t('assetLink.missing'),
      detail,
      colours: palette?.colours.map((colour) => colour.hex) ?? [],
      asset: null,
      missing: !palette,
    };
  }
  if (link.kind === 'note') {
    const note = notes.find((item) => item.id === link.id);
    return {
      link,
      name: note?.title ?? t('assetLink.missing'),
      detail: (note ? noteExcerpt(note.body) : '') || detail,
      colours: [],
      asset: null,
      missing: !note,
    };
  }
  if (link.kind === 'card') {
    const card = cards.find((item) => item.id === link.id);
    return {
      link,
      name: card?.name ?? t('assetLink.missing'),
      detail,
      colours: [],
      asset: null,
      missing: !card,
    };
  }
  if (link.kind === 'table') {
    const table = tables.find((item) => item.id === link.id);
    return {
      link,
      name: table?.name ?? t('assetLink.missing'),
      detail: table ? t('assetLink.rows', { count: table.rowCount }) : detail,
      colours: [],
      asset: null,
      missing: !table,
    };
  }
  const asset = assets.find((item) => item.id === link.id) ?? null;
  return { link, name: asset?.name ?? t('assetLink.missing'), detail, colours: [], asset, missing: !asset };
}

function noteExcerpt(body: string): string {
  const line = body
    .slice(frontmatterEnd(body))
    .split('\n')
    .map((text) => text.trim())
    .find((text) => text.length > 0 && !text.startsWith('#'));
  return (line ?? '').replace(/!?\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2').slice(0, 80);
}

function LinkIcon({ item }: { item: ResolvedLink }) {
  if (item.missing) return <Unlink aria-hidden="true" />;
  if (item.link.kind === 'palette' && item.colours.length > 0) {
    return (
      <span className={styles['swatches']} aria-hidden="true">
        {item.colours.slice(0, 5).map((hex, index) => (
          <span key={`${hex}-${String(index)}`} style={{ background: hex }} />
        ))}
      </span>
    );
  }
  if (item.asset?.kind === 'image') {
    return <img src={assetUrl(item.asset.id)} alt="" className={styles['image']} />;
  }
  const Icon =
    item.link.kind === 'board'
      ? PenTool
      : item.link.kind === 'palette'
        ? Palette
        : item.link.kind === 'note'
          ? NotebookText
          : item.link.kind === 'card'
            ? IdCard
            : KIND_ICONS[item.asset?.kind ?? 'other'];
  return <Icon aria-hidden="true" />;
}

export interface AssetLinkCardProps {
  link: TicketLink;
  onOpen: (link: TicketLink) => void;
  inert?: boolean;
  className?: string | undefined;
}

export function AssetLinkCard({ link, onOpen, inert = false, className }: AssetLinkCardProps) {
  const { t } = useTranslation('editors');
  const item = useResolvedLink(link);
  return (
    <button
      type="button"
      className={cx(styles['card'], item.missing && styles['missing'], inert && styles['inert'], className)}
      data-kind={link.kind}
      disabled={item.missing}
      tabIndex={inert ? -1 : undefined}
      title={item.missing ? t('assetLink.missingHint') : t('assetLink.open', { name: item.name })}
      onClick={() => {
        onOpen(link);
      }}
    >
      <span className={styles['icon']}>
        <LinkIcon item={item} />
      </span>
      <span className={styles['text']}>
        <span className={styles['name']}>{item.name}</span>
        <span className={styles['detail']}>{item.detail}</span>
      </span>
    </button>
  );
}
