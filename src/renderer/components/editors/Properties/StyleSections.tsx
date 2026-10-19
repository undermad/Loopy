import { useState, type ReactNode } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ClipboardPaste,
  Copy,
  Trash2,
} from 'lucide-react';
import {
  FONT_FAMILIES,
  FONT_WEIGHTS,
  ITEM_SHAPES,
  SHADOW_SIZES,
  STROKE_STYLES,
  TEXT_ALIGNS,
  TEXT_CASES,
  VERTICAL_ALIGNS,
  type BoardNode,
  type ItemStyle,
} from '@shared/board';
import type { ColourValue } from '@shared/colours';
import {
  commitChanges,
  copiedItemStyle,
  copyItemStyle,
  ownStyle,
  patchStyle,
  resolveItemStyle,
  sharedStyleValue,
  withData,
  type ResolvedStyle,
  type StylePatch,
} from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { createItemStyle, deleteItemStyle, useItemStyles } from '@renderer/lib/itemStyles';
import {
  Button,
  DropdownMenu,
  Field,
  IconButton,
  PropertySection,
  Select,
  Switch,
  ToggleGroup,
  useToast,
} from '@renderer/ui';
import { ProjectColourPicker } from '../../ProjectColourPicker/ProjectColourPicker';
import { PromptDialog } from '../../Shell/PromptDialog';
import { NumberField } from './NumberField';
import styles from './PropertiesEditor.module.scss';

const ALIGN_ICONS: Record<NonNullable<ItemStyle['align']>, ReactNode> = {
  left: <AlignLeft aria-hidden="true" />,
  center: <AlignCenter aria-hidden="true" />,
  right: <AlignRight aria-hidden="true" />,
};

const VERTICAL_ALIGN_ICONS: Record<NonNullable<ItemStyle['verticalAlign']>, ReactNode> = {
  top: <AlignVerticalJustifyStart aria-hidden="true" />,
  middle: <AlignVerticalJustifyCenter aria-hidden="true" />,
  bottom: <AlignVerticalJustifyEnd aria-hidden="true" />,
};

const NONE = '__none';

export interface StyleTarget {
  nodes: BoardNode[];
  resolved: ResolvedStyle;
  own: ItemStyle;
  mixed: (key: keyof ResolvedStyle) => boolean;
  set: (patch: StylePatch) => void;
  replace: (style: ItemStyle) => void;
}

export function styleTarget(nodes: BoardNode[], layers: (ItemStyle | undefined)[] = []): StyleTarget {
  const [first] = nodes;
  const own = first ? ownStyle(first) : {};
  const commit = (next: BoardNode[]) => {
    const boardId = next[0]?.boardId;
    if (boardId) void commitChanges(boardId, { upsertNodes: next });
  };
  return {
    nodes,
    own,
    resolved: resolveItemStyle(first?.type ?? 'text', ...layers, own),
    mixed: (key) => nodes.length > 1 && sharedStyleValue(nodes, key).mixed,
    set: (patch) => {
      commit(nodes.map((node) => withData(node, { style: patchStyle(ownStyle(node), patch) })));
    },
    replace: (style) => {
      commit(nodes.map((node) => withData(node, { style: structuredClone(style) })));
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function Mixed({
  target,
  keys,
  label,
}: {
  target: StyleTarget;
  keys: (keyof ResolvedStyle)[];
  label: string;
}) {
  const { t } = useTranslation('editors');
  if (!keys.some((key) => target.mixed(key))) return null;
  return <span className={styles['mixed']}>{t('properties.mixedValue', { label })}</span>;
}

interface ColourFieldProps {
  label: string;
  value: ColourValue | null | undefined;
  fallback: string;
  onChange: (value: ColourValue | null | undefined) => void;
}

export function ColourField({ label, value, fallback, onChange }: ColourFieldProps) {
  const { t } = useTranslation('editors');
  return (
    <div className={styles['swatchRow']}>
      <ProjectColourPicker
        size="sm"
        value={value ?? { hex: fallback, ref: null }}
        label={label}
        onChange={onChange}
      />
      <span>{label}</span>
      {value !== undefined ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange(undefined);
          }}
        >
          {t('properties.resetFill')}
        </Button>
      ) : null}
      {value !== null ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange(null);
          }}
        >
          {t('properties.none')}
        </Button>
      ) : null}
    </div>
  );
}

