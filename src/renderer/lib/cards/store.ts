import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { CardValue } from '@shared/board';
import type {
  CardLayout,
  CardTemplate,
  CardTemplateInput,
  CardTemplatePatch,
  SavedCard,
  SavedCardInput,
  SavedCardPatch,
} from '@shared/cards';
import type { LoopyApi } from '@shared/ipc';
import { subscribeCurrentProject } from '@renderer/lib/project';

export type CardTemplatesApi = Pick<
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

interface CardTemplatesState {
  templates: CardTemplate[] | null;
  cards: SavedCard[] | null;
  api: CardTemplatesApi | null;
}

const templatesStore = createStore<CardTemplatesState>(() => ({ templates: null, cards: null, api: null }));

function requireApi(): CardTemplatesApi {
  const { api } = templatesStore.getState();
  if (!api) throw new Error('Card templates are not loaded');
  return api;
}

let loadToken = 0;
let cardsToken = 0;

export async function loadSavedCards(): Promise<SavedCard[]> {
  cardsToken += 1;
  const token = cardsToken;
  const cards = await requireApi().listCards();
  if (token === cardsToken) templatesStore.setState({ cards });
  return cards;
}

export async function loadCardTemplates(): Promise<CardTemplate[]> {
  loadToken += 1;
  const token = loadToken;
  const [templates] = await Promise.all([requireApi().listCardTemplates(), loadSavedCards()]);
  if (token === loadToken) templatesStore.setState({ templates });
  return templates;
}

export async function bootCardTemplates(api: CardTemplatesApi, hasProject: boolean): Promise<void> {
  templatesStore.setState({ api });
  if (hasProject) await loadCardTemplates();
  subscribeCurrentProject((project) => {
    templatesStore.setState({ templates: null, cards: null });
    if (project) void loadCardTemplates();
  });
}

function store(template: CardTemplate): void {
  loadToken += 1;
  const list = templatesStore.getState().templates ?? [];
  const exists = list.some((item) => item.id === template.id);
  templatesStore.setState({
    templates: exists ? list.map((item) => (item.id === template.id ? template : item)) : [...list, template],
  });
}

function storeCard(card: SavedCard): void {
  cardsToken += 1;
  const list = templatesStore.getState().cards ?? [];
  const exists = list.some((item) => item.id === card.id);
  templatesStore.setState({
    cards: exists ? list.map((item) => (item.id === card.id ? card : item)) : [...list, card],
  });
}

export async function createCardTemplate(input: CardTemplateInput): Promise<CardTemplate> {
  const template = await requireApi().createCardTemplate(input);
  store(template);
  return template;
}

export async function updateCardTemplate(id: string, patch: CardTemplatePatch): Promise<CardTemplate> {
  const template = await requireApi().updateCardTemplate(id, patch);
  store(template);
  return template;
}

export async function deleteCardTemplate(id: string): Promise<CardTemplate[]> {
  const templates = await requireApi().deleteCardTemplate(id);
  loadToken += 1;
  templatesStore.setState({ templates });
  await loadSavedCards();
  return templates;
}

export async function duplicateCardTemplate(id: string, name: string): Promise<CardTemplate | null> {
  const source = templatesStore.getState().templates?.find((item) => item.id === id);
  if (!source) return null;
  const { id: _id, createdAt: _created, updatedAt: _updated, ...layout } = source;
  return createCardTemplate({ ...structuredClone(layout), name });
}

export function findCardTemplate(id: string | null): CardTemplate | null {
  if (!id) return null;
  return templatesStore.getState().templates?.find((item) => item.id === id) ?? null;
}

export async function createSavedCard(input: SavedCardInput): Promise<SavedCard> {
  const card = await requireApi().createCard(input);
  storeCard(card);
  return card;
}

export async function updateSavedCard(id: string, patch: SavedCardPatch): Promise<SavedCard> {
  const card = await requireApi().updateCard(id, patch);
  storeCard(card);
  return card;
}

export async function deleteSavedCard(id: string): Promise<SavedCard[]> {
  const cards = await requireApi().deleteCard(id);
  cardsToken += 1;
  templatesStore.setState({ cards });
  return cards;
}

export async function duplicateSavedCard(id: string, name: string): Promise<SavedCard | null> {
  const source = findSavedCard(id);
  if (!source) return null;
  const { folderId, templateId, layout, values } = structuredClone(source);
  return createSavedCard({ name, folderId, templateId, layout, values });
}

export function findSavedCard(id: string | null): SavedCard | null {
  if (!id) return null;
  return templatesStore.getState().cards?.find((item) => item.id === id) ?? null;
}

export function resolveCardLayout(
  card: Pick<SavedCard, 'templateId' | 'layout'>,
  templates: readonly CardTemplate[] | null,
): CardLayout | null {
  if (card.templateId === null) return card.layout;
  return templates?.find((item) => item.id === card.templateId) ?? null;
}

export function resetCardTemplatesStore(): void {
  templatesStore.setState({ templates: null, cards: null, api: null });
}

export function useCardTemplates(): CardTemplate[] | null {
  return useStore(templatesStore, (state) => state.templates);
}

export function useCardTemplate(id: string | null): CardTemplate | null {
  return useStore(templatesStore, (state) =>
    id ? (state.templates?.find((item) => item.id === id) ?? null) : null,
  );
}

export function useSavedCards(): SavedCard[] | null {
  return useStore(templatesStore, (state) => state.cards);
}

export function useSavedCard(id: string | null): SavedCard | null {
  return useStore(templatesStore, (state) =>
    id ? (state.cards?.find((item) => item.id === id) ?? null) : null,
  );
}

interface BoardCard {
  card: SavedCard | null;
  layout: CardLayout | null;
  values: Record<string, CardValue>;
}

export function useBoardCard(data: {
  cardId: string | null;
  templateId: string | null;
  values: Record<string, CardValue>;
}): BoardCard {
  const card = useSavedCard(data.cardId);
  const templates = useCardTemplates();
  if (card) return { card, layout: resolveCardLayout(card, templates), values: card.values };
  return {
    card: null,
    layout: resolveCardLayout({ templateId: data.templateId ?? '', layout: null }, templates),
    values: data.values,
  };
}
