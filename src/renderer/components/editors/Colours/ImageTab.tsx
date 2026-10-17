import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { Copy, ImagePlus, Save, Trash2, Upload } from 'lucide-react';
import { assetUrl } from '@shared/assets';
import type { Palette } from '@shared/colours';
import { importFiles, pickFiles, useAssetsSnapshot } from '@renderer/lib/assets';
import {
  MOODS,
  extractGradient,
  extractPalette,
  fetchImage,
  gradientCss,
  loadImage,
  markersFor,
  readableTextColour,
  sampleAt,
  type Marker,
  type Mood,
  type Pixels,
} from '@renderer/lib/colour';
import { useTranslation } from '@renderer/lib/i18n';
import { createPalette, updatePalette } from '@renderer/lib/palettes';
import { Button, DropdownMenu, Spinner, ToggleGroup, cx, useToast } from '@renderer/ui';
import { PromptDialog } from '../../Shell/PromptDialog';
import editorStyles from './ColoursEditor.module.scss';
import styles from './ImageTab.module.scss';

export interface ImageTabProps {
  palette: Palette | null;
  onSaved: (paletteId: string) => void;
}

interface LoadedImage {
  preview: ImageBitmap;
  pixels: Pixels;
  name: string;
}

type Mode = 'theme' | 'gradient';
type MoodChoice = Mood | 'custom';

const COLOUR_COUNT = 5;

