import type { AssetFolder } from '@shared/assets';
import type { Note } from '@shared/notes';

export const BUILT_IN_TEMPLATES = [
  'blank',
  'character',
  'mechanic',
  'level',
  'enemy',
  'item',
  'meeting',
  'daily',
] as const;
export type BuiltInTemplate = (typeof BUILT_IN_TEMPLATES)[number];

export const TEMPLATES_FOLDER = 'templates';

export interface TemplateValues {
  title: string;
  date: string;
  time: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function isoDay(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function templateValues(title: string, date: Date): TemplateValues {
  return { title, date: isoDay(date), time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
}

export function applyTemplate(body: string, values: TemplateValues): string {
  return body.replace(/\{\{\s*(title|date|time)\s*\}\}/gi, (_match, key: string) => {
    const name = key.toLowerCase() as keyof TemplateValues;
    return values[name];
  });
}

export function isTemplateFolder(folders: AssetFolder[], folderId: string | null): boolean {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const seen = new Set<string>();
  let current = folderId;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    const folder = byId.get(current);
    if (!folder) return false;
    if (folder.name.trim().toLowerCase() === TEMPLATES_FOLDER) return true;
    current = folder.parentId;
  }
  return false;
}

export function userTemplates(notes: Note[], folders: AssetFolder[]): Note[] {
  return notes.filter((note) => isTemplateFolder(folders, note.folderId));
}
