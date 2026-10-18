import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import {
  brushSettingsSchema,
  brushStateSchema,
  findBrushPreset,
  presetSettings,
  type BrushSettings,
  type BrushState,
  type BrushTool,
} from '@shared/brushes';
import type { ColourValue } from '@shared/colours';
import { currentSettings, updateSettings, useSettings } from '@renderer/lib/settings';

const SAVE_DELAY = 300;

const pendingStore = createStore<{ pending: BrushState | null }>(() => ({ pending: null }));
let timer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  timer = null;
  const { pending } = pendingStore.getState();
  if (!pending) return;
  void updateSettings({ brushes: pending })
    .catch(() => undefined)
    .finally(() => {
      if (pendingStore.getState().pending === pending) pendingStore.setState({ pending: null });
    });
}

function change(update: (current: BrushState) => BrushState): void {
  const current = getBrushState();
  pendingStore.setState({ pending: update(current) });
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, SAVE_DELAY);
}

export function getBrushState(): BrushState {
  return pendingStore.getState().pending ?? currentSettings()?.brushes ?? brushStateSchema.parse({});
}

export function useBrushState(): BrushState {
  const saved = useSettings().brushes;
  const pending = useStore(pendingStore, (state) => state.pending);
  return pending ?? saved;
}

export function setBrushColour(colour: ColourValue): void {
  change((current) => ({ ...current, colour }));
}

export function updateBrush(tool: BrushTool, patch: Partial<BrushSettings>): void {
  change((current) => ({
    ...current,
    [tool]: {
      ...current[tool],
      settings: brushSettingsSchema.parse({ ...current[tool].settings, ...patch }),
    },
  }));
}

export function chooseBrushPreset(tool: BrushTool, presetId: string): void {
  if (findBrushPreset(presetId)?.tool !== tool) return;
  change((current) => ({ ...current, [tool]: { preset: presetId, settings: presetSettings(presetId) } }));
}

export function resetBrush(tool: BrushTool): void {
  change((current) => ({
    ...current,
    [tool]: { ...current[tool], settings: presetSettings(current[tool].preset) },
  }));
}

export function brushModified(state: BrushState[BrushTool]): boolean {
  return JSON.stringify(presetSettings(state.preset)) !== JSON.stringify(state.settings);
}

export function resetBrushStore(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  pendingStore.setState({ pending: null });
}
