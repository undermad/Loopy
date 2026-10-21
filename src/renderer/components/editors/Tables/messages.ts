import type { CellError, IssueCode, TableColumn } from '@shared/tables';
import { useTranslation } from '@renderer/lib/i18n';

export interface Messages {
  error: (code: CellError, column: string, value: string) => string;
  issue: (code: IssueCode) => string;
}

export function useMessages(): Messages {
  const { t } = useTranslation('tables');
  return {
    error: (code, column, value) => t(`errors.${code}`, { column, value }),
    issue: (code) => t(`issues.${code}`),
  };
}

export function cellErrorMessage(
  messages: Messages,
  column: TableColumn,
  code: CellError,
  value: string,
): string {
  return messages.error(code, column.label || column.id, value.trim());
}

const DUPLICATE_KEY = /Duplicate key (.+)$/;

export function duplicateKeyOf(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  return DUPLICATE_KEY.exec(error.message)?.[1] ?? null;
}
