import type { TFunction } from 'i18next';
import type { AssetFolder } from '@shared/assets';
import type { Note } from '@shared/notes';
import {
  BUILT_IN_TEMPLATES,
  applyTemplate,
  createNote,
  isoDay,
  nextNoteTitle,
  templateValues,
  userTemplates,
  type BuiltInTemplate,
} from '@renderer/lib/notes';

export type TemplateChoice = { kind: 'builtIn'; id: BuiltInTemplate } | { kind: 'note'; note: Note };

export interface TemplateOption {
  key: string;
  label: string;
  choice: TemplateChoice;
}

export function templateOptions(
  t: TFunction<'notes'>,
  notes: Note[],
  folders: AssetFolder[],
): TemplateOption[] {
  return [
    ...BUILT_IN_TEMPLATES.map((id) => ({
      key: `builtIn:${id}`,
      label: t(`templates.${id}.name`),
      choice: { kind: 'builtIn', id } as const,
    })),
    ...userTemplates(notes, folders).map((note) => ({
      key: `note:${note.id}`,
      label: note.title,
      choice: { kind: 'note', note } as const,
    })),
  ];
}

export function templateBody(
  t: TFunction<'notes'>,
  choice: TemplateChoice,
  title: string,
  now = new Date(),
): string {
  const values = templateValues(title, now);
  if (choice.kind === 'note') return applyTemplate(choice.note.body, values);
  if (choice.id === 'blank') return '';
  return t(`templates.${choice.id}.body`, { ...values, interpolation: { escapeValue: false } });
}

export async function createFromTemplate(
  t: TFunction<'notes'>,
  choice: TemplateChoice,
  folderId: string | null,
  wanted?: string,
): Promise<Note> {
  const fallback =
    choice.kind === 'builtIn' && choice.id !== 'blank' ? t(`templates.${choice.id}.name`) : t('untitled');
  const title = nextNoteTitle(wanted ?? fallback);
  return createNote({ title, folderId, body: templateBody(t, choice, title) });
}

export async function openDailyNote(
  t: TFunction<'notes'>,
  notes: Note[],
  folders: AssetFolder[],
  now = new Date(),
): Promise<Note> {
  const title = isoDay(now);
  const existing = notes.find((note) => note.title.toLowerCase() === title);
  if (existing) return existing;
  const folder = folders.find(
    (item) => item.scope === 'notes' && item.name.trim().toLowerCase() === t('dailyFolder').toLowerCase(),
  );
  const custom = userTemplates(notes, folders).find(
    (note) => note.title.toLowerCase() === t('templates.daily.name').toLowerCase(),
  );
  const choice: TemplateChoice = custom ? { kind: 'note', note: custom } : { kind: 'builtIn', id: 'daily' };
  return createNote({ title, folderId: folder?.id ?? null, body: templateBody(t, choice, title, now) });
}
