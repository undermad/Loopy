import { vi } from 'vitest';
import { cardTemplateInputSchema, cardTemplatePatchSchema, type CardTemplate } from '@shared/cards';
import type { LoopyApi } from '@shared/ipc';

export type CardsFakeApi = Pick<
  LoopyApi,
  'listCardTemplates' | 'createCardTemplate' | 'updateCardTemplate' | 'deleteCardTemplate'
>;

export function createCardsFake() {
  const data = { templates: [] as CardTemplate[], counter: 0 };
  const stamp = '2026-10-17T09:00:00.000Z';
  const api: CardsFakeApi = {
    listCardTemplates: vi.fn(() => Promise.resolve(structuredClone(data.templates))),
    createCardTemplate: vi.fn((raw: unknown) => {
      const input = cardTemplateInputSchema.parse(raw);
      data.counter += 1;
      const template: CardTemplate = {
        ...input,
        id: `template-${String(data.counter)}`,
        createdAt: stamp,
        updatedAt: stamp,
      };
      data.templates.push(template);
      return Promise.resolve(structuredClone(template));
    }),
    updateCardTemplate: vi.fn((id: string, raw: unknown) => {
      const patch = cardTemplatePatchSchema.parse(raw);
      const current = data.templates.find((item) => item.id === id);
      if (!current) throw new Error(`Unknown card template ${id}`);
      const next = cardTemplateInputSchema.parse({ ...current, ...patch });
      const template: CardTemplate = { ...current, ...next };
      data.templates = data.templates.map((item) => (item.id === id ? template : item));
      return Promise.resolve(structuredClone(template));
    }),
    deleteCardTemplate: vi.fn((id: string) => {
      data.templates = data.templates.filter((item) => item.id !== id);
      return Promise.resolve(structuredClone(data.templates));
    }),
  };
  return { api, data };
}
