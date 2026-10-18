import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface EditorProps {
  areaId: string;
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
}

export type EditorCategory = 'planning' | 'design' | 'palette' | 'assets' | 'general';

export interface EditorDefinition {
  id: string;
  titleKey: string;
  icon: LucideIcon;
  component: ComponentType<EditorProps>;
  category: EditorCategory;
  defaultState?: () => Record<string, unknown>;
}

const editors = new Map<string, EditorDefinition>();

export function registerEditor(definition: EditorDefinition): void {
  editors.set(definition.id, definition);
}

export function getEditor(id: string): EditorDefinition | undefined {
  return editors.get(id);
}

export function listEditors(): EditorDefinition[] {
  return [...editors.values()];
}