function PresetBar({ target }: { target: StyleTarget }) {
  const { t } = useTranslation('editors');
  const toast = useToast();
  const presets = useItemStyles() ?? [];
  const [saving, setSaving] = useState(false);
  const copied = copiedItemStyle();
  const [first] = target.nodes;
  return (
    <>
      {presets.length > 0 ? (
        <Field label={t('properties.stylePreset')}>
          <Select
            size="sm"
            value={NONE}
            aria-label={t('properties.stylePreset')}
            options={[
              { value: NONE, label: t('properties.applyPreset') },
              ...presets.map((preset) => ({ value: preset.id, label: preset.name })),
            ]}
            onValueChange={(id) => {
              const preset = presets.find((item) => item.id === id);
              if (preset) target.replace(preset.style);
            }}
          />
        </Field>
      ) : null}
      <div className={styles['arrange']}>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setSaving(true);
          }}
        >
          {t('properties.savePreset')}
        </Button>
        <IconButton
          size="sm"
          label={t('properties.copyStyle')}
          disabled={!first}
          onClick={() => {
            if (first) copyItemStyle(first);
          }}
        >
          <Copy aria-hidden="true" />
        </IconButton>
        <IconButton
          size="sm"
          label={t('properties.pasteStyle')}
          disabled={!copied}
          onClick={() => {
            if (copied) target.replace(copied);
          }}
        >
          <ClipboardPaste aria-hidden="true" />
        </IconButton>
        {presets.length > 0 ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton size="sm" label={t('properties.deletePreset')}>
                <Trash2 aria-hidden="true" />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              {presets.map((preset) => (
                <DropdownMenu.Item
                  key={preset.id}
                  onSelect={() => {
                    void deleteItemStyle(preset.id);
                  }}
                >
                  {t('properties.deletePresetItem', { name: preset.name })}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        ) : null}
      </div>
      <PromptDialog
        open={saving}
        onOpenChange={setSaving}
        title={t('properties.savePreset')}
        label={t('properties.presetName')}
        submitLabel={t('properties.savePresetSubmit')}
        onSubmit={async (name) => {
          const preset = await createItemStyle({ name, style: target.own });
          toast.show({ title: t('properties.presetSaved', { name: preset.name }), variant: 'success' });
        }}
      />
    </>
  );
}

function AppearanceMore({ target }: { target: StyleTarget }) {
  const { t } = useTranslation('editors');
  const { resolved } = target;
  return (
    <>
      <Switch
        size="sm"
        label={t('properties.gradient')}
        checked={resolved.gradient !== null}
        onCheckedChange={(on) => {
          target.set({ gradient: on ? { colour: { hex: '#000000', ref: null }, angle: 180 } : undefined });
        }}
      />
      {resolved.gradient ? (
        <div className={styles['pair']}>
          <ColourField
            label={t('properties.gradientColour')}
            value={resolved.gradient.colour}
            fallback="#000000"
            onChange={(colour) => {
              if (colour && resolved.gradient) target.set({ gradient: { ...resolved.gradient, colour } });
            }}
          />
          <NumberField
            label={t('properties.angle')}
            value={resolved.gradient.angle}
            min={0}
            step={15}
            digits={0}
            onCommit={(angle) => {
              if (resolved.gradient)
                target.set({ gradient: { ...resolved.gradient, angle: clamp(angle, 0, 360) } });
            }}
          />
        </div>
      ) : null}
      {resolved.shadow ? (
        <Field label={t('properties.shadowSize')}>
          <Select
            size="sm"
            value={resolved.shadowSize}
            aria-label={t('properties.shadowSize')}
            options={SHADOW_SIZES.map((size) => ({
              value: size,
              label: t(`properties.shadowSizes.${size}`),
            }))}
            onValueChange={(size) => {
              target.set({ shadowSize: size as ResolvedStyle['shadowSize'] });
            }}
          />
        </Field>
      ) : null}
    </>
  );
}

