import { useEffect, useRef } from 'react';
import { Aperture, Compass, Contrast, Image, PanelLeft, Palette as PaletteIcon } from 'lucide-react';
import type { Palette } from '@shared/colours';
import { randomHarmonyColours } from '@renderer/lib/colour';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import {
  NEW_PALETTE_KEY,
  createPalette,
  draftFromPalette,
  draftToInput,
  newDraft,
  paletteView,
  patchDraft,
  removeDraft,
  setDraft,
  updatePalette,
  useDrafts,
  usePalettes,
} from '@renderer/lib/palettes';
import { EmptyState, IconButton, Spinner, ToggleGroup } from '@renderer/ui';
import { AreaHeaderContent } from '../../Shell/AreaHeaderContent';
import { ContrastTab } from './ContrastTab';
import { ExploreTab } from './ExploreTab';
import { ImageTab } from './ImageTab';
import { PaletteList, type PaletteListItem } from './PaletteList';
import { WheelTab, type WheelDraftPatch } from './WheelTab';
import styles from './ColoursEditor.module.scss';

export type ColoursTab = 'wheel' | 'image' | 'contrast' | 'explore';

const TABS: ColoursTab[] = ['wheel', 'image', 'contrast', 'explore'];

function readTab(state: Record<string, unknown>): ColoursTab {
  const raw = state['tab'];
  return TABS.find((tab) => tab === raw) ?? 'wheel';
}

export function ColoursEditor({ state, setState }: EditorProps) {
  const { t } = useTranslation('colours');
  const palettes = usePalettes();
  const tab = readTab(state);
  const library = state['library'] !== false;
  const drafts = useDrafts();
  const requested = typeof state['paletteId'] === 'string' ? state['paletteId'] : null;
  const newItem = drafts[NEW_PALETTE_KEY];
  const items: PaletteListItem[] = [
    ...(newItem
      ? [{ palette: { ...paletteView(newItem, null), name: newItem.name }, unsaved: true, isNew: true }]
      : []),
    ...(palettes ?? []).map((palette) => {
      const draft = drafts[palette.id];
      return {
        palette: draft ? { ...paletteView(draft, palette), name: draft.name } : palette,
        unsaved: Boolean(draft),
        isNew: false,
      };
    }),
  ];
  const selected = items.find((item) => item.palette.id === requested) ?? items[0] ?? null;
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const id = selected?.palette.id ?? null;
    if (id !== requested && id !== previous.current) setState({ paletteId: id });
    previous.current = id;
  }, [selected, requested, setState]);

  function startNew() {
    const draft = newDraft(
      t('library.defaultName', { number: (palettes?.length ?? 0) + 1 }),
      randomHarmonyColours('analogous'),
    );
    setDraft(NEW_PALETTE_KEY, draft);
    setState({ paletteId: NEW_PALETTE_KEY, tab: 'wheel' });
  }

  function modify(palette: Palette) {
    setDraft(palette.id, draftFromPalette(palette));
  }

  function change(key: string, patch: WheelDraftPatch) {
    patchDraft(key, patch);
  }

  function discard(key: string) {
    removeDraft(key);
    if (key === NEW_PALETTE_KEY) setState({ paletteId: palettes?.[0]?.id ?? null });
  }

  async function save(key: string) {
    const draft = drafts[key];
    if (!draft) return;
    const saved = draft.id
      ? await updatePalette(draft.id, draftToInput(draft))
      : await createPalette(draftToInput(draft));
    removeDraft(key);
    setState({ paletteId: saved.id });
  }

  if (palettes === null) {
    return (
      <div className={styles['loading']}>
        <Spinner label={t('library.loading')} />
      </div>
    );
  }

  const selectedKey = selected ? (selected.isNew ? NEW_PALETTE_KEY : selected.palette.id) : null;
  const storedSelected =
    selected && !selected.isNew ? (palettes.find((p) => p.id === selected.palette.id) ?? null) : null;

  return (
    <div className={styles['editor']}>
      <AreaHeaderContent>
        <ToggleGroup
          size="sm"
          aria-label={t('tabs.label')}
          value={tab}
          onValueChange={(next) => {
            setState({ tab: next });
          }}
          items={[
            { value: 'wheel', label: t('tabs.wheel'), icon: <Aperture aria-hidden="true" /> },
            { value: 'image', label: t('tabs.image'), icon: <Image aria-hidden="true" /> },
            { value: 'contrast', label: t('tabs.contrast'), icon: <Contrast aria-hidden="true" /> },
            { value: 'explore', label: t('tabs.explore'), icon: <Compass aria-hidden="true" /> },
          ]}
        />
        <IconButton
          label={t('library.title')}
          size="sm"
          active={library}
          onClick={() => {
            setState({ library: !library });
          }}
        >
          <PanelLeft aria-hidden="true" />
        </IconButton>
      </AreaHeaderContent>
      <div className={styles['body']}>
        {library ? (
          <aside className={styles['sidebar']} aria-label={t('library.title')}>
            <PaletteList
              items={items}
              selectedId={selected?.palette.id ?? null}
              onSelect={(paletteId) => {
                setState({ paletteId, tab: tab === 'explore' ? 'wheel' : tab });
              }}
              onNew={startNew}
              onDiscardNew={() => {
                discard(NEW_PALETTE_KEY);
              }}
            />
          </aside>
        ) : null}
        <main className={styles['main']}>
          {tab === 'wheel' ? (
            selected && selectedKey ? (
              <WheelTab
                key={selectedKey}
                palette={selected.palette}
                editing={selected.unsaved}
                isNew={selected.isNew}
                onChange={(patch) => {
                  change(selectedKey, patch);
                }}
                onModify={() => {
                  if (storedSelected) modify(storedSelected);
                }}
                onSave={() => void save(selectedKey)}
                onCancel={() => {
                  discard(selectedKey);
                }}
              />
            ) : (
              <EmptyState
                icon={<PaletteIcon />}
                title={t('wheel.noPalette')}
                description={t('wheel.noPaletteHint')}
              />
            )
          ) : null}
          {tab === 'image' ? (
            <ImageTab
              palette={storedSelected}
              onSaved={(paletteId) => {
                setState({ paletteId, tab: 'wheel' });
              }}
            />
          ) : null}
          {tab === 'contrast' ? <ContrastTab state={state} setState={setState} /> : null}
          {tab === 'explore' ? (
            <ExploreTab
              onAdded={(paletteId) => {
                setState({ paletteId, tab: 'wheel' });
              }}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
