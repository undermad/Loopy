import { useEffect, useRef, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  BRUSH_GRAINS,
  BRUSH_PRESETS,
  BRUSH_TIPS,
  presetSettings,
  type BrushSettings,
  type BrushTool,
} from '@shared/brushes';
import {
  brushModified,
  chooseBrushPreset,
  drawPreview,
  resetBrush,
  setBrushColour,
  updateBrush,
  useBrushState,
} from '@renderer/lib/drawing';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { useResolvedColour } from '@renderer/lib/palettes';
import { Button, Field, ScrollArea, Select, ToggleGroup, cx } from '@renderer/ui';
import { ProjectColourPicker } from '../../ProjectColourPicker/ProjectColourPicker';
import { NumberField } from '../Properties/NumberField';
import styles from './BrushesEditor.module.scss';

const PRESET_SETTINGS = new Map(BRUSH_PRESETS.map((preset) => [preset.id, presetSettings(preset.id)]));

type PercentKey = 'hardness' | 'roundness' | 'smoothing' | 'opacity' | 'flow';
type DynamicKey = 'sizeJitter' | 'opacityJitter' | 'angleJitter' | 'scatter';

function readTool(state: Record<string, unknown>): BrushTool {
  return state['tool'] === 'eraser' ? 'eraser' : 'brush';
}

interface PreviewProps {
  settings: BrushSettings;
  colour: string;
  tool: BrushTool;
  label: string;
  className: string | undefined;
}

function Preview({ settings, colour, tool, label, className }: PreviewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const drawing = canvas.current?.getContext('2d');
    if (drawing) drawPreview(drawing, settings, colour, tool);
  }, [colour, settings, tool]);
  return <canvas ref={canvas} className={className} width={240} height={64} role="img" aria-label={label} />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles['section']} aria-label={title}>
      <h3 className={styles['heading']}>{title}</h3>
      {children}
    </section>
  );
}

