import { extname } from 'node:path';
import type { MessageBoxOptions } from 'electron';
import { resources, type Language } from '@shared/i18n';
import { PROJECT_FILE_EXTENSION } from '@shared/project';

export function projectPathFromArgv(argv: readonly string[]): string | null {
  const match = argv.find(
    (arg) => !arg.startsWith('-') && extname(arg).toLowerCase() === `.${PROJECT_FILE_EXTENSION}`,
  );
  return match ?? null;
}

export type SaveChoice = 'save' | 'discard' | 'cancel';

export function saveChangesDialog(language: Language, name: string): MessageBoxOptions {
  const text = resources[language].welcome;
  return {
    type: 'warning',
    message: text.saveChangesMessage.replace('{{name}}', name),
    detail: text.saveChangesDetail,
    buttons: [text.save, text.discardChanges, text.cancel],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  };
}

export function saveChoice(response: number): SaveChoice {
  if (response === 0) return 'save';
  if (response === 1) return 'discard';
  return 'cancel';
}

export function openFailedDialog(language: Language, path: string): MessageBoxOptions {
  return { type: 'error', message: resources[language].welcome.openFailed, detail: path };
}
