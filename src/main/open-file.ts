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

export function replaceDialog(language: Language, name: string): MessageBoxOptions {
  const text = resources[language].welcome;
  return {
    type: 'question',
    message: text.replaceMessage.replace('{{name}}', name),
    detail: text.replaceDetail,
    buttons: [text.keepMine, text.replace],
    defaultId: 0,
    cancelId: 0,
  };
}

export function openFailedDialog(language: Language, path: string): MessageBoxOptions {
  return { type: 'error', message: resources[language].welcome.openFailed, detail: path };
}
