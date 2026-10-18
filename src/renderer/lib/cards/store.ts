import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { CardTemplate, CardTemplateInput, CardTemplatePatch } from '@shared/cards';
import type { LoopyApi } from '@shared/ipc';
import { subscribeCurrentProject } from '@renderer/lib/project';

export type CardTemplatesApi = Pick<
  LoopyApi,
  'listCardTemplates' | 'createCardTemplate' | 'updateCardTemplate' | 'deleteCardTemplate'
>;

interface CardTemplatesState {
  templates: CardTemplate[] | null;
  api: CardTemplatesApi | null;
}

const templatesStore = createStore<CardTemplatesState>(() => ({ templates: null, api: null }));

function requireApi(): CardTemplatesApi {
  const { api } = templatesStore.getState();
  if (!api) throw new Error('Card templates are not loaded');
  return api;
}

let loadToken = 0;

export async function loadCardTemplates(): Promise<CardTemplate[]> {
  loadToken += 1;
  const token = loadToken;
  const templates = await requireApi().listCardTemplates();
  if (token === loadToken) templatesStore.setState({ templates });
  return templates;
}

export async function bootCardTemplates(api: CardTemplatesApi, hasProject: boolean): Promise<void> {
  templatesStore.setState({ api });
  if (hasProject) await loadCardTemplates();
  subscribeCurrentProject((project) => {
    templatesStore.setState({ templates: null });
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

export function resetCardTemplatesStore(): void {
  templatesStore.setState({ templates: null, api: null });
}

export function useCardTemplates(): CardTemplate[] | null {
  return useStore(templatesStore, (state) => state.templates);
}

export function useCardTemplate(id: string | null): CardTemplate | null {
  return useStore(templatesStore, (state) =>
    id ? (state.templates?.find((item) => item.id === id) ?? null) : null,
  );
}
