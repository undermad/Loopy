import { assetUrl } from '@shared/assets';
import type { CardLayout } from '@shared/cards';
import { fontStack, resolveItemStyle } from '@renderer/lib/board';
import { cardAccent } from '@renderer/lib/cards';
import { readableTextColour } from '@renderer/lib/colour';
import { useResolvedColour } from '@renderer/lib/palettes';
import { cx } from '@renderer/ui';
import { CardView, type CardViewProps } from './CardView';
import styles from './CardFace.module.scss';

export interface CardFaceProps extends Omit<CardViewProps, 'layout'> {
  layout: CardLayout;
}

const EDGE_ACCENTS = ['top', 'left', 'border'] as const;

export function CardFace({ layout, values, className, ...view }: CardFaceProps) {
  const style = resolveItemStyle('card', layout.style);
  const accent = useResolvedColour(cardAccent(layout, values));
  const fill = useResolvedColour(style.fill);
  const gradient = useResolvedColour(layout.background.gradient?.colour ?? null);
  const { image, fit, overlay } = layout.background;
  const placement = layout.accentPlacement;
  const header =
    placement === 'header' && accent
      ? {
          '--card-header': accent,
          '--card-header-text': readableTextColour(accent),
          '--card-bleed': `${String(style.padding)}px`,
        }
      : {};
  const edge = EDGE_ACCENTS.find((item) => item === placement);
  return (
    <div
      className={styles['face']}
      style={{ fontFamily: fontStack(layout.font), ...header }}
      data-card-face=""
    >
      {image || gradient ? (
        <div className={styles['backdrop']} data-backdrop="" aria-hidden="true">
          {image ? (
            <img
              className={styles['image']}
              src={assetUrl(image)}
              alt=""
              style={{ objectFit: fit }}
              draggable={false}
            />
          ) : null}
          {image && overlay > 0 ? (
            <div className={styles['overlay']} style={{ background: fill ?? '#ffffff', opacity: overlay }} />
          ) : null}
          {gradient ? (
            <div
              className={styles['gradient']}
              data-gradient=""
              style={{
                backgroundImage: `linear-gradient(${String(layout.background.gradient?.angle ?? 180)}deg, transparent, ${gradient})`,
              }}
            />
          ) : null}
        </div>
      ) : null}
      {accent && edge ? (
        <span
          className={cx(styles['accent'], styles[edge])}
          data-accent={edge}
          style={edge === 'border' ? { borderColor: accent } : { backgroundColor: accent }}
        />
      ) : null}
      <CardView layout={layout} values={values} {...view} className={cx(styles['body'], className)} />
    </div>
  );
}