export function ImageTab({ palette, onSaved }: ImageTabProps) {
  const { t } = useTranslation('colours');
  const toast = useToast();
  const assets = useAssetsSnapshot();
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<Mode>('theme');
  const [mood, setMood] = useState<MoodChoice>('colourful');
  const [stops, setStops] = useState(4);
  const [custom, setCustom] = useState<{ colours: string[]; markers: Marker[] } | null>(null);
  const [naming, setNaming] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const dragIndex = useRef<number | null>(null);
  const images = assets.assets.filter((asset) => asset.kind === 'image');

  const derived = useMemo(() => {
    if (!image) return { colours: [], markers: [] };
    if (mode === 'gradient') return { colours: extractGradient(image.pixels, stops), markers: [] };
    const extracted = extractPalette(image.pixels, mood === 'custom' ? 'colourful' : mood, COLOUR_COUNT);
    return { colours: extracted, markers: markersFor(image.pixels, extracted) };
  }, [image, mode, mood, stops]);
  const current = mode === 'theme' && mood === 'custom' && custom ? custom : derived;
  const colours = current.colours;
  const markers = current.markers;

  useEffect(
    () => () => {
      image?.preview.close();
    },
    [image],
  );

  async function load(work: () => Promise<LoadedImage>) {
    setBusy(true);
    try {
      const loaded = await work();
      setMood('colourful');
      setCustom(null);
      setImage(loaded);
    } catch {
      toast.show({ title: t('image.loadFailed'), variant: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  function loadFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.show({ title: t('image.unsupported'), variant: 'danger' });
      return;
    }
    void load(async () => {
      const decoded = await loadImage(file);
      const outcome = await importFiles([file], 'auto');
      if (outcome.ids.length > 0) toast.show({ title: t('image.assetAdded'), variant: 'success' });
      return { ...decoded, name: file.name };
    });
  }

  function loadAsset(id: string, name: string) {
    void load(async () => ({ ...(await fetchImage(assetUrl(id))), name }));
  }

  async function browse() {
    const ids = await pickFiles('auto');
    const id = ids[0];
    if (!id) return;
    const asset = assets.assets.find((item) => item.id === id);
    loadAsset(id, asset?.name ?? id);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) loadFile(file);
  }

  function moveMarker(index: number, event: PointerEvent) {
    const rect = preview.current?.getBoundingClientRect();
    if (!rect || !image || rect.width === 0 || rect.height === 0) return;
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    const hex = sampleAt(image.pixels, x * (image.pixels.width - 1), y * (image.pixels.height - 1));
    const base = mood === 'custom' && custom ? custom : derived;
    setMood('custom');
    setCustom({
      markers: base.markers.map((marker, position) => (position === index ? { x, y } : marker)),
      colours: base.colours.map((colour, position) => (position === index ? hex : colour)),
    });
  }

  async function saveAs(name: string) {
    const created = await createPalette({
      name,
      harmony: 'custom',
      source: 'image',
      colours: colours.map((hex) => ({ hex })),
    });
    onSaved(created.id);
  }

  async function applyTo(target: Palette) {
    await updatePalette(target.id, {
      harmony: 'custom',
      colours: colours.map((hex, index) => {
        const existing = target.colours[index];
        return existing ? { id: existing.id, name: existing.name, hex } : { hex };
      }),
    });
    onSaved(target.id);
  }

  const css = gradientCss(colours);

  return (
    <div className={editorStyles['tab']}>
      <div className={editorStyles['toolbar']}>
        <ToggleGroup
          size="sm"
          aria-label={t('image.mode')}
          value={mode}
          onValueChange={(next) => {
            setMode(next as Mode);
          }}
          items={[
            { value: 'theme', label: t('image.modes.theme') },
            { value: 'gradient', label: t('image.modes.gradient') },
          ]}
        />
        <Button size="sm" icon={<Upload aria-hidden="true" />} onClick={() => void browse()}>
          {t('image.browse')}
        </Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button size="sm" icon={<ImagePlus aria-hidden="true" />}>
              {t('image.fromAssets')}
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start">
            {images.length === 0 ? (
              <DropdownMenu.Item disabled>{t('image.noAssets')}</DropdownMenu.Item>
            ) : null}
            {images.map((asset) => (
              <DropdownMenu.Item
                key={asset.id}
                onSelect={() => {
                  loadAsset(asset.id, asset.name);
                }}
              >
                {asset.name}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        {image ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 aria-hidden="true" />}
            onClick={() => {
              setImage(null);
              setCustom(null);
            }}
          >
            {t('image.clear')}
          </Button>
        ) : null}
      </div>
      <div
        className={cx(styles['drop'], dragging && styles['dragging'], image && styles['filled'])}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={onDrop}
        data-testid="image-drop"
      >
        {busy ? (
          <Spinner label={t('image.extracting')} />
        ) : image ? (
          <div ref={preview} className={styles['preview']}>
            <PreviewCanvas bitmap={image.preview} label={t('image.preview')} />
            {mode === 'theme'
              ? markers.map((marker, index) => (
                  <button
                    key={String(index)}
                    type="button"
                    className={styles['marker']}
                    aria-label={t('image.marker', { index: index + 1 })}
                    style={{
                      left: `${String(marker.x * 100)}%`,
                      top: `${String(marker.y * 100)}%`,
                      background: colours[index] ?? '#000',
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      dragIndex.current = index;
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      if (dragIndex.current === index) moveMarker(index, event);
                    }}
                    onPointerUp={(event) => {
                      dragIndex.current = null;
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }}
                  />
                ))
              : null}
          </div>
        ) : (
          <label className={styles['placeholder']}>
            <ImagePlus aria-hidden="true" />
            <span>{t('image.drop')}</span>
            <span className={editorStyles['muted']}>{t('image.dropHint')}</span>
            <input
              type="file"
              accept="image/*"
              aria-label={t('image.browse')}
              className={styles['fileInput']}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) loadFile(file);
                event.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      {image && mode === 'theme' ? (
        <div className={editorStyles['toolbar']}>
          <ToggleGroup
            size="sm"
            aria-label={t('image.mood')}
            value={mood}
            onValueChange={(next) => {
              setMood(next as MoodChoice);
            }}
            items={[...MOODS, 'custom' as const].map((value) => ({
              value,
              label: t(`image.moods.${value}`),
            }))}
          />
          <span className={editorStyles['muted']}>{t('image.markerHint')}</span>
        </div>
      ) : null}
      {image && mode === 'gradient' ? (
        <label className={styles['stops']}>
          <span>
            {t('image.stops')}: {stops}
          </span>
          <input
            type="range"
            min={2}
            max={10}
            value={stops}
            aria-label={t('image.stops')}
            onChange={(event) => {
              setStops(Number(event.target.value));
            }}
          />
        </label>
      ) : null}
      {colours.length > 0 ? (
        <>
          {mode === 'gradient' ? (
            <div
              className={styles['gradient']}
              style={{ background: css }}
              aria-label={t('image.gradientCss')}
            />
          ) : null}
          <div className={styles['swatches']} role="list" aria-label={t('image.modes.theme')}>
            {colours.map((hex, index) => (
              <div
                key={`${hex}-${String(index)}`}
                role="listitem"
                className={styles['swatch']}
                style={{ background: hex, color: readableTextColour(hex) }}
              >
                {hex}
              </div>
            ))}
          </div>
          <div className={editorStyles['toolbar']}>
            <Button
              size="sm"
              variant="primary"
              icon={<Save aria-hidden="true" />}
              onClick={() => {
                setNaming(true);
              }}
            >
              {t('image.saveAs')}
            </Button>
            {palette ? (
              <Button size="sm" onClick={() => void applyTo(palette)}>
                {t('image.applyTo', { name: palette.name })}
              </Button>
            ) : null}
            {mode === 'gradient' ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy aria-hidden="true" />}
                onClick={() => {
                  void navigator.clipboard.writeText(css);
                  toast.show({ title: t('wheel.copied', { hex: css }) });
                }}
              >
                {t('image.copyCss')}
              </Button>
            ) : null}
          </div>
          {mode === 'gradient' ? <code className={styles['css']}>{css}</code> : null}
        </>
      ) : null}
      {naming ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setNaming(false);
          }}
          title={t('image.saveAs')}
          label={t('library.name')}
          initialValue={image?.name.replace(/\.[^.]+$/, '') ?? ''}
          submitLabel={t('image.saveAs')}
          onSubmit={saveAs}
        />
      ) : null}
    </div>
  );
}

function PreviewCanvas({ bitmap, label }: { bitmap: ImageBitmap; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    context.clearRect(0, 0, element.width, element.height);
    context.drawImage(bitmap, 0, 0);
  }, [bitmap]);

  return <canvas ref={canvas} width={bitmap.width} height={bitmap.height} role="img" aria-label={label} />;
}
