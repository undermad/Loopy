import { useRef, useState } from 'react';
import { Check, Pencil, Shuffle, X } from 'lucide-react';
import { HARMONIES, type Harmony, type Palette, type PaletteColour } from '@shared/colours';
import {
  deriveHarmony,
  formatHsl,
  formatRgb,
  hexToHsv,
  hsvToHex,
  moveHarmonyColour,
  randomBaseHex,
  randomHarmonyColours,
  type Hsv,
} from '@renderer/lib/colour';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, Field, Input, Select, useToast } from '@renderer/ui';
import { ColourWheel } from './ColourWheel';
import { SwatchRow } from './SwatchRow';
import editorStyles from './ColoursEditor.module.scss';
import styles from './WheelTab.module.scss';

export interface WheelDraftPatch {
  name?: string;
  harmony?: Harmony;
  baseIndex?: number;
  colours?: PaletteColour[];
}

export interface WheelTabProps {
  palette: Palette;
  editing: boolean;
  isNew: boolean;
  onChange: (patch: WheelDraftPatch) => void;
  onModify: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function WheelTab({ palette, editing, isNew, onChange, onModify, onSave, onCancel }: WheelTabProps) {
  const { t } = useTranslation('colours');
  const toast = useToast();
  const [selectedIndex, setSelectedIndex] = useState(palette.baseIndex);
  const colours = palette.colours;
  const safeIndex = Math.min(selectedIndex, colours.length - 1);
  const selected = colours[safeIndex];
  const custom = palette.harmony === 'custom';
  const origin = useRef<Hsv[] | null>(null);

  function move(index: number, hsv: Hsv) {
    onChange({ colours: moveHarmonyColour(palette, index, hsv, origin.current ?? undefined) });
  }

  function changeHarmony(harmony: Harmony) {
    if (harmony === 'custom') {
      onChange({ harmony });
      return;
    }
    const baseIndex = Math.min(palette.baseIndex, 4);
    onChange({ harmony, baseIndex, colours: deriveHarmony({ harmony, baseIndex, colours }) });
  }

  function randomise() {
    if (custom) {
      const hexes = randomHarmonyColours('custom');
      onChange({
        colours: colours.map((colour, index) => ({
          ...colour,
          hex: hexes[index % hexes.length] ?? colour.hex,
        })),
      });
      return;
    }
    onChange({ colours: deriveHarmony(palette, randomBaseHex()) });
  }

  function setBase(index: number) {
    onChange({
      baseIndex: index,
      colours: custom ? colours : deriveHarmony({ ...palette, baseIndex: index }),
    });
  }

  function setBrightness(value: number) {
    if (!selected) return;
    const hsv = hexToHsv(selected.hex);
    const hex = hsvToHex({ ...hsv, v: value / 100 });
    if (safeIndex === palette.baseIndex && !custom) {
      onChange({ colours: deriveHarmony(palette, hex) });
      return;
    }
    onChange({
      colours: colours.map((colour, index) => (index === safeIndex ? { ...colour, hex } : colour)),
    });
  }

  function copy(hex: string) {
    void navigator.clipboard.writeText(hex);
    toast.show({ title: t('wheel.copied', { hex }) });
  }

  return (
    <div className={editorStyles['tab']}>
      <div className={editorStyles['toolbar']}>
        {editing ? (
          <Field label={t('library.name')}>
            <Input
              size="sm"
              value={palette.name}
              aria-label={t('library.name')}
              maxLength={80}
              onChange={(event) => {
                onChange({ name: event.target.value });
              }}
            />
          </Field>
        ) : (
          <h2 className={styles['title']}>{palette.name}</h2>
        )}
        <Field label={t('harmony.label')}>
          <Select
            size="sm"
            value={palette.harmony}
            disabled={!editing}
            aria-label={t('harmony.label')}
            options={HARMONIES.map((harmony) => ({ value: harmony, label: t(`harmony.${harmony}`) }))}
            onValueChange={(value) => {
              changeHarmony(value as Harmony);
            }}
          />
        </Field>
        <Button
          size="sm"
          icon={<Shuffle aria-hidden="true" />}
          disabled={!editing}
          title={t('harmony.randomHint')}
          onClick={randomise}
        >
          {t('harmony.random')}
        </Button>
        <span className={styles['spacer']} />
        {editing ? (
          <>
            <Button size="sm" variant="ghost" icon={<X aria-hidden="true" />} onClick={onCancel}>
              {t('edit.cancel')}
            </Button>
            <Button size="sm" variant="primary" icon={<Check aria-hidden="true" />} onClick={onSave}>
              {isNew ? t('edit.save') : t('edit.saveChanges')}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="primary" icon={<Pencil aria-hidden="true" />} onClick={onModify}>
            {t('edit.modify')}
          </Button>
        )}
      </div>
      {editing ? null : <p className={editorStyles['muted']}>{t('edit.readOnlyHint')}</p>}
      <div className={styles['layout']}>
        <div className={styles['wheelColumn']}>
          <ColourWheel
            colours={colours}
            selectedIndex={safeIndex}
            baseIndex={palette.baseIndex}
            disabled={!editing}
            onSelect={setSelectedIndex}
            onChange={move}
            onDragStart={() => {
              origin.current = colours.map((colour) => hexToHsv(colour.hex));
            }}
            onDragEnd={() => {
              origin.current = null;
            }}
          />
          <label className={styles['slider']}>
            <span>{t('wheel.brightness')}</span>
            <input
              type="range"
              min={0}
              max={100}
              disabled={!editing}
              value={selected ? Math.round(hexToHsv(selected.hex).v * 100) : 100}
              aria-label={t('wheel.brightness')}
              onChange={(event) => {
                setBrightness(Number(event.target.value));
              }}
            />
          </label>
        </div>
        <div className={styles['values']}>
          <h3 className={editorStyles['heading']}>{t('wheel.values')}</h3>
          {selected ? (
            <dl className={styles['valueList']}>
              <dt>HEX</dt>
              <dd>{selected.hex}</dd>
              <dt>RGB</dt>
              <dd>{formatRgb(selected.hex)}</dd>
              <dt>HSL</dt>
              <dd>{formatHsl(selected.hex)}</dd>
            </dl>
          ) : null}
        </div>
      </div>
      <SwatchRow
        colours={colours}
        selectedIndex={safeIndex}
        baseIndex={palette.baseIndex}
        editing={editing}
        custom={custom}
        onSelect={setSelectedIndex}
        onHex={(index, hex) => {
          move(index, hexToHsv(hex));
        }}
        onName={(index, name) => {
          onChange({
            colours: colours.map((colour, position) => (position === index ? { ...colour, name } : colour)),
          });
        }}
        onBase={setBase}
        onCopy={copy}
        onAdd={() => {
          const last = colours[colours.length - 1];
          onChange({
            colours: [...colours, { id: crypto.randomUUID(), name: '', hex: last?.hex ?? '#808080' }],
          });
        }}
        onRemove={(index) => {
          const next = colours.filter((_, position) => position !== index);
          onChange({ colours: next, baseIndex: Math.min(palette.baseIndex, next.length - 1) });
          setSelectedIndex(Math.min(safeIndex, next.length - 1));
        }}
      />
    </div>
  );
}
