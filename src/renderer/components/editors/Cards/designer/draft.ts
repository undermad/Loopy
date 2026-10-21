import type { CardValue } from '@shared/board';
import { cardLayoutSchema, type CardLayout, type CardTemplate, type SavedCard } from '@shared/cards';

export type TemplateDraft = CardLayout & { name: string };

export type TargetKind = 'template' | 'card';

export interface Target {
  kind: TargetKind;
  id: string;
}

export interface Draft {
  kind: TargetKind;
  name: string;
  templateId: string | null;
  layout: CardLayout | null;
  values: Record<string, CardValue>;
}

export function layoutOf(source: CardLayout): CardLayout {
  return cardLayoutSchema.parse(structuredClone(source));
}

export function templateDraft(template: CardTemplate): Draft {
  return { kind: 'template', name: template.name, templateId: null, layout: layoutOf(template), values: {} };
}

export function cardDraft(card: SavedCard): Draft {
  return {
    kind: 'card',
    name: card.name,
    templateId: card.templateId,
    layout: card.templateId === null && card.layout ? layoutOf(card.layout) : null,
    values: structuredClone(card.values),
  };
}
