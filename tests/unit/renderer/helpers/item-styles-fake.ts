import { vi } from 'vitest';
import type { LoopyApi } from '@shared/ipc';
import {
  itemStylePresetInputSchema,
  itemStylePresetPatchSchema,
  type ItemStylePreset,
} from '@shared/item-styles';

type ItemStylesFakeApi = Pick<
  LoopyApi,
  'listItemStyles' | 'createItemStyle' | 'updateItemStyle' | 'deleteItemStyle'
>;

export function createItemStylesFake() {
  const data = { presets: [] as ItemStylePreset[], counter: 0 };
  const stamp = '2026-10-19T09:00:00.000Z';
  const sorted = () => structuredClone([...data.presets].sort((a, b) => a.name.localeCompare(b.name)));
  const api: ItemStylesFakeApi = {
    listItemStyles: vi.fn(() => Promise.resolve(sorted())),
    createItemStyle: vi.fn((raw: unknown) => {
      const input = itemStylePresetInputSchema.parse(raw);
      data.counter += 1;
      const preset: ItemStylePreset = {
        id: `style-${String(data.counter)}`,
        ...input,
        createdAt: stamp,
        updatedAt: stamp,
      };
      data.presets.push(preset);
      return Promise.resolve(structuredClone(preset));
    }),
    updateItemStyle: vi.fn((id: string, raw: unknown) => {
      const patch = itemStylePresetPatchSchema.parse(raw);
      const index = data.presets.findIndex((preset) => preset.id === id);
      const current = data.presets[index];
      if (!current) return Promise.reject(new Error(`Unknown item style ${id}`));
      const next = { ...current, name: patch.name ?? current.name, style: patch.style ?? current.style };
      data.presets[index] = next;
      return Promise.resolve(structuredClone(next));
    }),
    deleteItemStyle: vi.fn((id: string) => {
      data.presets = data.presets.filter((preset) => preset.id !== id);
      return Promise.resolve(sorted());
    }),
  };
  return { data, api };
}
