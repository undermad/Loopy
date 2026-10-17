import { useState } from 'react';
import { Copy, Plus, X } from 'lucide-react';
import { PALETTE_MAX_COLOURS, PALETTE_MIN_COLOURS, type PaletteColour } from '@shared/colours';
import { normaliseHex, readableTextColour } from '@renderer/lib/colour';
import { useTranslation } from '@renderer/lib/i18n';
import { IconButton, Input, cx } from '@renderer/ui';
import styles from './SwatchRow.module.scss';

export interface SwatchRowProps {
  colours: PaletteColour[];
  selectedIndex: number;
  baseIndex: number;
  editing: boolean;
  custom: boolean;
  onSelect: (index: number) => void;
  onHex: (index: number, hex: string) => void;
  onName: (index: number, name: string) => void;
  onBase: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onCopy: (hex: string) => void;
}

function HexField({
  index,
  hex,
  disabled,
  onCommit,
  label,
}: {
  index: number;
  hex: string;
  disabled: boolean;
  onCommit: (hex: string) => void;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && normaliseHex(draft) === null;

  function commit() {
    if (draft === null) return;
    const next = normaliseHex(draft);
    setDraft(null);
    if (next && next !== hex) onCommit(next);
  }

  return (
    <Input
      size="sm"
      className={styles['hex']}
      value={draft ?? hex}
      aria-label={label}
      invalid={invalid}
      disabled={disabled}
      data-index={index}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          setDraft(null);
        }
      }}
    />
  );
}

export function SwatchRow({
  colours,
  selectedIndex,
  baseIndex,
  editing,
  custom,
  onSelect,
  onHex,
  onName,
  onBase,
  onAdd,
  onRemove,
  onCopy,
}: SwatchRowProps) {
  const { t } = useTranslation('colours');
  return (
    <div className={styles['row']} role="list" aria-label={t('wheel.values')}>
      {colours.map((colour, index) => {
        const text = readableTextColour(colour.hex);
        return (
          <div
            key={colour.id}
            role="listitem"
            className={cx(styles['swatch'], index === selectedIndex && styles['selected'])}
          >
            <button
              type="button"
              className={styles['block']}
              style={{ background: colour.hex, color: text }}
              aria-label={`${String(index + 1)}: ${colour.name || colour.hex}`}
              aria-pressed={index === selectedIndex}
              onClick={() => {
                onSelect(index);
              }}
            >
              {index === baseIndex ? <span className={styles['baseTag']}>{t('wheel.base')}</span> : null}
            </button>
            <IconButton
              label={t('wheel.copyHex')}
              size="sm"
              tooltip={false}
              className={styles['copy']}
              onClick={() => {
                onCopy(colour.hex);
              }}
            >
              <Copy aria-hidden="true" />
            </IconButton>
            <HexField
              index={index}
              hex={colour.hex}
              disabled={!editing}
              label={t('wheel.hex', { index: index + 1 })}
              onCommit={(hex) => {
                onHex(index, hex);
              }}
            />
            <Input
              size="sm"
              value={colour.name}
              disabled={!editing}
              placeholder={t('wheel.namePlaceholder')}
              aria-label={t('wheel.colourName', { index: index + 1 })}
              maxLength={40}
              onChange={(event) => {
                onName(index, event.target.value);
              }}
            />
            <label className={styles['base']}>
              <input
                type="radio"
                name="base-colour"
                checked={index === baseIndex}
                disabled={!editing}
                aria-label={t('wheel.setBase')}
                onChange={() => {
                  onBase(index);
                }}
              />
              <span>{t('wheel.base')}</span>
            </label>
            {editing && custom && colours.length > PALETTE_MIN_COLOURS ? (
              <IconButton
                label={t('wheel.removeColour', { index: index + 1 })}
                size="sm"
                className={styles['remove']}
                onClick={() => {
                  onRemove(index);
                }}
              >
                <X aria-hidden="true" />
              </IconButton>
            ) : null}
          </div>
        );
      })}
      {editing && custom && colours.length < PALETTE_MAX_COLOURS ? (
        <button type="button" className={styles['add']} aria-label={t('wheel.addColour')} onClick={onAdd}>
          <Plus aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
