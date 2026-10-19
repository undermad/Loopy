import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { BoardLink } from '@shared/board';
import type { FieldOf } from '@shared/cards';
import { assetDropZoneProps, useAssetDropZone } from '@renderer/lib/assets';
import { coerceValue, linkTargets } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { openLinked, useWorkspaceNames } from '@renderer/lib/workspaces';
import { cx } from '@renderer/ui';
import { AssetLinkCard, useResolvedLink } from '../../../AssetLinkCard/AssetLinkCard';
import { INTERACTIVE, type FieldViewProps } from './inputs';
import styles from '../CardView.module.scss';

function LinkChip({
  link,
  editable,
  onOpen,
  onRemove,
}: {
  link: BoardLink;
  editable: boolean;
  onOpen: (link: BoardLink) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('editors');
  const item = useResolvedLink(link);
  return (
    <span className={styles['link']} role="listitem">
      <AssetLinkCard
        link={link}
        onOpen={() => {
          onOpen(link);
        }}
        className={cx(INTERACTIVE, styles['linkCard'])}
      />
      {editable ? (
        <button
          type="button"
          className={cx(INTERACTIVE, styles['tagRemove'])}
          aria-label={t('cards.removeLink', { name: item.name })}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

export function LinkField({ field, value, label, editable, onChange }: FieldViewProps<FieldOf<'link'>>) {
  const { t } = useTranslation('editors');
  const names = useWorkspaceNames();
  const zone = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const links = linkTargets(value);
  useAssetDropZone(zone, (detail) => {
    if (!editable || detail.phase === 'leave') {
      setOver(false);
      return;
    }
    if (detail.phase === 'move') {
      setOver(true);
      return;
    }
    setOver(false);
    const next = coerceValue(field, field.multiple ? [...links, ...detail.links] : detail.links);
    if (next !== null) onChange(next);
  });
  return (
    <div
      ref={zone}
      role="group"
      aria-label={label}
      className={cx(styles['links'], over && styles['linksOver'])}
      {...(editable ? assetDropZoneProps : {})}
    >
      {links.length > 0 ? (
        <span className={styles['linkList']} role="list">
          {links.map((link) => (
            <LinkChip
              key={`${link.kind}:${link.id}`}
              link={link}
              editable={editable}
              onOpen={(target) => {
                openLinked(target, names);
              }}
              onRemove={() => {
                onChange(
                  coerceValue(
                    field,
                    links.filter((item) => item !== link),
                  ),
                );
              }}
            />
          ))}
        </span>
      ) : (
        <span className={cx(styles['static'], styles['empty'])}>{editable ? t('cards.linkHint') : '–'}</span>
      )}
    </div>
  );
}
