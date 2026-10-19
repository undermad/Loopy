import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { LoopyApi } from '@shared/ipc';
import type { ItemStylePreset, ItemStylePresetInput, ItemStylePresetPatch } from '@shared/item-styles';
import { subscribeCurrentProject } from '@renderer/lib/project';

export type ItemStylesApi = Pick<
  LoopyApi,
  'listItemStyles' | 'createItemStyle' | 'updateItemStyle' | 'deleteItemStyle'
>;

interface ItemStylesState {
  presets: ItemStylePreset[] | null;
  api: ItemStylesApi | null;
}

const stylesStore = createStore<ItemStylesState>(() => ({ presets: null, api: null }));

let loadToken = 0;

function requireApi(): ItemStylesApi {
  const { api } = stylesStore.getState();
  if (!api) throw new Error('Item styles are not loaded');
  return api;
}

export async function loadItemStyles(): Promise<ItemStylePreset[]> {
  loadToken += 1;
  const token = loadToken;
  const presets = await requireApi().listItemStyles();
  if (token === loadToken) stylesStore.setState({ presets });
  return presets;
}

export async function bootItemStyles(api: ItemStylesApi, hasProject: boolean): Promise<void> {
  stylesStore.setState({ api });
  if (hasProject) await loadItemStyles();
  subscribeCurrentProject((project) => {
    stylesStore.setState({ presets: null });
    if (project) void loadItemStyles();
  });
}

function sorted(presets: ItemStylePreset[]): ItemStylePreset[] {
  return [...presets].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function store(preset: ItemStylePreset): void {
  loadToken += 1;
  const list = stylesStore.getState().presets ?? [];
  stylesStore.setState({ presets: sorted([...list.filter((item) => item.id !== preset.id), preset]) });
}

export async function createItemStyle(input: ItemStylePresetInput): Promise<ItemStylePreset> {
  const preset = await requireApi().createItemStyle(input);
  store(preset);
  return preset;
}

export async function updateItemStyle(id: string, patch: ItemStylePresetPatch): Promise<ItemStylePreset> {
  const preset = await requireApi().updateItemStyle(id, patch);
  store(preset);
  return preset;
}

export async function deleteItemStyle(id: string): Promise<ItemStylePreset[]> {
  const presets = await requireApi().deleteItemStyle(id);
  loadToken += 1;
  stylesStore.setState({ presets });
  return presets;
}

export function resetItemStylesStore(): void {
  stylesStore.setState({ presets: null, api: null });
}

export function useItemStyles(): ItemStylePreset[] | null {
  return useStore(stylesStore, (state) => state.presets);
}
