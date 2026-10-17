import { useMemo } from 'react';
import { useTranslation } from '@renderer/lib/i18n';
import type { RichTextLabels } from '@renderer/ui';

const KEYS = [
  'editor',
  'bold',
  'italic',
  'strike',
  'code',
  'heading1',
  'heading2',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'link',
  'linkUrl',
  'linkApply',
  'linkRemove',
  'undo',
  'redo',
] as const;

export function useRichTextLabels(): RichTextLabels {
  const { t } = useTranslation('editors');
  return useMemo(
    () => Object.fromEntries(KEYS.map((key) => [key, t(`richText.${key}`)])) as unknown as RichTextLabels,
    [t],
  );
}
