import type { CardValue } from '@shared/board';
import type { CardLayout } from '@shared/cards';
import { resolveItemStyle } from '@renderer/lib/board';
import { readableTextColour } from '@renderer/lib/colour';
import { useResolvedColour } from '@renderer/lib/palettes';
import { CardView } from './CardView';
import styles from './CardDesigner.module.scss';

export function CardPreview({
  layout,
  values,
  selectedFieldId,
  onValue,
  onSelectField,
}: {
  layout: CardLayout;
  values: Record<string, CardValue>;
  selectedFieldId: string | null;
  onValue: (fieldId: string, value: CardValue) => void;
  onSelectField?: ((fieldId: string) => void) | undefined;
}) {
  const style = resolveItemStyle('card', layout.style);
  const fill = useResolvedColour(style.fill);
  const stroke = useResolvedColour(style.stroke);
  const textOverride = useResolvedColour(style.textColour);
  const accent = useResolvedColour(layout.accent);
  const text = textOverride ?? (fill ? readableTextColour(fill) : '#1a1a1a');
  return (
    <div
      className={styles['previewCard']}
      style={{
        width: layout.width,
        height: layout.height,
        background: fill ?? 'transparent',
        border:
          stroke && style.strokeWidth > 0
            ? `${String(style.strokeWidth)}px ${style.strokeStyle} ${stroke}`
            : 'none',
        borderRadius: style.radius,
        boxShadow: style.shadow ? '0 2px 10px rgb(0 0 0 / 18%)' : 'none',
        padding: style.padding,
        color: text,
        fontSize: style.fontSize,
        opacity: style.opacity,
      }}
    >
      {accent ? <span className={styles['accent']} style={{ background: accent }} /> : null}
      <CardView
        layout={layout}
        values={values}
        editable
        onChange={onValue}
        selectedFieldId={selectedFieldId}
        {...(onSelectField ? { onSelectField } : {})}
        className={styles['previewBody']}
      />
    </div>
  );
}