export function AppearanceSection({ target }: { target: StyleTarget }) {
  const { t } = useTranslation('editors');
  const { resolved, own } = target;
  return (
    <PropertySection
      title={t('properties.sections.appearance')}
      more={<AppearanceMore target={target} />}
      moreLabel={t('properties.more')}
      lessLabel={t('properties.less')}
    >
      <PresetBar target={target} />
      <Field label={t('properties.shape')}>
        <Select
          size="sm"
          value={resolved.shape}
          aria-label={t('properties.shape')}
          options={ITEM_SHAPES.map((shape) => ({ value: shape, label: t(`properties.shapes.${shape}`) }))}
          onValueChange={(value) => {
            target.set({ shape: value as ItemStyle['shape'] });
          }}
        />
      </Field>
      <ColourField
        label={t('properties.fill')}
        value={own.fill}
        fallback="#ffffff"
        onChange={(fill) => {
          target.set({ fill });
        }}
      />
      <Mixed target={target} keys={['fill']} label={t('properties.fill')} />
      <ColourField
        label={t('properties.stroke')}
        value={own.stroke}
        fallback="#334155"
        onChange={(stroke) => {
          target.set({ stroke });
        }}
      />
      <Mixed target={target} keys={['stroke']} label={t('properties.stroke')} />
      <div className={styles['pair']}>
        <NumberField
          label={t('properties.strokeWidth')}
          value={resolved.strokeWidth}
          min={0}
          step={1}
          digits={1}
          onCommit={(value) => {
            target.set({ strokeWidth: clamp(value, 0, 32) });
          }}
        />
        <Field label={t('properties.strokeStyle')}>
          <Select
            size="sm"
            value={resolved.strokeStyle}
            aria-label={t('properties.strokeStyle')}
            options={STROKE_STYLES.map((value) => ({ value, label: t(`properties.strokeStyles.${value}`) }))}
            onValueChange={(value) => {
              target.set({ strokeStyle: value as ItemStyle['strokeStyle'] });
            }}
          />
        </Field>
      </div>
      <div className={styles['pair']}>
        <NumberField
          label={t('properties.radius')}
          value={resolved.radius}
          min={0}
          step={1}
          digits={0}
          onCommit={(value) => {
            target.set({ radius: clamp(value, 0, 400) });
          }}
        />
        <NumberField
          label={t('properties.padding')}
          value={resolved.padding}
          min={0}
          step={1}
          digits={0}
          onCommit={(value) => {
            target.set({ padding: clamp(value, 0, 200) });
          }}
        />
      </div>
      <NumberField
        label={`${t('properties.opacity')} (%)`}
        value={Math.round(resolved.opacity * 100)}
        min={0}
        step={5}
        digits={0}
        onCommit={(value) => {
          target.set({ opacity: clamp(value, 0, 100) / 100 });
        }}
      />
      <Mixed target={target} keys={['opacity']} label={t('properties.opacity')} />
      <Switch
        size="sm"
        label={t('properties.shadow')}
        checked={resolved.shadow}
        onCheckedChange={(shadow) => {
          target.set({ shadow });
        }}
      />
    </PropertySection>
  );
}

