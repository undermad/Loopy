import { vi } from 'vitest';
import {
  cardLayoutSchema,
  cardTemplateInputSchema,
  cardTemplatePatchSchema,
  savedCardInputSchema,
  savedCardPatchSchema,
  type CardLayout,
  type CardTemplate,
  type SavedCard,
} from '@shared/cards';
import type { LoopyApi } from '@shared/ipc';

export type CardsFakeApi = Pick<
  LoopyApi,
  | 'listCardTemplates'
  | 'createCardTemplate'
  | 'updateCardTemplate'
  | 'deleteCardTemplate'
  | 'listCards'
  | 'createCard'
  | 'updateCard'
  | 'deleteCard'
>;

function layoutOf(template: CardTemplate): CardLayout {
  return cardLayoutSchema.parse(structuredClone(template));
}

export function createCardsFake() {
  const data = { templates: [] as CardTemplate[], cards: [] as SavedCard[], counter: 0 };
  const stamp = '2026-10-17T09:00:00.000Z';
  const template = (id: string) => {
    const found = data.templates.find((item) => item.id === id);
    if (!found) throw new Error(`Unknown card template ${id}`);
    return found;
  };
  const api: CardsFakeApi = {
    listCardTemplates: vi.fn(() => Promise.resolve(structuredClone(data.templates))),
    createCardTemplate: vi.fn((raw: unknown) => {
      const input = cardTemplateInputSchema.parse(raw);
      data.counter += 1;
      const created: CardTemplate = {
        ...input,
        id: `template-${String(data.counter)}`,
        createdAt: stamp,
        updatedAt: stamp,
      };
      data.templates.push(created);
      return Promise.resolve(structuredClone(created));
    }),
    updateCardTemplate: vi.fn((id: string, raw: unknown) => {
      const patch = cardTemplatePatchSchema.parse(raw);
      const current = template(id);
      const next = cardTemplateInputSchema.parse({ ...current, ...patch });
      const updated: CardTemplate = { ...current, ...next };
      data.templates = data.templates.map((item) => (item.id === id ? updated : item));
      return Promise.resolve(structuredClone(updated));
    }),
    deleteCardTemplate: vi.fn((id: string) => {
      const removed = data.templates.find((item) => item.id === id);
      if (removed) {
        data.cards = data.cards.map((card) =>
          card.templateId === id ? { ...card, templateId: null, layout: layoutOf(removed) } : card,
        );
      }
      data.templates = data.templates.filter((item) => item.id !== id);
      return Promise.resolve(structuredClone(data.templates));
    }),
    listCards: vi.fn(() => Promise.resolve(structuredClone(data.cards))),
    createCard: vi.fn((raw: unknown) => {
      const input = savedCardInputSchema.parse(raw);
      if (input.templateId !== null) template(input.templateId);
      data.counter += 1;
      const card: SavedCard = {
        ...input,
        layout: input.templateId === null ? (input.layout ?? cardLayoutSchema.parse({})) : null,
        id: `card-${String(data.counter)}`,
        createdAt: stamp,
        updatedAt: stamp,
      };
      data.cards.push(card);
      return Promise.resolve(structuredClone(card));
    }),
    updateCard: vi.fn((id: string, raw: unknown) => {
      const patch = savedCardPatchSchema.parse(raw);
      const current = data.cards.find((item) => item.id === id);
      if (!current) throw new Error(`Unknown card ${id}`);
      const templateId = patch.templateId === undefined ? current.templateId : patch.templateId;
      const layout =
        templateId !== null
          ? null
          : (patch.layout ??
            (current.templateId !== null ? layoutOf(template(current.templateId)) : current.layout));
      const card: SavedCard = {
        ...current,
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.folderId === undefined ? {} : { folderId: patch.folderId }),
        ...(patch.values === undefined ? {} : { values: patch.values }),
        templateId,
        layout,
      };
      data.cards = data.cards.map((item) => (item.id === id ? card : item));
      return Promise.resolve(structuredClone(card));
    }),
    deleteCard: vi.fn((id: string) => {
      data.cards = data.cards.filter((item) => item.id !== id);
      return Promise.resolve(structuredClone(data.cards));
    }),
  };
  return { api, data };
}
