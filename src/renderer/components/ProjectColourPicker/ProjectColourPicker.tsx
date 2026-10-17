import { useState } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { Link2, Palette, Pipette } from 'lucide-react';
import { sameRef, type ColourValue } from '@shared/colours';
import { useTranslation } from '@renderer/lib/i18n';
import { usePalettes, useResolvedColour } from '@renderer/lib/palettes';
import { ColorSwatch, IconButton, Popover, cx } from '@renderer/ui';
import type { Size } from '@renderer/ui/types';
import styles from './ProjectColourPicker.module.scss';

export interface ProjectColourPickerProps {
  value: ColourValue;
  onChange: (value: ColourValue) => void;
  label: string;
  size?: Size;
  disabled?: boolean;
  className?: string | undefined;
}

export function ProjectColourPicker({
  value,
  onChange,
  label,
  size = 'md',
  disabled,
  className,
}: ProjectColourPickerProps) {
  const { t } = useTranslation('colours');
  const palettes = usePalettes() ?? [];
  const resolved = useResolvedColour(value) ?? value.hex;
  const [open, setOpen] = useState(false);
  const linked = value.ref !== null && resolved !== value.hex;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          className={cx(styles['trigger'], styles[size], className)}
        >
          <ColorSwatch color={resolved} size={size} />
          {value.ref || linked ? <Link2 aria-hidden="true" className={styles['link']} /> : null}
        </button>
      </Popover.Trigger>
      <Popover.Content className={styles['content']} align="start" aria-label={label}>
        {palettes.length > 0 ? (
          <div className={styles['palettes']}>
            {palettes.map((palette) => (
              <div key={palette.id} className={styles['palette']}>
                <span className={styles['paletteName']}>{palette.name}</span>
                <div className={styles['swatches']}>
                  {palette.colours.map((colour) => {
                    const ref = { paletteId: palette.id, colourId: colour.id };
                    const selected = sameRef(value.ref, ref);
                    return (
                      <button
                        key={colour.id}
                        type="button"
                        aria-label={`${palette.name}: ${colour.name || colour.hex}`}
                        aria-pressed={selected}
                        title={colour.name || colour.hex}
                        className={cx(styles['swatch'], selected && styles['selected'])}
                        style={{ background: colour.hex }}
                        onClick={() => {
                          onChange({ hex: colour.hex, ref });
                          setOpen(false);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles['empty']}>
            <Palette aria-hidden="true" />
            {t('picker.noPalettes')}
          </p>
        )}
        <div className={styles['custom']}>
          <span className={styles['paletteName']}>{t('picker.custom')}</span>
          <HexColorPicker
            className={styles['picker']}
            color={resolved}
            onChange={(hex) => {
              onChange({ hex, ref: null });
            }}
          />
          <div className={styles['customRow']}>
            <HexColorInput
              color={resolved}
              onChange={(hex) => {
                onChange({ hex, ref: null });
              }}
              prefixed
              aria-label={label}
              className={styles['input']}
            />
            <IconButton
              label={t('contrast.eyedropper')}
              size="sm"
              onClick={() => {
                void window.loopy.pickScreenColour().then((hex) => {
                  if (hex) onChange({ hex, ref: null });
                });
              }}
            >
              <Pipette aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
