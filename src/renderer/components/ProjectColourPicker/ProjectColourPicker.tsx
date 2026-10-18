import { useState } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { Layers, Link2, Palette, Pipette } from 'lucide-react';
import { sameRef, type ColourValue, type Palette as PaletteData } from '@shared/colours';
import { useTranslation } from '@renderer/lib/i18n';
import { usePaletteGroups, useResolvedColour } from '@renderer/lib/palettes';
import { ColorSwatch, IconButton, Popover, cx } from '@renderer/ui';
import type { Size } from '@renderer/ui/types';
import styles from './ProjectColourPicker.module.scss';

const BASIC_COLOURS = [
  '#000000',
  '#ffffff',
  '#6b7280',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
];

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
  const groups = usePaletteGroups();
  const clustered = groups.some((group) => group.cluster);
  const resolved = useResolvedColour(value) ?? value.hex;
  const [open, setOpen] = useState(false);
  const linked = value.ref !== null && resolved !== value.hex;

  function renderPalette(palette: PaletteData) {
    return (
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
    );
  }

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
        <div role="group" aria-label={t('picker.basic')} className={cx(styles['palette'], styles['basic'])}>
          <span className={styles['paletteName']}>{t('picker.basic')}</span>
          <div className={styles['swatches']}>
            {BASIC_COLOURS.map((hex) => {
              const selected = value.ref === null && value.hex.toLowerCase() === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  aria-label={hex}
                  aria-pressed={selected}
                  title={hex}
                  className={cx(styles['swatch'], selected && styles['selected'])}
                  style={{ background: hex }}
                  onClick={() => {
                    onChange({ hex, ref: null });
                    setOpen(false);
                  }}
                />
              );
            })}
          </div>
        </div>
        {groups.length > 0 ? (
          <div className={styles['palettes']}>
            {groups.map((group) =>
              group.cluster ? (
                <div
                  key={group.cluster.id}
                  role="group"
                  aria-label={group.cluster.name}
                  className={styles['cluster']}
                >
                  <span className={styles['clusterName']}>
                    <Layers aria-hidden="true" />
                    {group.cluster.name}
                  </span>
                  <div className={styles['clusterPalettes']}>{group.items.map(renderPalette)}</div>
                </div>
              ) : (
                <div
                  key="ungrouped"
                  role="group"
                  aria-label={t('library.ungrouped')}
                  className={styles['palettes']}
                >
                  {clustered ? <span className={styles['clusterName']}>{t('library.ungrouped')}</span> : null}
                  {group.items.map(renderPalette)}
                </div>
              ),
            )}
          </div>
        ) : (
          <p className={styles['empty']}>
            <Palette aria-hidden="true" />
            {t('picker.noPalettes')}
          </p>
        )}
      </Popover.Content>
    </Popover.Root>
  );
}