export function BrushesEditor({ state, setState }: EditorProps) {
  const { t } = useTranslation('editors');
  const tool = readTool(state);
  const brushes = useBrushState();
  const current = brushes[tool];
  const { settings } = current;
  const colour = useResolvedColour(brushes.colour) ?? brushes.colour.hex;
  const previewColour = tool === 'eraser' ? '#64748b' : colour;
  const set = (patch: Partial<BrushSettings>) => {
    updateBrush(tool, patch);
  };
  const percent = (key: PercentKey, min = 0) => (
    <NumberField
      label={key === 'opacity' || key === 'flow' ? t(`drawing.${key}`) : t(`drawing.fields.${key}`)}
      value={Math.round(settings[key] * 100)}
      min={min}
      max={100}
      step={1}
      digits={0}
      onCommit={(value) => {
        set({ [key]: value / 100 });
      }}
    />
  );
  const dynamic = (key: DynamicKey, max = 100) => (
    <NumberField
      label={t(`drawing.fields.${key}`)}
      value={Math.round(settings[key].amount * 100)}
      min={0}
      max={max}
      step={1}
      digits={0}
      onCommit={(value) => {
        set({ [key]: { ...settings[key], amount: value / 100 } });
      }}
    />
  );
  const presetName = (id: string) => t(`drawing.presets.${id}` as 'drawing.presets.pen');

  return (
    <ScrollArea className={styles['scroll']}>
      <div className={styles['panel']}>
        <ToggleGroup
          size="sm"
          aria-label={t('drawing.tool')}
          value={tool}
          items={[
            { value: 'brush', label: t('board.tools.brush') },
            { value: 'eraser', label: t('board.tools.eraser') },
          ]}
          onValueChange={(value) => {
            setState({ tool: value });
          }}
        />
        <Preview
          className={styles['preview']}
          settings={settings}
          colour={previewColour}
          tool={tool}
          label={t('drawing.preview')}
        />
        <div className={styles['row']}>
          {tool === 'brush' ? (
            <ProjectColourPicker
              size="sm"
              label={t('drawing.colour')}
              value={brushes.colour}
              onChange={setBrushColour}
            />
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            disabled={!brushModified(current)}
            onClick={() => {
              resetBrush(tool);
            }}
          >
            <RotateCcw aria-hidden="true" />
            {t('drawing.reset')}
          </Button>
        </div>
        <Section title={t('drawing.sections.presets')}>
          <div className={styles['presets']}>
            {BRUSH_PRESETS.filter((preset) => preset.tool === tool).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={cx(styles['preset'], preset.id === current.preset && styles['active'])}
                aria-pressed={preset.id === current.preset}
                onClick={() => {
                  chooseBrushPreset(tool, preset.id);
                }}
              >
                <Preview
                  className={styles['thumb']}
                  settings={PRESET_SETTINGS.get(preset.id) ?? settings}
                  colour={previewColour}
                  tool={tool}
                  label={presetName(preset.id)}
                />
                <span>{presetName(preset.id)}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section title={t('drawing.sections.tip')}>
          <div className={styles['pair']}>
            <NumberField
              label={t('drawing.size')}
              value={settings.size}
              min={0.5}
              max={1000}
              step={1}
              digits={1}
              onCommit={(size) => {
                set({ size });
              }}
            />
            <Field label={t('drawing.fields.tip')}>
              <Select
                size="sm"
                value={settings.tip}
                aria-label={t('drawing.fields.tip')}
                options={BRUSH_TIPS.map((value) => ({ value, label: t(`drawing.tips.${value}`) }))}
                onValueChange={(value) => {
                  set({ tip: value === 'square' ? 'square' : 'round' });
                }}
              />
            </Field>
            {percent('hardness')}
            {percent('roundness', 5)}
            <NumberField
              label={t('drawing.fields.angle')}
              value={settings.angle}
              min={0}
              max={360}
              step={1}
              digits={0}
              onCommit={(angle) => {
                set({ angle });
              }}
            />
            <NumberField
              label={t('drawing.fields.spacing')}
              value={Math.round(settings.spacing * 100)}
              min={1}
              max={200}
              step={1}
              digits={0}
              onCommit={(value) => {
                set({ spacing: value / 100 });
              }}
            />
          </div>
        </Section>
        <Section title={t('drawing.sections.stroke')}>
          <div className={styles['pair']}>
            {percent('opacity')}
            {percent('flow', 1)}
            {percent('smoothing')}
          </div>
        </Section>
        <Section title={t('drawing.sections.dynamics')}>
          <div className={styles['pair']}>
            {dynamic('sizeJitter')}
            {dynamic('opacityJitter')}
            {dynamic('angleJitter')}
            {dynamic('scatter', 500)}
            <NumberField
              label={t('drawing.fields.count')}
              value={settings.count}
              min={1}
              max={16}
              step={1}
              digits={0}
              onCommit={(count) => {
                set({ count: Math.round(count) });
              }}
            />
          </div>
        </Section>
        <Section title={t('drawing.sections.texture')}>
          <div className={styles['pair']}>
            <Field label={t('drawing.fields.grain')}>
              <Select
                size="sm"
                value={settings.grain}
                aria-label={t('drawing.fields.grain')}
                options={BRUSH_GRAINS.map((value) => ({ value, label: t(`drawing.grains.${value}`) }))}
                onValueChange={(value) => {
                  const grain = BRUSH_GRAINS.find((candidate) => candidate === value);
                  if (grain) set({ grain });
                }}
              />
            </Field>
            <NumberField
              label={t('drawing.fields.grainScale')}
              value={settings.grainScale}
              min={0.1}
              max={4}
              step={0.1}
              digits={1}
              disabled={settings.grain === 'none'}
              onCommit={(grainScale) => {
                set({ grainScale });
              }}
            />
            <NumberField
              label={t('drawing.fields.grainDepth')}
              value={Math.round(settings.grainDepth * 100)}
              min={0}
              max={100}
              step={1}
              digits={0}
              disabled={settings.grain === 'none'}
              onCommit={(value) => {
                set({ grainDepth: value / 100 });
              }}
            />
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
}
