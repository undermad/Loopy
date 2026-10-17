import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Palette, Pipette } from 'lucide-react';
import { normaliseHex } from '@renderer/lib/colour';
import { useTranslation } from '@renderer/lib/i18n';
import { usePalettes } from '@renderer/lib/palettes';
import { ColorSwatch, DropdownMenu, IconButton, Input, Popover, cx } from '@renderer/ui';
import styles from './ColourInput.module.scss';

export interface ColourInputProps {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  className?: string | undefined;
}

export function ColourInput({ value, onChange, label, className }: ColourInputProps) {
  const { t } = useTranslation('colours');
  const palettes = usePalettes() ?? [];
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && normaliseHex(draft) === null;

  function commit() {
    if (draft === null) return;
    const next = normaliseHex(draft);
    setDraft(null);
    if (next && next !== value) onChange(next);
  }

  return (
    <div className={cx(styles['input'], className)}>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button type="button" className={styles['swatchButton']} aria-label={t('contrast.pickerLabel')}>
            <ColorSwatch color={value} size="md" />
          </button>
        </Popover.Trigger>
        <Popover.Content className={styles['popover']} align="start">
          <HexColorPicker className={styles['picker']} color={value} onChange={onChange} />
          <div className={styles['swatches']}>
            {palettes.flatMap((palette) =>
              palette.colours.map((colour) => (
                <button
                  key={colour.id}
                  type="button"
                  className={styles['paletteSwatch']}
                  style={{ background: colour.hex }}
                  aria-label={`${palette.name}: ${colour.name || colour.hex}`}
                  title={`${palette.name}: ${colour.name || colour.hex}`}
                  onClick={() => {
                    onChange(colour.hex);
                  }}
                />
              )),
            )}
          </div>
        </Popover.Content>
      </Popover.Root>
      <Input
        size="sm"
        className={styles['hex']}
        value={draft ?? value}
        aria-label={label}
        invalid={invalid}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <IconButton
        label={t('contrast.eyedropper')}
        size="sm"
        onClick={() => {
          void window.loopy.pickScreenColour().then((hex) => {
            if (hex) onChange(hex);
          });
        }}
      >
        <Pipette aria-hidden="true" />
      </IconButton>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton
            label={t('contrast.fromPalette')}
            size="sm"
            tooltip={false}
            disabled={palettes.length === 0}
          >
            <Palette aria-hidden="true" />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start">
          {palettes.map((palette) => (
            <DropdownMenu.Sub key={palette.id}>
              <DropdownMenu.SubTrigger>{palette.name}</DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent>
                {palette.colours.map((colour) => (
                  <DropdownMenu.Item
                    key={colour.id}
                    onSelect={() => {
                      onChange(colour.hex);
                    }}
                  >
                    <ColorSwatch color={colour.hex} size="sm" />
                    {colour.name || colour.hex}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}
