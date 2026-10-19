import type { BoardNodeType } from '@shared/board';

export interface ItemKindDefinition {
  appearance: boolean;
  text: boolean;
  rotatable: boolean;
  resizable: boolean;
}

const BOX: ItemKindDefinition = { appearance: true, text: true, rotatable: true, resizable: true };

export const ITEM_KINDS: Record<BoardNodeType, ItemKindDefinition> = {
  text: BOX,
  image: { ...BOX, text: false },
  container: BOX,
  card: BOX,
  file: BOX,
  link: BOX,
  drawing: { appearance: false, text: false, rotatable: false, resizable: false },
};
