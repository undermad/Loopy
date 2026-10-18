import { Palette, PenTool, Unlink } from 'lucide-react';
import { assetUrl, type Asset } from '@shared/assets';
import type { TicketLink } from '@shared/tickets';
import { useAssetsSnapshot } from '@renderer/lib/assets';
import { useBoards } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { usePalettes } from '@renderer/lib/palettes';
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
  const asset = assets.find((item) => item.id === link.id) ?? null;
  return { link, name: asset?.name ?? t('assetLink.missing'), detail, colours: [], asset, missing: !asset };
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
