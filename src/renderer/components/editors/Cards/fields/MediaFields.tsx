import { ImageOff } from 'lucide-react';
import { assetUrl } from '@shared/assets';
import type { FieldOf } from '@shared/cards';
import { useAssetsSnapshot } from '@renderer/lib/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { DropdownMenu, cx } from '@renderer/ui';
import { GAME_ICON_NAMES, GameIcon } from '../../../GameIcon/GameIcon';
import { INTERACTIVE, type FieldViewProps } from './inputs';
import styles from '../CardView.module.scss';

export function ImageField({ value, editable, label, onChange }: FieldViewProps<FieldOf<'image'>>) {
  const { t } = useTranslation('editors');
  const assets = useAssetsSnapshot().assets.filter((asset) => asset.kind === 'image');
  const id = typeof value === 'string' ? value : null;
  const picture = id ? (
    <img className={styles['picture']} src={assetUrl(id)} alt={label} draggable={false} />
  ) : (
    <span className={styles['noPicture']}>
      <ImageOff aria-hidden="true" />
      {t('cards.noImage')}
    </span>
  );
  if (!editable) return <div className={styles['pictureFrame']}>{picture}</div>;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cx(INTERACTIVE, styles['pictureFrame'], styles['pictureButton'])}
          aria-label={`${label}: ${t('cards.pickImage')}`}
        >
          {picture}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        {assets.length === 0 ? <DropdownMenu.Label>{t('board.tools.noImages')}</DropdownMenu.Label> : null}
        {assets.map((asset) => (
          <DropdownMenu.Item
            key={asset.id}
            onSelect={() => {
              onChange(asset.id);
            }}
          >
            {asset.name}
          </DropdownMenu.Item>
        ))}
        {id ? (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onSelect={() => {
                onChange(null);
              }}
            >
              {t('cards.clearImage')}
            </DropdownMenu.Item>
          </>
        ) : null}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export function ColourField({ value, editable, label, onChange }: FieldViewProps<FieldOf<'colour'>>) {
  const text = typeof value === 'string' ? value : '';
  return (
    <div className={styles['colour']}>
      <span className={styles['swatch']} style={{ background: text || 'transparent' }} />
      {editable ? (
        <input
          className={cx(INTERACTIVE, styles['input'], styles['hex'])}
          type="color"
          value={text || '#000000'}
          aria-label={label}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      ) : (
        <span className={styles['static']}>{text || '–'}</span>
      )}
    </div>
  );
}

export function IconField({
  value,
  editable,
  label,
  colour,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'icon'>>) {
  const { t } = useTranslation('editors');
  const name = typeof value === 'string' ? value : null;
  const size = textStyle.fontSize ? `calc(${String(textStyle.fontSize)} * 2)` : '2em';
  const glyph = name ? (
    <GameIcon name={name} size={size} color={colour ?? undefined} />
  ) : (
    <span className={styles['empty']}>{t('cards.noIcon')}</span>
  );
  if (!editable) {
    return (
      <span
        className={styles['icon']}
        role="img"
        aria-label={name ? `${label}: ${t(`icons.${name as 'sword'}`)}` : label}
      >
        {glyph}
      </span>
    );
  }
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cx(INTERACTIVE, styles['icon'], styles['iconButton'])}
          aria-label={`${label}: ${t('cards.chooseIcon')}`}
        >
          {glyph}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className={styles['iconMenu']}>
        {GAME_ICON_NAMES.map((icon) => (
          <DropdownMenu.Item
            key={icon}
            onSelect={() => {
              onChange(icon);
            }}
          >
            <GameIcon name={icon} size={16} />
            {t(`icons.${icon}`)}
          </DropdownMenu.Item>
        ))}
        {name ? (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onSelect={() => {
                onChange(null);
              }}
            >
              {t('cards.clearIcon')}
            </DropdownMenu.Item>
          </>
        ) : null}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