function TypographyMore({ target }: { target: StyleTarget }) {
  const { t } = useTranslation('editors');
  const { resolved } = target;
  return (
    <>
      <div className={styles['pair']}>
        <Field label={t('properties.font')}>
          <Select
            size="sm"
            value={resolved.fontFamily}
            aria-label={t('properties.font')}
            options={FONT_FAMILIES.map((font) => ({ value: font, label: t(`properties.fonts.${font}`) }))}
            onValueChange={(font) => {
              target.set({ fontFamily: font as ResolvedStyle['fontFamily'] });
            }}
          />
        </Field>
        <NumberField
          label={t('properties.lineHeight')}
          value={resolved.lineHeight}
          min={0.8}
          step={0.1}
          digits={2}
          onCommit={(value) => {
            target.set({ lineHeight: clamp(value, 0.8, 3) });
          }}
        />
      </div>
      <div className={styles['toggles']}>
        {(['italic', 'underline', 'strike'] as const).map((key) => (
          <Switch
            key={key}
            size="sm"
            label={t(`properties.${key}`)}
            checked={resolved[key]}
            onCheckedChange={(on) => {
              target.set({ [key]: on });
            }}
          />
        ))}
      </div>
      <Field label={t('properties.textCase')}>
        <Select
          size="sm"
          value={resolved.textCase}
          aria-label={t('properties.textCase')}
          options={TEXT_CASES.map((value) => ({ value, label: t(`properties.textCases.${value}`) }))}
          onValueChange={(value) => {
            target.set({ textCase: value as ResolvedStyle['textCase'] });
          }}
        />
      </Field>
    </>
  );
}

export function TypographySection({ target }: { target: StyleTarget }) {
  const { t } = useTranslation('editors');
  const { resolved, own } = target;
  return (
    <PropertySection
      title={t('properties.typography')}
      more={<TypographyMore target={target} />}
      moreLabel={t('properties.more')}
      lessLabel={t('properties.less')}
    >
      <ColourField
        label={t('properties.textColour')}
        value={own.textColour}
        fallback="#1a1a1a"
        onChange={(textColour) => {
          target.set({ textColour });
        }}
      />
      <div className={styles['pair']}>
        <NumberField
          label={t('properties.fontSize')}
          value={resolved.fontSize}
          min={6}
          step={1}
          digits={0}
          onCommit={(value) => {
            target.set({ fontSize: clamp(value, 6, 400) });
          }}
        />
        <Field label={t('properties.fontWeight')}>
          <Select
            size="sm"
            value={resolved.fontWeight}
            aria-label={t('properties.fontWeight')}
            options={FONT_WEIGHTS.map((value) => ({ value, label: t(`properties.weights.${value}`) }))}
            onValueChange={(value) => {
              target.set({ fontWeight: value as ItemStyle['fontWeight'] });
            }}
          />
        </Field>
      </div>
      <Mixed target={target} keys={['fontSize']} label={t('properties.fontSize')} />
      <div className={styles['pair']}>
        <Field label={t('properties.align')}>
          <ToggleGroup
            size="sm"
            iconsOnly
            value={resolved.align}
            aria-label={t('properties.align')}
            items={TEXT_ALIGNS.map((value) => ({
              value,
              label: t(`properties.aligns.${value}`),
              icon: ALIGN_ICONS[value],
            }))}
            onValueChange={(value) => {
              target.set({ align: value as ItemStyle['align'] });
            }}
          />
        </Field>
        <Field label={t('properties.verticalAlign')}>
          <ToggleGroup
            size="sm"
            iconsOnly
            value={resolved.verticalAlign}
            aria-label={t('properties.verticalAlign')}
            items={VERTICAL_ALIGNS.map((value) => ({
              value,
              label: t(`properties.verticalAligns.${value}`),
              icon: VERTICAL_ALIGN_ICONS[value],
            }))}
            onValueChange={(value) => {
              target.set({ verticalAlign: value as ItemStyle['verticalAlign'] });
            }}
          />
        </Field>
      </div>
    </PropertySection>
  );
}
